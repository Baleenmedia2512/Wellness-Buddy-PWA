import bcrypt from 'bcryptjs';
import { ValidationError } from '../../../shared/lib/ValidationError.js';
import { isEnabled } from '../../../shared/lib/feature-flags.js';
import { sendTransactionalMail } from '../../../shared/lib/smtp-mail.js';
import { nowUtc } from '../../../shared/lib/datetime/index.js';
import logger from '../../../shared/lib/logger.js';
import { findByUserId } from '../../user/user.repository.js';
import { generateEmailOtp, isValidEmailOtp } from '../../auth/domain/otp-length.rules.js';
import * as authRepo from '../../auth/auth.repository.js';
import { maskEmailForDisplay } from '../../user/domain/heightChange.rules.js';
import * as submissionRepo from '../data/submission.repo.js';
import { PORTFOLIO_FLAG } from '../domain/access.rules.js';
import {
  coachCanEditSubmission,
  emptyPortfolioForm,
  normalizeFormJson,
  SUBMISSION_STATUS,
  toPublicSubmission,
  validateFormForSubmit,
} from '../domain/submission.rules.js';
import { buildCoachPortfolioPath } from '../domain/slug.rules.js';
import {
  PUBLISH_OTP_CONTACT_TYPE,
  PUBLISH_OTP_HOURS,
  publishOtpRecipientKey,
} from '../domain/publishOtp.rules.js';
import { buildPublishOtpEmail } from '../domain/publishOtpEmail.rules.js';
import { validateCenterId, validateUserId } from '../validation/access.schema.js';
import {
  getAppWorkingClubForPortfolio,
  hydrateFormWithAppData,
  listOwnedCentersForPortfolio,
} from './hydrate-from-app.service.js';

function featureDisabled() {
  throw new ValidationError(404, 'Coach Website is not available');
}

/** Any logged-in owner of a center may manage their own website rows. */
async function assertPortfolioOwner(userId) {
  const person = await findByUserId(
    userId,
    '"UserId", "UserName", "Role", "Email", "CoachId"',
  );
  if (!person) throw new ValidationError(404, 'Account not found');
  return person;
}

async function assertOwnedCenter(userId, centerId) {
  const club = await getAppWorkingClubForPortfolio(userId, centerId);
  if (!club.hasClub || Number(club.centerId) !== Number(centerId)) {
    throw new ValidationError(403, 'You can only create a website for a center you own');
  }
  return club;
}

/** Same ExpiresAt encoding as height-change / auth OTP (IST wall clock string). */
function otpExpiryIst(minutesFromNow) {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const expiresAt = new Date(now.getTime() + istOffset + minutesFromNow * 60 * 1000);
  return expiresAt.toISOString().replace('T', ' ').replace('Z', '').substring(0, 23);
}

/**
 * Publish OTP goes to the member's coach (team_table.CoachId), not the member.
 */
async function resolveMemberCoachApprover(member) {
  const coachId = Number(member?.CoachId);
  if (!Number.isFinite(coachId) || coachId <= 0) {
    throw new ValidationError(
      400,
      'Link a coach before publishing. Your coach must verify the website with an email OTP.',
    );
  }
  const coach = await findByUserId(coachId, '"UserId", "UserName", "Email"');
  if (!coach) {
    throw new ValidationError(404, 'Your coach could not be found.');
  }
  const email = String(coach.Email || '').trim().toLowerCase();
  if (!email.includes('@')) {
    throw new ValidationError(
      400,
      'Your coach has no email on file, so we cannot send the publish OTP.',
    );
  }
  const name = String(coach.UserName || '').replace(/[\r\n]/g, ' ').trim() || 'your coach';
  return { userId: coach.UserId, email, name };
}

async function verifyPublishOtpCode(userId, centerId, otp) {
  const code = String(otp || '').trim();
  if (!isValidEmailOtp(code)) {
    return { ok: false, message: 'Enter the 4-digit OTP from your coach email' };
  }
  const otpData = await authRepo.fetchActiveOtp(
    publishOtpRecipientKey(userId, centerId),
    PUBLISH_OTP_CONTACT_TYPE,
  );
  if (!otpData) {
    return { ok: false, message: 'No active publish code found. Tap Publish again to email your coach.' };
  }
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const currentIST = new Date(now.getTime() + istOffset);
  const expiresAt = new Date(`${otpData.ExpiresAt}Z`);
  if (currentIST > expiresAt) {
    return { ok: false, message: 'OTP expired. Tap Publish again to email your coach.' };
  }
  const valid = await bcrypt.compare(code, otpData.OTPHash);
  if (!valid) {
    return { ok: false, message: 'Invalid OTP. Ask your coach for the code and try again.' };
  }
  await authRepo.markOtpVerified(otpData.ID);
  return { ok: true };
}

