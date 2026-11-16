import { ValidationError } from '../../../shared/lib/ValidationError.js';
import { isEnabled } from '../../../shared/lib/feature-flags.js';
import { findByUserId } from '../../user/user.repository.js';
import * as accessRepo from '../data/access.repo.js';
import {
  PORTFOLIO_FLAG,
  PORTFOLIO_SOURCE,
  statusFromPaidFlag,
  toPublicAccess,
} from '../domain/access.rules.js';
import { assertPortfolioAdmin } from '../domain/permissions/portfolio.policy.js';
import { validatePaidFlag, validateUserId } from '../validation/access.schema.js';

function featureDisabled() {
  throw new ValidationError(404, 'Coach Website is not available');
}

/**
 * Admin/developer marks a coach portfolio as paid or not paid (Phase 1 test unlock).
 */
export async function adminMarkPortfolioAccess({
  requesterUserId: rawRequesterId,
  targetUserId: rawTargetId,
  paid: rawPaid,
}) {
  if (!isEnabled(PORTFOLIO_FLAG)) featureDisabled();

  const requesterUserId = validateUserId(rawRequesterId);
  const targetUserId = validateUserId(rawTargetId);
  const paid = validatePaidFlag(rawPaid);

  const requester = await findByUserId(requesterUserId, '"UserId", "Role", "UserName"');
  if (!requester) {
    throw new ValidationError(404, 'Requester account not found');
  }
  assertPortfolioAdmin(requester);

  const target = await findByUserId(targetUserId, '"UserId", "UserName", "Role"');
  if (!target) {
    throw new ValidationError(404, 'Coach account not found');
  }

  const status = statusFromPaidFlag(paid);
  const access = await accessRepo.upsertAccess({
    userId: targetUserId,
    status,
    source: PORTFOLIO_SOURCE.ADMIN,
    markedBy: requesterUserId,
  });

  return {
    httpStatus: 200,
    body: {
      ok: true,
      data: toPublicAccess({
        userId: targetUserId,
        status: access?.status || status,
        source: access?.source || PORTFOLIO_SOURCE.ADMIN,
        markedAt: access?.markedAt || null,
        userName: target.UserName || null,
      }),
    },
  };
}
