/**
 * create-marathon.handler.js — Orchestrates marathon (LAP) creation.
 * Validates → checks permissions → resolves lap_sequence → inserts marathon
 * → inserts participants with roles → locks baseline weights.
 */
import { validateCreateMarathon }                                         from '../validation/marathon.schema.js';
import { canManageMarathon }                                              from '../domain/permissions/marathon.policy.js';
import {
  insertMarathon,
  insertParticipantsWithRoles,
  lockBaselineWeights,
  countLapSequenceForTeam,
}                                                                          from '../data/marathon.repo.js';
import { buildMarathonDisplayName }                                        from '../domain/marathon.rules.js';
import { ValidationError }                                                 from '../../../shared/lib/ValidationError.js';
import logger                                                              from '../../../shared/lib/logger.js';

export async function handleCreateMarathon(body) {
  const payload = validateCreateMarathon(body);

  const role = (body.role || 'coach').toLowerCase();
  if (!canManageMarathon({ role })) {
    throw new ValidationError(403, 'Only coaches may create marathons');
  }

  // ── Team name auto-sequencing ────────────────────────────────────────────
  let lapSequence = 1;
  if (payload.teamName) {
    const existingCount = await countLapSequenceForTeam(payload.coachId, payload.teamName);
    lapSequence = existingCount + 1;
  }

  const displayName = payload.teamName
    ? buildMarathonDisplayName(payload.teamName, lapSequence, payload.name)
    : payload.name;

  // ── Create marathon ──────────────────────────────────────────────────────
  const marathon = await insertMarathon({
    coachId:     payload.coachId,
    name:        displayName,
    teamName:    payload.teamName,
    lapSequence,
    totalLaps:   payload.totalLaps,
    daysPerLap:  payload.daysPerLap,
    startedAt:   payload.startedAt,
  });

  // ── Insert participants with roles ───────────────────────────────────────
  await insertParticipantsWithRoles(marathon.id, payload.participants);

  // ── Lock baseline weights (non-fatal if weights unavailable) ────────────
  const userIds = payload.participants.map(p => p.userId);
  try {
    await lockBaselineWeights(marathon.id, userIds);
  } catch (err) {
    logger.warn('[handleCreateMarathon] Baseline weight locking failed (non-fatal)', { error: err.message });
  }

  logger.info('[handleCreateMarathon] Marathon created', {
    marathonId:   marathon.id,
    name:         marathon.name,
    teamName:     payload.teamName,
    lapSequence,
    coachId:      payload.coachId,
    participants: payload.participants.length,
  });

  return {
    httpStatus: 201,
    body: {
      ok:   true,
      data: {
        marathonId:   marathon.id,
        name:         marathon.name,
        teamName:     marathon.team_name,
        lapSequence:  marathon.lap_sequence,
        totalLaps:    marathon.total_laps,
        daysPerLap:   marathon.days_per_lap,
        startedAt:    marathon.started_at,
        participants: payload.participants.length,
      },
    },
  };
}
