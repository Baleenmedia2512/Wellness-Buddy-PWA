/**
 * create-marathon.handler.js — Orchestrates marathon creation.
 * Validates → checks permissions → inserts marathon + participants.
 */
import { validateCreateMarathon }                    from '../validation/marathon.schema.js';
import { canManageMarathon }                         from '../domain/permissions/marathon.policy.js';
import { insertMarathon, insertParticipants }        from '../data/marathon.repo.js';
import { ValidationError }                           from '../../../shared/lib/ValidationError.js';
import logger                                        from '../../../shared/lib/logger.js';

/**
 * @param {object} body - raw request body (coachId, name, totalLaps, daysPerLap, startedAt, participantUserIds, role?)
 * @returns {{ httpStatus: number, body: object }}
 */
export async function handleCreateMarathon(body) {
  const payload = validateCreateMarathon(body);

  const role = (body.role || 'coach').toLowerCase();
  if (!canManageMarathon({ role })) {
    throw new ValidationError(403, 'Only coaches may create marathons');
  }

  const marathon = await insertMarathon({
    coachId:    payload.coachId,
    name:       payload.name,
    totalLaps:  payload.totalLaps,
    daysPerLap: payload.daysPerLap,
    startedAt:  payload.startedAt,
  });

  await insertParticipants(marathon.id, payload.participantUserIds);

  logger.info('[handleCreateMarathon] Marathon created', {
    marathonId:   marathon.id,
    coachId:      payload.coachId,
    participants: payload.participantUserIds.length,
  });

  return {
    httpStatus: 201,
    body: {
      ok:   true,
      data: {
        marathonId:   marathon.id,
        name:         marathon.name,
        totalLaps:    marathon.total_laps,
        daysPerLap:   marathon.days_per_lap,
        startedAt:    marathon.started_at,
        participants: payload.participantUserIds.length,
      },
    },
  };
}
