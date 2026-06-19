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
  completePreviousActiveLaps,
}                                                                          from '../data/marathon.repo.js';
import { buildMarathonDisplayName }                                        from '../domain/marathon.rules.js';
import { ValidationError }                                                 from '../../../shared/lib/ValidationError.js';
import { getSupabaseClient }                                               from '../../../utils/supabaseClient.js';
import logger                                                              from '../../../shared/lib/logger.js';

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/**
 * Validate each participant has at least 1 weight record in [startedAt, today IST].
 * Only enforced when the marathon starts on or before today (active or backdated).
 * Returns array of missing userIds.
 */
async function findParticipantsWithoutWeight(participantIds, startedAtDateStr) {
  const supabase = getSupabaseClient();
  const nowIST   = new Date(Date.now() + IST_OFFSET_MS);
  const startIST = new Date(startedAtDateStr + 'T00:00:00');

  // Skip validation for future marathons — period hasn't started yet
  if (startIST > nowIST) return [];

  const endStr   = nowIST.toISOString().replace('T', ' ').substring(0, 23);
  const startStr = startIST.toISOString().replace('T', ' ').substring(0, 23);

  const { data: weights, error } = await supabase
    .from('weight_records_table')
    .select('"UserId"')
    .in('"UserId"', participantIds)
    .gte('"CreatedAt"', startStr)
    .lte('"CreatedAt"', endStr)
    .or('"IsDeleted".is.null,"IsDeleted".eq.0');

  if (error) {
    logger.warn('[handleCreateMarathon] Weight eligibility check failed (non-fatal)', { error: error.message });
    return []; // non-fatal: if DB query fails, don't block creation
  }

  const withWeight = new Set((weights || []).map(w => w.UserId));
  return participantIds.filter(id => !withWeight.has(id));
}

export async function handleCreateMarathon(body) {
  const payload = validateCreateMarathon(body);

  const role = (body.role || 'coach').toLowerCase();
  if (!canManageMarathon({ role })) {
    throw new ValidationError(403, 'Only coaches may create marathons');
  }

  // ── Participant weight eligibility validation ────────────────────────────
  // Every participant must have at least one weight record in [startedAt, today IST].
  // Skipped for future-dated marathons (period not yet started).
  const memberIds = payload.participants.map(p => p.userId);
  const missingWeightIds = await findParticipantsWithoutWeight(memberIds, payload.startedAt);
  if (missingWeightIds.length > 0) {
    throw new ValidationError(
      422,
      `${missingWeightIds.length} participant(s) have no weight record for the current marathon period (${payload.startedAt} to today). Remove them or ask them to log their weight first.`,
    );
  }

  // ── Team name auto-sequencing ────────────────────────────────────────────
  let lapSequence = 1;
  if (payload.teamName) {
    const existingCount = await countLapSequenceForTeam(payload.coachId, payload.teamName);
    lapSequence = existingCount + 1;

    // Auto-complete any previous active LAPs for this team so only one is
    // active at a time. Non-fatal — new LAP is still created even if this fails.
    if (existingCount > 0) {
      try {
        await completePreviousActiveLaps(payload.coachId, payload.teamName);
      } catch (err) {
        logger.warn('[handleCreateMarathon] Failed to complete previous active laps (non-fatal)', { error: err.message });
      }
    }
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
  // Always ensure the creating coach is captain, even if not sent by the client.
  // De-duplicate: if the coach is already in the list, upgrade their role to captain.
  const participantsWithCoach = (() => {
    const filtered = payload.participants.filter(p => p.userId !== payload.coachId);
    const existingCaptains = filtered.filter(p => p.role === 'captain');
    // If someone else was marked captain, demote them to member (coach is always captain)
    const normalised = existingCaptains.length
      ? filtered.map(p => p.role === 'captain' ? { ...p, role: 'member' } : p)
      : filtered;
    return [{ userId: payload.coachId, role: 'captain' }, ...normalised];
  })();

  await insertParticipantsWithRoles(marathon.id, participantsWithCoach);

  // ── Lock baseline weights (non-fatal if weights unavailable) ────────────
  const userIds = [...new Set([payload.coachId, ...payload.participants.map(p => p.userId)])];
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
        participants: participantsWithCoach.length,
      },
    },
  };
}
