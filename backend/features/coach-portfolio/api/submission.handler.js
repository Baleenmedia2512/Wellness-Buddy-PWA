import { ValidationError } from '../../../shared/lib/ValidationError.js';
import { isEnabled } from '../../../shared/lib/feature-flags.js';
import logger from '../../../shared/lib/logger.js';
import { findByUserId } from '../../user/user.repository.js';
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
import { validateUserId } from '../validation/access.schema.js';
import {
  getAppWorkingClubForPortfolio,
  hydrateFormWithAppData,
} from './hydrate-from-app.service.js';

function featureDisabled() {
  throw new ValidationError(404, 'Coach Website is not available');
}

/** Self-serve website CMS — no admin mark-paid required (Cashfree gate later). */
async function assertPortfolioCoach(userId) {
  const person = await findByUserId(userId, '"UserId", "UserName", "Role"');
  if (!person) throw new ValidationError(404, 'Account not found');
  return person;
}

/**
 * GET current submission (or empty draft shell) for a paid coach.
 */
export async function getMySubmission({ userId: rawUserId }) {
  if (!isEnabled(PORTFOLIO_FLAG)) featureDisabled();
  const userId = validateUserId(rawUserId);
  await assertPortfolioCoach(userId);
  const club = await getAppWorkingClubForPortfolio(userId);
  const hasClub = club.hasClub === true;
  const row = await submissionRepo.findSubmissionByUserId(userId);
  if (!row) {
    const form = await hydrateFormWithAppData(userId, emptyPortfolioForm());
    return {
      httpStatus: 200,
      body: {
        ok: true,
        data: {
          ...toPublicSubmission({
            id: null,
            userId,
            status: SUBMISSION_STATUS.DRAFT,
            formJson: form,
            adminNote: null,
            submittedAt: null,
            reviewedAt: null,
            updatedAt: null,
          }),
          hasClub,
        },
      },
    };
  }
  const form = await hydrateFormWithAppData(userId, row.formJson || emptyPortfolioForm());
  // Persist hydrated place / display name, then rebuild slug so the live link
  // matches Website Display Name (not a stale "demo" leaf).
  let latest = await submissionRepo.upsertSubmission({
    userId,
    status: row.status,
    form,
    markSubmitted: false,
  });
  try {
    latest = await submissionRepo.assignPublicSlug(userId, {
      markPublished: latest?.isPublished === true,
    }) || latest;
  } catch (error) {
    // Never block the CMS form on a slug race — keep last good row.
    logger.warn('coach-portfolio assignPublicSlug failed on GET', {
      userId,
      message: error?.message || String(error),
    });
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
        // Prefer path built from the form the coach sees.
        publicSlug: latest?.publicSlug || path.publicSlug,
        publicPath: latest?.publicSlug
          ? `/coach/${latest.publicSlug}`
          : path.publicPath,
      },
    },
  };
}

async function assertDisplayNameAvailable(userId, form) {
  const name = String(form?.mediaBrand?.websiteDisplayName || '').trim();
  if (!name) return;
  if (await submissionRepo.displayNameTakenByOther(name, userId)) {
    throw new ValidationError(409, 'Website display name already exists — choose another');
  }
}

/**
 * Check whether a website display name is free for this coach.
 */
export async function checkDisplayNameAvailability({ userId: rawUserId, name: rawName }) {
  if (!isEnabled(PORTFOLIO_FLAG)) featureDisabled();
  const userId = validateUserId(rawUserId);
  await assertPortfolioCoach(userId);
  const name = String(rawName || '').trim();
  if (!name) {
    return {
      httpStatus: 200,
      body: { ok: true, data: { available: false, reason: 'empty' } },
    };
  }
  const taken = await submissionRepo.displayNameTakenByOther(name, userId);
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

/**
 * Save draft answers. Does not require full validation.
 */
export async function saveMySubmissionDraft({ userId: rawUserId, form: rawForm }) {
  if (!isEnabled(PORTFOLIO_FLAG)) featureDisabled();
  const userId = validateUserId(rawUserId);
  await assertPortfolioCoach(userId);
  const existing = await submissionRepo.findSubmissionByUserId(userId);
  if (existing && !coachCanEditSubmission(existing.status)) {
    throw new ValidationError(409, 'This submission cannot be edited');
  }
  const form = await hydrateFormWithAppData(userId, normalizeFormJson(rawForm));
  await assertDisplayNameAvailable(userId, form);
  // Preserve review/publish status — ongoing CMS edits must not reset to draft.
  const status = existing?.status || SUBMISSION_STATUS.DRAFT;
  let row = await submissionRepo.upsertSubmission({
    userId,
    status,
    form,
    markSubmitted: false,
  });
  // Always rebuild /coach/city/area/display-name from the saved form.
  row = await submissionRepo.assignPublicSlug(userId, {
    markPublished: row?.isPublished === true,
  }) || row;
  return {
    httpStatus: 200,
    body: { ok: true, data: toPublicSubmission(row) },
  };
}

/**
 * Coach self-publish: validate → approved + public /coach/<slug>. No admin step.
 */
export async function submitMySubmission({ userId: rawUserId, form: rawForm }) {
  if (!isEnabled(PORTFOLIO_FLAG)) featureDisabled();
  const userId = validateUserId(rawUserId);
  await assertPortfolioCoach(userId);
  const existing = await submissionRepo.findSubmissionByUserId(userId);
  if (existing && !coachCanEditSubmission(existing.status)) {
    throw new ValidationError(409, 'This submission cannot be edited');
  }
  const form = await hydrateFormWithAppData(userId, normalizeFormJson(rawForm));
  const club = await getAppWorkingClubForPortfolio(userId);
  const errors = validateFormForSubmit(form, { hasClub: club.hasClub === true });
  if (errors.length) {
    throw new ValidationError(400, errors.join('; '));
  }
  await assertDisplayNameAvailable(userId, form);
  await submissionRepo.upsertSubmission({
    userId,
    status: SUBMISSION_STATUS.APPROVED,
    form,
    markSubmitted: true,
    clearReview: true,
  });
  const row = await submissionRepo.publishSubmission(userId);
  return {
    httpStatus: 200,
    body: { ok: true, data: toPublicSubmission(row) },
  };
}