/**
 * List owned centers + existing website rows for My Websites hub.
 */
export async function listMyWebsites({ userId: rawUserId }) {
  if (!isEnabled(PORTFOLIO_FLAG)) featureDisabled();
  const userId = validateUserId(rawUserId);
  await assertPortfolioOwner(userId);
  const centers = await listOwnedCentersForPortfolio(userId);
  let rows = await submissionRepo.listSubmissionsByUserId(userId);

  // Legacy rows (pre–multi-center) have CenterId NULL — attach to first free owned center
  // so already-created forms show up under My Websites again.
  const orphans = rows.filter((r) => r.centerId == null);
  for (const orphan of orphans) {
    const used = new Set(
      rows.filter((r) => r.centerId != null).map((r) => Number(r.centerId)),
    );
    const free = centers.find((c) => !used.has(Number(c.centerId)));
    if (!free) break;
    try {
      await submissionRepo.attachCenterIdToSubmission(orphan.id, free.centerId);
    } catch (err) {
      logger.warn('[coach-portfolio] could not backfill CenterId on legacy submission', {
        userId,
        submissionId: orphan.id,
        message: err?.message || String(err),
      });
      break;
    }
  }
  rows = await submissionRepo.listSubmissionsByUserId(userId);

  const byCenter = new Map(
    rows
      .filter((r) => r.centerId != null)
      .map((r) => [Number(r.centerId), toPublicSubmission(r, { includeForm: false })]),
  );
  const websites = centers.map((c) => {
    const existing = byCenter.get(Number(c.centerId)) || null;
    return {
      centerId: c.centerId,
      centerName: c.centerName,
      city: c.city || null,
      locality: c.locality || null,
      submission: existing,
      isPublished: existing?.isPublished === true,
      publicPath: existing?.publicPath || null,
      status: existing?.status || null,
      hasWebsite: Boolean(existing),
    };
  });

  // Still-orphan submissions (no owned center to attach) — show as editable cards.
  const leftoverOrphans = rows
    .filter((r) => r.centerId == null)
    .map((r) => {
      const pub = toPublicSubmission(r, { includeForm: false });
      const formCenter = String(r.formJson?.center?.centerName || '').trim();
      return {
        centerId: null,
        centerName: formCenter || r.userName || 'Saved website',
        city: String(r.formJson?.center?.city || '').trim() || null,
        locality: String(r.formJson?.center?.locality || '').trim() || null,
        submission: pub,
        isPublished: pub?.isPublished === true,
        publicPath: pub?.publicPath || null,
        status: pub?.status || null,
        hasWebsite: true,
        legacy: true,
        submissionId: pub?.id ?? r.id,
      };
    });

  const allWebsites = [...websites, ...leftoverOrphans];
  return {
    httpStatus: 200,
    body: {
      ok: true,
      data: {
        websites: allWebsites,
        centers: websites.map((w) => ({
          centerId: w.centerId,
          centerName: w.centerName,
          city: w.city,
          locality: w.locality,
          hasWebsite: w.hasWebsite,
        })),
        centerCount: centers.length,
      },
    },
  };
}

/**
 * GET current submission (or empty draft shell) for one owned center.
 */
