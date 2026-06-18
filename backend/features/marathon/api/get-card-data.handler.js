/**
 * get-card-data.handler.js — Computes live card data and persists a share token.
 *
 * Validates → checks permissions → calls repo to compute card payload →
 * stores snapshot + returns token so the frontend can share immediately.
 */
import { validateGetCardData }                                  from '../validation/marathon.schema.js';
import { canGenerateCard }                                      from '../domain/permissions/marathon.policy.js';
import { computeCardData, findMarathonById, upsertShareCard }   from '../data/marathon.repo.js';
import { buildCardSnapshot, formatWeightChange }                from '../domain/marathon.rules.js';
import { ValidationError }                                      from '../../../shared/lib/ValidationError.js';
import logger                                                   from '../../../shared/lib/logger.js';

/**
 * @param {object} query - { marathonId, cardType, coachId }
 * @returns {{ httpStatus: number, body: object }}
 */
export async function handleGetCardData(query) {
  const { marathonId, cardType, coachId } = validateGetCardData(query);

  // ── Permission: coachId must own the marathon ────────────────────────────
  const marathon = await findMarathonById(marathonId);
  if (!marathon) throw new ValidationError(404, 'Marathon not found');

  if (!canGenerateCard({ requestingCoachId: coachId, marathonCoachId: marathon.coach_id, role: 'coach' })) {
    throw new ValidationError(403, 'You are not authorised to generate cards for this marathon');
  }

  // ── Compute live card payload ─────────────────────────────────────────────
  const liveData = await computeCardData(marathonId, cardType);

  // ── Enrich participants with display-formatted values ─────────────────────
  const enrichedParticipants = (liveData.participants || []).map(p => ({
    ...p,
    dailyChangeDisplay: formatWeightChange(p.dailyChange),
    lapChangeDisplay:   formatWeightChange(p.lapChange),
  }));

  const cardPayload = {
    ...liveData,
    participants: enrichedParticipants,
    dayLeader:    liveData.dayLeader  ? { ...liveData.dayLeader,  dailyChangeDisplay: formatWeightChange(liveData.dayLeader.dailyChange)  } : null,
    lapLeader:    liveData.lapLeader  ? { ...liveData.lapLeader,  lapChangeDisplay:   formatWeightChange(liveData.lapLeader.lapChange)   } : null,
    teamDailyTotalDisplay: formatWeightChange(liveData.teamDailyTotal),
  };

  // ── Persist snapshot + share token ────────────────────────────────────────
  const snapshot   = buildCardSnapshot(cardType, cardPayload);
  const shareCard  = await upsertShareCard({
    marathonId,
    cardType,
    lapNumber:  liveData.lapNumber,
    dayNumber:  liveData.dayNumber,
    cardData:   snapshot,
    createdBy:  coachId,
  });

  logger.info('[handleGetCardData] Card data computed + token issued', {
    marathonId, cardType, token: shareCard.public_share_token,
  });

  return {
    httpStatus: 200,
    body: {
      ok:   true,
      data: {
        ...cardPayload,
        shareToken:     shareCard.public_share_token,
        shareExpiresAt: shareCard.share_expires_at,
      },
    },
  };
}
