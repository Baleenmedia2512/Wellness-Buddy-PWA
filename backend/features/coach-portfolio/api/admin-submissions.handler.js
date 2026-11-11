import { ValidationError } from '../../../shared/lib/ValidationError.js';
import { isEnabled } from '../../../shared/lib/feature-flags.js';
import { findByUserId } from '../../user/user.repository.js';
import * as submissionRepo from '../data/submission.repo.js';
import { PORTFOLIO_FLAG } from '../domain/access.rules.js';
import { assertPortfolioAdmin } from '../domain/permissions/portfolio.policy.js';
import {
  isAdminEditableStatus,
  SUBMISSION_STATUS,
  toPublicSubmission,
} from '../domain/submission.rules.js';
import { PUBLIC_VISIBLE_STATUSES } from '../domain/public-page.rules.js';
import { validateUserId } from '../validation/access.schema.js';

function featureDisabled() {
  throw new ValidationError(404, 'Coach Website is not available');
}

async function assertAdminRequester(rawRequesterId) {
  const requesterUserId = validateUserId(rawRequesterId);
  const requester = await findByUserId(requesterUserId, '"UserId", "Role", "UserName"');
  if (!requester) throw new ValidationError(404, 'Requester account not found');
  assertPortfolioAdmin(requester);
  return requester;
}

export async function listAdminSubmissions({
  requesterUserId,
  status = null,
}) {
  if (!isEnabled(PORTFOLIO_FLAG)) featureDisabled();
  await assertAdminRequester(requesterUserId);
  const rows = await submissionRepo.listSubmissions({
    status: status ? String(status) : null,
  });
  const counts = {
    total: rows.length,
    draft: 0,
    new: 0,
    under_review: 0,
    information_required: 0,
    approved: 0,
    website_in_progress: 0,
    completed: 0,
  };
  for (const row of rows) {
    if (counts[row.status] != null) counts[row.status] += 1;
  }
  return {
    httpStatus: 200,
    body: {
      ok: true,
      data: {
        counts,
        submissions: rows.map((row) => toPublicSubmission(row, { includeForm: false })),
      },
    },
  };
}

export async function getAdminSubmission({
  requesterUserId,
  targetUserId: rawTargetId,
}) {
  if (!isEnabled(PORTFOLIO_FLAG)) featureDisabled();
  await assertAdminRequester(requesterUserId);
  const targetUserId = validateUserId(rawTargetId);
  const row = await submissionRepo.findSubmissionByUserId(targetUserId);
  if (!row) throw new ValidationError(404, 'Submission not found');
  return {
    httpStatus: 200,
    body: { ok: true, data: toPublicSubmission(row) },
  };
}

export async function updateAdminSubmissionStatus({
  requesterUserId,
  targetUserId: rawTargetId,
  status,
  adminNote = null,
}) {
  if (!isEnabled(PORTFOLIO_FLAG)) featureDisabled();
  const requester = await assertAdminRequester(requesterUserId);
  const targetUserId = validateUserId(rawTargetId);
  if (!isAdminEditableStatus(status)) {
    throw new ValidationError(400, 'Invalid submission status');
  }
  const existing = await submissionRepo.findSubmissionByUserId(targetUserId);
  if (!existing) throw new ValidationError(404, 'Submission not found');
  let row = await submissionRepo.updateSubmissionStatus({
    userId: targetUserId,
    status: String(status),
    adminNote,
    reviewedBy: Number(requester.UserId),
  });

  // Approving / completing auto-publishes the public /coach/<slug> page.
  if (PUBLIC_VISIBLE_STATUSES.has(String(status))) {
    row = await submissionRepo.publishSubmission(targetUserId) || row;
  } else if (
    String(status) === SUBMISSION_STATUS.INFORMATION_REQUIRED
    || String(status) === SUBMISSION_STATUS.NEW
    || String(status) === SUBMISSION_STATUS.UNDER_REVIEW
  ) {
    row = await submissionRepo.unpublishSubmission(targetUserId) || row;
  }

  return {
    httpStatus: 200,
    body: { ok: true, data: toPublicSubmission(row) },
  };
}

export async function publishAdminSubmission({
  requesterUserId,
  targetUserId: rawTargetId,
}) {
  if (!isEnabled(PORTFOLIO_FLAG)) featureDisabled();
  await assertAdminRequester(requesterUserId);
  const targetUserId = validateUserId(rawTargetId);
  const existing = await submissionRepo.findSubmissionByUserId(targetUserId);
  if (!existing) throw new ValidationError(404, 'Submission not found');
  if (!PUBLIC_VISIBLE_STATUSES.has(existing.status)) {
    // Move to approved then publish.
    await submissionRepo.updateSubmissionStatus({
      userId: targetUserId,
      status: SUBMISSION_STATUS.APPROVED,
      adminNote: existing.adminNote,
      reviewedBy: validateUserId(requesterUserId),
    });
  }
  const row = await submissionRepo.publishSubmission(targetUserId);
  return {
    httpStatus: 200,
    body: { ok: true, data: toPublicSubmission(row) },
  };
}