export async function getMySubmission({
  userId: rawUserId,
  centerId: rawCenterId,
  createNew = false,
}) {
  if (!isEnabled(PORTFOLIO_FLAG)) featureDisabled();
  const userId = validateUserId(rawUserId);
  await assertPortfolioOwner(userId);

  const wantFresh = createNew === true || createNew === 'true' || createNew === '1';
  // Freestyle Create New: hydrate name/phone/photo from app; leave City/Area blank for typing.
  if (wantFresh && (rawCenterId == null || String(rawCenterId).trim() === '')) {
    const form = await hydrateFormWithAppData(userId, emptyPortfolioForm(), {});
    form.center.city = '';
    form.center.locality = '';
    form.center.mapsLink = '';
    form.center.centerName = '';
    form.center.address = '';
    form.mediaBrand.websiteDisplayName = '';
    return {
      httpStatus: 200,
      body: {
        ok: true,
        data: {
          ...toPublicSubmission({
            id: null,
            userId,
            centerId: null,
            status: SUBMISSION_STATUS.DRAFT,
            formJson: form,
            adminNote: null,
            submittedAt: null,
            reviewedAt: null,
            updatedAt: null,
          }),
          form,
          hasClub: false,
          centerId: null,
          centerName: null,
          createNew: true,
        },
      },
    };
  }

  let centerId = rawCenterId != null && String(rawCenterId).trim() !== ''
    ? validateCenterId(rawCenterId)
    : null;
  if (centerId == null) {
    // Prefer an existing (possibly legacy) submission so Edit opens the saved form.
    const existingAny = await submissionRepo.findSubmissionByUserId(userId);
    if (existingAny?.centerId != null) {
      centerId = Number(existingAny.centerId);
    } else if (existingAny) {
      // Legacy row without CenterId — return it directly for edit.
      const form = await hydrateFormWithAppData(
        userId,
        existingAny.formJson || emptyPortfolioForm(),
        {},
      );
      return {
        httpStatus: 200,
        body: {
          ok: true,
          data: {
            ...toPublicSubmission({ ...existingAny, formJson: form }),
            form,
            hasClub: Boolean(form?.center?.centerName),
            centerId: null,
            centerName: form?.center?.centerName || existingAny.userName || null,
            legacy: true,
          },
        },
      };
    } else {
      const club = await getAppWorkingClubForPortfolio(userId);
      if (!club.hasClub || !club.centerId) {
        throw new ValidationError(400, 'Register a nutrition center before creating a website');
      }
      centerId = Number(club.centerId);
    }
  }
  const club = await assertOwnedCenter(userId, centerId);
  const hasClub = true;
  const row = await submissionRepo.findSubmissionByUserAndCenter(userId, centerId);
  if (!row) {
    const form = await hydrateFormWithAppData(userId, emptyPortfolioForm(), { centerId });
    return {
      httpStatus: 200,
      body: {
        ok: true,
        data: {
          ...toPublicSubmission({
            id: null,
            userId,
            centerId,
            status: SUBMISSION_STATUS.DRAFT,
            formJson: form,
            adminNote: null,
            submittedAt: null,
            reviewedAt: null,
            updatedAt: null,
          }),
          form,
          hasClub,
          centerId,
          centerName: club.centerName,
        },
      },
    };
  }
  const form = await hydrateFormWithAppData(
    userId,
    row.formJson || emptyPortfolioForm(),
    { centerId },
  );
  let latest = await submissionRepo.upsertSubmission({
    userId,
    centerId,
    status: row.status,
    form,
    markSubmitted: false,
  });
  // Never rewrite live PublicSlug from draft on GET — only unpublished drafts may preview a slug.
  if (latest && latest.isPublished !== true) {
    latest = await submissionRepo.assignPublicSlug(userId, {
      centerId,
      submissionId: latest?.id,
      markPublished: false,
    }) || latest;
  }

  const path = buildCoachPortfolioPath({
    websiteDisplayName: form.mediaBrand?.websiteDisplayName,
    fullName: form.personal?.fullName || latest?.userName,
    city: form.center?.city,
    locality: form.center?.locality,
    userId,
  });
  const publicRow = toPublicSubmission(latest);
  return {
    httpStatus: 200,
    body: {
      ok: true,
      data: {
        ...publicRow,
        form,
        hasClub,
        centerId,
        centerName: club.centerName,
        publicSlug: latest?.publicSlug || path.publicSlug,
        publicPath: latest?.publicSlug
          ? `/coach/${latest.publicSlug}`
          : path.publicPath,
      },
    },
  };
}

async function assertDisplayNameAvailable(userId, centerId, form) {
  const name = String(form?.mediaBrand?.websiteDisplayName || '').trim();
  if (!name) return;
  if (await submissionRepo.displayNameTakenByOther(name, userId, { centerId })) {
    throw new ValidationError(409, 'Website display name already exists — choose another');
  }
}

/**
 * Check whether a website display name is free for this owner + center.
 */
export async function checkDisplayNameAvailability({
  userId: rawUserId,
  centerId: rawCenterId,
  name: rawName,
}) {
  if (!isEnabled(PORTFOLIO_FLAG)) featureDisabled();
  const userId = validateUserId(rawUserId);
  await assertPortfolioOwner(userId);
  const centerId = rawCenterId != null && String(rawCenterId).trim() !== ''
    ? validateCenterId(rawCenterId)
    : null;
  const name = String(rawName || '').trim();
  if (!name) {
    return {
      httpStatus: 200,
      body: { ok: true, data: { available: false, reason: 'empty' } },
    };
  }
  const taken = await submissionRepo.displayNameTakenByOther(name, userId, { centerId });
  return {
    httpStatus: 200,
    body: {
      ok: true,
      data: {
        available: !taken,
        name,
      },
    },
  };
}

