import { ValidationError } from '../../../shared/lib/ValidationError.js';
import { isEnabled } from '../../../shared/lib/feature-flags.js';
import { findByUserId } from '../../user/user.repository.js';
import * as accessRepo from '../data/access.repo.js';
import {
  PORTFOLIO_FLAG,
  PORTFOLIO_STATUS,
  toPublicAccess,
} from '../domain/access.rules.js';
import { validateUserId } from '../validation/access.schema.js';

function featureDisabled() {
  throw new ValidationError(404, 'Coach Website is not available');
}

/**
 * GET portfolio paid status for one user.
 */
export async function getPortfolioStatus({ userId: rawUserId }) {
  if (!isEnabled(PORTFOLIO_FLAG)) featureDisabled();
  const userId = validateUserId(rawUserId);
  const person = await findByUserId(userId, '"UserId", "UserName", "Role"');
  if (!person) {
    throw new ValidationError(404, 'Account not found');
  }
  const access = await accessRepo.findAccessByUserId(userId);
  return {
    httpStatus: 200,
    body: {
      ok: true,
      data: toPublicAccess({
        userId,
        status: access?.status || PORTFOLIO_STATUS.NOT_PAID,
        source: access?.source || null,
        markedAt: access?.markedAt || null,
        userName: person.UserName || null,
      }),
    },
  };
}
