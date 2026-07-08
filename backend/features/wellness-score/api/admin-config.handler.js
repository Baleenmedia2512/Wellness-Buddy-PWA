import { normalizeParameterConfig, DEFAULT_PARAMETER_CONFIG } from '../domain/parameter-registry.js';
import { assertWellnessScoreAdmin } from '../domain/permissions/score.policy.js';
import * as repo from '../data/wellness-score.repo.js';
import { ValidationError } from '../../../shared/lib/ValidationError.js';

export async function getAdminConfig({ requesterUserId }) {
  const requester = await repo.getUserTeamRow(requesterUserId);
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

export async function putAdminConfig({ requesterUserId, parameters }) {
  const requester = await repo.getUserTeamRow(requesterUserId);
  if (!requester) throw new ValidationError(404, 'Requester not found');
  assertWellnessScoreAdmin(requester);

  const normalized = normalizeParameterConfig(parameters);
  const saved = await repo.insertConfig({
    parameters: normalized,
    updatedByUserId: requesterUserId,
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