function optionalCenterId(raw) {
  if (raw == null || String(raw).trim() === '') return null;
  return validateCenterId(raw);
}

/**
 * Save draft. Center optional — freestyle sites use typed City/Area.
 */
export async function saveMySubmissionDraft({
  userId: rawUserId,
  centerId: rawCenterId,
  form: rawForm,
  createNew = false,
}) {
  if (!isEnabled(PORTFOLIO_FLAG)) featureDisabled();
  const userId = validateUserId(rawUserId);
  const centerId = optionalCenterId(rawCenterId);
  await assertPortfolioOwner(userId);
  if (centerId != null) await assertOwnedCenter(userId, centerId);

  const existing = centerId != null
    ? await submissionRepo.findSubmissionByUserAndCenter(userId, centerId)
    : null;
  if (existing && !coachCanEditSubmission(existing.status)) {
    throw new ValidationError(409, 'This submission cannot be edited');
  }
  const form = await hydrateFormWithAppData(
    userId,
    normalizeFormJson(rawForm),
    { centerId },
  );
  if (!String(form.center?.city || '').trim()) {
    throw new ValidationError(400, 'City is required');
  }
  if (!String(form.center?.locality || '').trim()) {
    throw new ValidationError(400, 'Area is required');
  }
  await assertDisplayNameAvailable(userId, centerId, form);
  const status = existing?.status || SUBMISSION_STATUS.DRAFT;
  let row = await submissionRepo.upsertSubmission({
    userId,
    centerId,
    status,
    form,
    markSubmitted: false,
    createNew: createNew === true && centerId == null,
  });
  // Save is draft-only: never promote PublishedFormJson / live PublicSlug.
  // Unpublished drafts may still get a path preview; already-live sites keep their live slug.
  if (row && row.isPublished !== true) {
    row = await submissionRepo.assignPublicSlug(userId, {
      centerId: row?.centerId ?? centerId,
      submissionId: row?.id,
      markPublished: false,
    }) || row;
  }
  return {
    httpStatus: 200,
    body: { ok: true, data: toPublicSubmission(row) },
  };
}

/**
 * Publish step 1: validate + save, email OTP to the member's coach (not the member).
 * Center optional — freestyle uses form City/Area.
 */
