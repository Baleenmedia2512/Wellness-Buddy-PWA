/**
 * finalize-day.handler.js
 *
 * Called after the discipline window closes (via cron or manual trigger).
 * Computes the Day / Lap / Community leaders, persists them to
 * marathon_daily_results, and returns the result for immediate card generation.
 */
import { validateFinalizeDay }                           from '../validation/marathon.schema.js';
import { canGenerateCard }                               from '../domain/permissions/marathon.policy.js';
import {
  computeCardData,
  saveDailyResults,
  findMarathonById,
}                                                        from '../data/marathon.repo.js';
import { computeLapAndDay, DISCIPLINE_STATUS, formatWeightChange } from '../domain/marathon.rules.js';
import { ValidationError }                               from '../../../shared/lib/ValidationError.js';
import logger                                            from '../../../shared/lib/logger.js';

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export async function handleFinalizeDay(body) {
  const { marathonId, coachId } = validateFinalizeDay(body);

  const marathon = await findMarathonById(marathonId);
  if (!marathon) throw new ValidationError(404, 'Marathon not found');

  if (!canGenerateCard({ requestingCoachId: coachId, marathonCoachId: marathon.coach_id, role: 'coach' })) {
    throw new ValidationError(403, 'Not authorised to finalize this marathon');
  }

  // Compute live card data (uses discipline engine v2)
  const liveData = await computeCardData(marathonId, 'day_leader');

  const now = new Date(Date.now() + IST_OFFSET_MS);
  const { lapNumber, dayNumber } = computeLapAndDay(marathon.started_at, marathon.days_per_lap, now);
  const resultDate = now.toISOString().substring(0, 10);

  const eligible = (liveData.participants || []).filter(p => p.disciplineStatus === DISCIPLINE_STATUS.ELIGIBLE);

  await saveDailyResults(marathonId, {
    resultDate,
    lapNumber,
    dayNumber,
    dayLeader:        liveData.dayLeader,
    lapLeader:        liveData.lapLeader,
    communityLeader:  liveData.communityLeader,
    eligibleCount:    eligible.length,
    totalParticipants: (liveData.participants || []).length,
  });

  logger.info('[handleFinalizeDay] Daily results saved', {
    marathonId, resultDate, lapNumber, dayNumber,
    eligible:     eligible.length,
    dayLeaderId:  liveData.dayLeader?.userId,
    lapLeaderId:  liveData.lapLeader?.userId,
  });

  return {
    httpStatus: 200,
    body: {
      ok:   true,
      data: {
        resultDate,
        lapNumber,
        dayNumber,
        eligibleCount:    eligible.length,
        totalParticipants: (liveData.participants || []).length,
        dayLeader: liveData.dayLeader ? {
          userId:             liveData.dayLeader.userId,
          name:               liveData.dayLeader.name,
          dayChangeDisplay:   formatWeightChange(liveData.dayLeader.dayChange),
        } : null,
        lapLeader: liveData.lapLeader ? {
          userId:           liveData.lapLeader.userId,
          name:             liveData.lapLeader.name,
          lapChangeDisplay: formatWeightChange(liveData.lapLeader.lapChange),
        } : null,
      },
    },
  };
}
