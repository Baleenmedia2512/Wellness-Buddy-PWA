import { normalizeParameterConfig, DEFAULT_PARAMETER_CONFIG } from '../domain/parameter-registry.js';
import { assertWellnessScoreAdmin } from '../domain/permissions/score.policy.js';
import * as repo from '../data/wellness-score.repo.js';
import * as userRepo from '../../user/user.repository.js';
import { ValidationError } from '../../../shared/lib/ValidationError.js';

const REQUESTER_COLUMNS = '"UserId", "Role", "Bmr", "WeightGoalMode", "Weight"';

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

export async function getAdminConfig({ requesterUserId, requesterEmail }) {
  const requester = await resolveRequester({ requesterUserId, requesterEmail });
  if (!requester) throw new ValidationError(404, 'Requester not found');
  assertWellnessScoreAdmin(requester);

  const row = await repo.getLatestConfig();
  const parameters = normalizeParameterConfig(row?.parameters ?? DEFAULT_PARAMETER_CONFIG);

  return {
    httpStatus: 200,
    body: {
      ok: true,
      data: {
        parameters,
        updatedAt: row?.updated_at ?? null,
        updatedByUserId: row?.updated_by_user_id ?? null,
      },
    },
  };
}

export async function putAdminConfig({ requesterUserId, requesterEmail, parameters }) {
  const requester = await resolveRequester({ requesterUserId, requesterEmail });
  if (!requester) throw new ValidationError(404, 'Requester not found');
  assertWellnessScoreAdmin(requester);

  const normalized = normalizeParameterConfig(parameters);
  const saved = await repo.insertConfig({
    parameters: normalized,
    updatedByUserId: requester.UserId,
  });

  return {
    httpStatus: 200,
    body: {
      ok: true,
      data: {
        parameters: normalizeParameterConfig(saved.parameters),
        updatedAt: saved.updated_at,
        updatedByUserId: saved.updated_by_user_id,
      },
    },
  };
}