export async function requestPublishOtp({
  userId: rawUserId,
  centerId: rawCenterId,
  form: rawForm,
  createNew = false,
}) {
  if (!isEnabled(PORTFOLIO_FLAG)) featureDisabled();
  const userId = validateUserId(rawUserId);
  const centerId = optionalCenterId(rawCenterId);
  const person = await assertPortfolioOwner(userId);
  const club = centerId != null ? await assertOwnedCenter(userId, centerId) : null;
  const coach = await resolveMemberCoachApprover(person);

  let existing = centerId != null
    ? await submissionRepo.findSubmissionByUserAndCenter(userId, centerId)
    : null;
  if (!existing && createNew !== true) {
    // Freestyle edit / republish: load null-center row for diff + edit checks.
    existing = await submissionRepo.findLatestNullCenterSubmission(userId);
  }
  if (existing && !coachCanEditSubmission(existing.status)) {
    throw new ValidationError(409, 'This submission cannot be edited');
  }
  const form = await hydrateFormWithAppData(
    userId,
    normalizeFormJson(rawForm),
    { centerId },
  );
  if (!String(form.center?.city || '').trim()) {
    throw new ValidationError(400, 'City is required');
  }
  if (!String(form.center?.locality || '').trim()) {
    throw new ValidationError(400, 'Area is required');
  }
  const errors = validateFormForSubmit(form, { hasClub: club?.hasClub === true });
  if (errors.length) {
    throw new ValidationError(400, errors.join('; '));
  }
  await assertDisplayNameAvailable(userId, centerId, form);

  // Capture live snapshot before draft upsert (for change-diff email).
  const previousPublishedForm = existing?.publishedFormJson
    ?? null;

  let row = await submissionRepo.upsertSubmission({
    userId,
    centerId,
    status: SUBMISSION_STATUS.APPROVED,
    form,
    markSubmitted: true,
    clearReview: true,
    createNew: createNew === true && centerId == null,
  });
  // Do not rewrite live PublicSlug until OTP verify. Draft-only sites may preview a slug.
  if (row && row.isPublished !== true) {
    row = await submissionRepo.assignPublicSlug(userId, {
      centerId: row?.centerId ?? centerId,
      submissionId: row?.id,
      markPublished: false,
    }) || row;
  }

  const pathPreview = buildCoachPortfolioPath({
    websiteDisplayName: form.mediaBrand?.websiteDisplayName,
    fullName: form.personal?.fullName || person.UserName,
    city: form.center?.city,
    locality: form.center?.locality,
    userId,
  });

  const otpCenterKey = row?.centerId ?? centerId ?? row?.id ?? 'new';
  const recipientKey = publishOtpRecipientKey(userId, otpCenterKey);
  await authRepo.deactivateActiveOtps(recipientKey, PUBLISH_OTP_CONTACT_TYPE);
  const otp = generateEmailOtp();
  const otpHash = await bcrypt.hash(otp, 10);
  await authRepo.insertOtpToken({
    Recipient: recipientKey,
    OTPHash: otpHash,
    ExpiresAt: otpExpiryIst(PUBLISH_OTP_HOURS * 60),
    ContactType: PUBLISH_OTP_CONTACT_TYPE,
    IsActive: true,
    CreatedAt: nowUtc(),
  });

  const mail = buildPublishOtpEmail({
    otp,
    form,
    previousForm: previousPublishedForm,
    userId,
    userName: person.UserName,
    memberPhone: person.PhoneNumber,
    expiresHours: PUBLISH_OTP_HOURS,
    forCoachApproval: true,
    coachName: coach.name,
    memberName: person.UserName,
    centerName: club?.centerName || form.center?.centerName || form.center?.locality || '',
  });
  await sendTransactionalMail({
    to: coach.email,
    subject: mail.subject,
    text: mail.text,
    html: mail.html,
  });

  logger.info('[coach-portfolio] publish OTP emailed to coach', {
    userId,
    centerId: row?.centerId ?? centerId,
    coachUserId: coach.userId,
    publicPath: pathPreview.publicPath,
  });

  return {
    httpStatus: 200,
    body: {
      ok: true,
      data: {
        ...toPublicSubmission(row),
        otpSent: true,
        otpRequired: true,
        isPublished: row?.isPublished === true,
        maskedEmail: maskEmailForDisplay(coach.email),
        coachName: coach.name,
        otpExpiresAtHours: PUBLISH_OTP_HOURS,
        centerId: row?.centerId ?? centerId,
        centerName: club?.centerName || form.center?.centerName || null,
        otpKey: otpCenterKey,
        publicPathPreview: pathPreview.publicPath,
        publicPath: row?.publicSlug
          ? `/coach/${row.publicSlug}`
          : pathPreview.publicPath,
      },
    },
  };
}

/**
 * Publish step 2: member enters coach OTP → public /coach/<slug>.
 */
export async function verifyPublishOtp({
  userId: rawUserId,
  centerId: rawCenterId,
  otp,
  otpKey = null,
}) {
  if (!isEnabled(PORTFOLIO_FLAG)) featureDisabled();
  const userId = validateUserId(rawUserId);
  const centerId = optionalCenterId(rawCenterId);
  await assertPortfolioOwner(userId);
  if (centerId != null) await assertOwnedCenter(userId, centerId);

  let existing = null;
  if (centerId != null) {
    existing = await submissionRepo.findSubmissionByUserAndCenter(userId, centerId);
  } else if (otpKey != null && Number.isFinite(Number(otpKey)) && Number(otpKey) > 0) {
    // Freestyle create: otpKey is the new submission Id.
    existing = await submissionRepo.findSubmissionById(Number(otpKey));
    if (existing && Number(existing.userId) !== Number(userId)) existing = null;
  }
  if (!existing) {
    existing = await submissionRepo.findSubmissionByUserId(userId);
  }
  if (!existing) {
    throw new ValidationError(400, 'Save your website form first, then request a publish OTP.');
  }

  const key = otpKey != null ? otpKey : (existing.centerId ?? existing.id);
  const codeResult = await verifyPublishOtpCode(userId, key, otp);
  if (!codeResult.ok) {
    throw new ValidationError(400, codeResult.message || 'Invalid or expired OTP');
  }

  const row = await submissionRepo.publishSubmission(userId, {
    centerId: existing.centerId ?? centerId,
    submissionId: existing.id,
  });
  logger.info('[coach-portfolio] website published after coach OTP', {
    userId,
    centerId: existing.centerId ?? centerId,
    submissionId: existing.id,
    publicSlug: row?.publicSlug || null,
  });

  return {
    httpStatus: 200,
    body: {
      ok: true,
      data: {
        ...toPublicSubmission(row),
        otpVerified: true,
      },
    },
  };
}

/** @deprecated Prefer requestPublishOtp */
export async function submitMySubmission(args) {
  return requestPublishOtp(args);
}
