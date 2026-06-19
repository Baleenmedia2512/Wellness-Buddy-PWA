/**
 * participants.handler.js — Returns eligible participant candidates for marathon LAP creation.
 *
 * Eligible participants:
 *   1. All recursive downline of the coach (depth-limited to 5 levels)
 *   2. Coach's direct upline (their CoachId)
 *   3. Coach's upline's upline
 *
 * Much faster than full team-hierarchy — uses targeted BFS queries, not a full table scan.
 */
import { validateGetParticipants }  from '../validation/marathon.schema.js';
import { canManageMarathon }        from '../domain/permissions/marathon.policy.js';
import { getParticipantCandidates } from '../data/marathon.repo.js';
import { ValidationError }          from '../../../shared/lib/ValidationError.js';

/**
 * @param {object} query - { coachId, role? }
 * @returns {{ httpStatus: number, body: object }}
 */
export async function handleGetParticipants(query) {
  const { coachId } = validateGetParticipants(query);

  const role = (query.role || 'coach').toLowerCase();
  if (!canManageMarathon({ role })) {
    throw new ValidationError(403, 'Only coaches may load participant candidates');
  }

  const candidates = await getParticipantCandidates(coachId);

  return {
    httpStatus: 200,
    body: { ok: true, data: candidates },
  };
}
