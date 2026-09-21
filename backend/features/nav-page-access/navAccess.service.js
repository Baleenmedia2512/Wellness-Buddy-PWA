/**
 * Nav page access — role → main-nav matrix (DB-backed).
 */
import { ValidationError } from '../../shared/lib/ValidationError.js';
import logger from '../../shared/lib/logger.js';
import { getSupabaseClient } from '../../utils/supabaseClient.js';
import { userHasSponsorTeam } from '../../utils/coachTeamSeats.js';
import * as userRepo from '../user/user.repository.js';
import * as repo from './data/navAccess.repo.js';
import { assertNavAccessAdmin } from './domain/permissions/navAccess.policy.js';
import {
  allowedPageKeys,
  pagesForRole,
  resolveMatrixRole,
  validateMatrixInput,
} from './domain/navAccess.rules.js';

const REQUESTER_COLUMNS = '"UserId", "Role"';

async function resolveRequester({ requesterUserId, requesterEmail }) {
  if (requesterEmail) {
    const byEmail = await userRepo.findByEmail(requesterEmail, REQUESTER_COLUMNS);
    if (byEmail) return byEmail;
  }
  if (requesterUserId != null && requesterUserId !== '') {
    const byId = await userRepo.findByUserId(requesterUserId, REQUESTER_COLUMNS);
    if (byId) return byId;
  }
  return null;
}

async function loadMatrix() {
  const row = await repo.getLatestConfig();
  return repo.configOrDefault(row);
}

/**
 * Authenticated member: pages allowed for their effective nav role.
 * Account Role stays on the payload; members who sponsor a team use Sponsor pages.
 */
export async function getForMe({ requesterUserId, requesterEmail }) {
  const requester = await resolveRequester({ requesterUserId, requesterEmail });
  if (!requester) throw new ValidationError(404, 'Requester not found');

  const { matrix } = await loadMatrix();
  const accountRole = requester.Role ? String(requester.Role).toLowerCase() : 'user';
  const accountKey = resolveMatrixRole(accountRole);

  let hasSponsorTeam = false;
  if (accountKey === 'user') {
    try {
      hasSponsorTeam = await userHasSponsorTeam(getSupabaseClient(), requester.UserId);
    } catch (err) {
      logger.warn('[nav-page-access] sponsor-team check failed; using account role', {
        err: err?.message || String(err),
      });
    }
  }

  const role = resolveMatrixRole(accountRole, { hasSponsorTeam });
  const pages = pagesForRole(matrix, accountRole, { hasSponsorTeam });

  return {
    httpStatus: 200,
    body: {
      ok: true,
      data: {
        role,
        accountRole,
        hasSponsorTeam,
        pages,
        allowedPages: allowedPageKeys(pages),
      },
    },
  };
}

export async function getAdminConfig({ requesterUserId, requesterEmail }) {
  const requester = await resolveRequester({ requesterUserId, requesterEmail });
  if (!requester) throw new ValidationError(404, 'Requester not found');
  assertNavAccessAdmin(requester);

  const config = await loadMatrix();
  return {
    httpStatus: 200,
    body: {
      ok: true,
      data: {
        matrix: config.matrix,
        updatedAt: config.updatedAt,
        updatedByUserId: config.updatedByUserId,
      },
    },
  };
}

export async function putAdminConfig({ requesterUserId, requesterEmail, matrix }) {
  const requester = await resolveRequester({ requesterUserId, requesterEmail });
  if (!requester) throw new ValidationError(404, 'Requester not found');
  assertNavAccessAdmin(requester);

  const validated = validateMatrixInput(matrix);
  if (!validated.ok) {
    throw new ValidationError(400, validated.message);
  }

  const row = await repo.insertConfig({
    matrix: validated.matrix,
    updatedByUserId: requester.UserId,
  });
  const config = repo.configOrDefault(row);

  return {
    httpStatus: 200,
    body: {
      ok: true,
      data: {
        matrix: config.matrix,
        updatedAt: config.updatedAt,
        updatedByUserId: config.updatedByUserId,
      },
    },
  };
}
