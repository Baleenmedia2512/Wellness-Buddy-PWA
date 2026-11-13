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
  // Freestyle sites intentionally keep CenterId NULL — never auto-attach them to
  // an owned club (that made "No center" websites show as Demo center 1).
  const rows = await submissionRepo.listSubmissionsByUserId(userId);

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

  // Freestyle / null-CenterId — title = coach name (never a club label).
  const leftoverOrphans = rows
    .filter((r) => r.centerId == null)
    .map((r) => {
      const pub = toPublicSubmission(r, { includeForm: false });
      const city = String(r.formJson?.center?.city || '').trim() || null;
      const locality = String(r.formJson?.center?.locality || '').trim() || null;
      const coachName = String(
        r.formJson?.personal?.fullName || r.userName || '',
      ).trim();
      return {
        centerId: null,
        centerName: coachName || 'No center',
        city,
        locality,
        submission: pub,
        isPublished: pub?.isPublished === true,
        publicPath: pub?.publicPath || null,
        status: pub?.status || null,
        hasWebsite: true,
        legacy: true,
        freestyle: true,
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
  submissionId: rawSubmissionId = null,
  createNew = false,
}) {
  if (!isEnabled(PORTFOLIO_FLAG)) featureDisabled();
  const userId = validateUserId(rawUserId);
  await assertPortfolioOwner(userId);

  const wantFresh = createNew === true || createNew === 'true' || createNew === '1';
  // Freestyle edit by Id — do not fall through to newest row (often Demo center 1).
  const wantedSubmissionId = rawSubmissionId != null && String(rawSubmissionId).trim() !== ''
    ? Number(rawSubmissionId)
    : null;
  if (
    Number.isFinite(wantedSubmissionId)
    && wantedSubmissionId > 0
    && (rawCenterId == null || String(rawCenterId).trim() === '')
    && !wantFresh
  ) {
    const byId = await submissionRepo.findSubmissionById(wantedSubmissionId);
    if (!byId || Number(byId.userId) !== Number(userId)) {
      throw new ValidationError(404, 'Website not found');
    }
    if (byId.centerId != null) {
      return getMySubmission({
        userId,
        centerId: byId.centerId,
        createNew: false,
      });
    }
    const form = await hydrateFormWithAppData(
      userId,
      byId.formJson || emptyPortfolioForm(),
      {},
    );
    form.center.centerName = '';
    form.center.address = [form.center.locality, form.center.city]
      .filter(Boolean)
      .join(', ');
    return {
      httpStatus: 200,
      body: {
        ok: true,
        data: {
          ...toPublicSubmission({ ...byId, formJson: form }),
          form,
          hasClub: false,
          centerId: null,
          centerName: null,
          freestyle: true,
        },
      },
    };
  }

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
      // Freestyle / legacy null-CenterId — never treat FormJson club label as a linked club.
      const form = await hydrateFormWithAppData(
        userId,
        existingAny.formJson || emptyPortfolioForm(),
        {},
      );
      form.center.centerName = '';
      form.center.address = [form.center.locality, form.center.city]
        .filter(Boolean)
        .join(', ');
      return {
        httpStatus: 200,
        body: {
          ok: true,
          data: {
            ...toPublicSubmission({ ...existingAny, formJson: form }),
            form,
            hasClub: false,
            centerId: null,
            centerName: null,
            legacy: true,
            freestyle: true,
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

async function assertDisplayNameAvailable(userId, centerId, form, { submissionId = null } = {}) {
  const name = String(form?.mediaBrand?.websiteDisplayName || '').trim();
  if (!name) return;
  const city = String(form?.center?.city || '').trim();
  const locality = String(form?.center?.locality || '').trim();
  if (await submissionRepo.displayNameTakenByOther(name, userId, {
    centerId,
    submissionId,
    city,
    locality,
  })) {
    throw new ValidationError(
      409,
      'This coach name is already used for a website in this City & Area — choose another place',
    );
  }
}

/**
 * Check whether a website display name is free in this City & Area.
 */
export async function checkDisplayNameAvailability({
  userId: rawUserId,
  centerId: rawCenterId,
  submissionId: rawSubmissionId = null,
  name: rawName,
  city: rawCity = null,
  locality: rawLocality = null,
}) {
  if (!isEnabled(PORTFOLIO_FLAG)) featureDisabled();
  const userId = validateUserId(rawUserId);
  await assertPortfolioOwner(userId);
  const centerId = rawCenterId != null && String(rawCenterId).trim() !== ''
    ? validateCenterId(rawCenterId)
    : null;
  const submissionId = rawSubmissionId != null && String(rawSubmissionId).trim() !== ''
    ? Number(rawSubmissionId)
    : null;
  const name = String(rawName || '').trim();
  const city = String(rawCity || '').trim();
  const locality = String(rawLocality || '').trim();
  if (!name) {
    return {
      httpStatus: 200,
      body: { ok: true, data: { available: false, reason: 'empty' } },
    };
  }
  if (!city || !locality) {
    return {
      httpStatus: 200,
      body: { ok: true, data: { available: true, name, pendingPlace: true } },
    };
  }
  const taken = await submissionRepo.displayNameTakenByOther(name, userId, {
    centerId,
    submissionId: Number.isFinite(submissionId) ? submissionId : null,
    city,
    locality,
  });
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
  submissionId: rawSubmissionId = null,
}) {
  if (!isEnabled(PORTFOLIO_FLAG)) featureDisabled();
  const userId = validateUserId(rawUserId);
  const centerId = optionalCenterId(rawCenterId);
  await assertPortfolioOwner(userId);
  if (centerId != null) await assertOwnedCenter(userId, centerId);

  const sid = rawSubmissionId != null && String(rawSubmissionId).trim() !== ''
    ? Number(rawSubmissionId)
    : null;
  let existing = centerId != null
    ? await submissionRepo.findSubmissionByUserAndCenter(userId, centerId)
    : null;
  if (!existing && Number.isFinite(sid) && sid > 0) {
    const byId = await submissionRepo.findSubmissionById(sid);
    if (byId && Number(byId.userId) === Number(userId) && byId.centerId == null) {
      existing = byId;
    }
  }
  if (existing && !coachCanEditSubmission(existing.status)) {
    throw new ValidationError(409, 'This submission cannot be edited');
  }
  const form = await hydrateFormWithAppData(
    userId,
    normalizeFormJson(rawForm),
    { centerId },
  );
  // Freestyle: never keep a club label from an older FormJson / primary-club hydrate.
  if (centerId == null) {
    form.center.centerName = '';
    form.center.address = [form.center.locality, form.center.city].filter(Boolean).join(', ');
  }
  if (!String(form.center?.city || '').trim()) {
    throw new ValidationError(400, 'City is required');
  }
  if (!String(form.center?.locality || '').trim()) {
    throw new ValidationError(400, 'Area is required');
  }
  await assertDisplayNameAvailable(userId, centerId, form, {
    submissionId: existing?.id ?? (Number.isFinite(sid) ? sid : null),
  });
  const status = existing?.status || SUBMISSION_STATUS.DRAFT;
  let row = await submissionRepo.upsertSubmission({
    userId,
    centerId,
    status,
    form,
    markSubmitted: false,
    createNew: createNew === true && centerId == null,
    submissionId: existing?.id ?? (Number.isFinite(sid) ? sid : null),
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
  submissionId: rawSubmissionId = null,
}) {
  if (!isEnabled(PORTFOLIO_FLAG)) featureDisabled();
  const userId = validateUserId(rawUserId);
  const centerId = optionalCenterId(rawCenterId);
  const person = await assertPortfolioOwner(userId);
  const club = centerId != null ? await assertOwnedCenter(userId, centerId) : null;
  const coach = await resolveMemberCoachApprover(person);

  const sid = rawSubmissionId != null && String(rawSubmissionId).trim() !== ''
    ? Number(rawSubmissionId)
    : null;
  let existing = centerId != null
    ? await submissionRepo.findSubmissionByUserAndCenter(userId, centerId)
    : null;
  if (!existing && Number.isFinite(sid) && sid > 0) {
    const byId = await submissionRepo.findSubmissionById(sid);
    if (byId && Number(byId.userId) === Number(userId) && byId.centerId == null) {
      existing = byId;
    }
  }
  if (!existing && createNew !== true && centerId == null) {
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
  // Freestyle publish: strip any stale club name so live page cannot show Demo center 1.
  if (centerId == null) {
    form.center.centerName = '';
    form.center.address = [form.center.locality, form.center.city].filter(Boolean).join(', ');
  } else if (club?.centerName) {
    form.center.centerName = club.centerName;
  }
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
  await assertDisplayNameAvailable(userId, centerId, form, {
    submissionId: existing?.id ?? (Number.isFinite(sid) ? sid : null),
  });

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
    submissionId: existing?.id ?? (Number.isFinite(sid) ? sid : null),
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
