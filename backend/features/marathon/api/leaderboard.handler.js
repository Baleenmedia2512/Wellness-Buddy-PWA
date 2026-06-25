/**
 * leaderboard.handler.js — Returns ranked participant list for a marathon.
 */
import { validateGetLeaderboard }    from '../validation/marathon.schema.js';
import { canManageMarathon }         from '../domain/permissions/marathon.policy.js';
import { getLeaderboard }            from '../data/marathon.repo.js';
import { ValidationError }           from '../../../shared/lib/ValidationError.js';

export async function handleGetLeaderboard(query) {
  const { marathonId, type, topN } = validateGetLeaderboard(query);

  if (!canManageMarathon({ role: 'coach' })) {
    throw new ValidationError(403, 'Not authorised');
  }

  const entries = await getLeaderboard(marathonId, type, topN);

  return {
    httpStatus: 200,
    body: { ok: true, data: { type, marathonId, entries } },
  };
}
