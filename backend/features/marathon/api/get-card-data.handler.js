/**
 * get-card-data.handler.js — Computes live card data and persists a share token.
 *
 * Validates → checks permissions → calls repo to compute card payload →
 * stores snapshot + returns token so the frontend can share immediately.
 */
import { validateGetCardData }                                           from '../validation/marathon.schema.js';
import { canGenerateCard }                                               from '../domain/permissions/marathon.policy.js';
import { computeCardData, findMarathonById, upsertShareCard,
         getStoredLeaderData }                                           from '../data/marathon.repo.js';
import { buildCardSnapshot, formatWeightChange, CARD_TYPES }             from '../domain/marathon.rules.js';
import { ValidationError }                                               from '../../../shared/lib/ValidationError.js';
import logger                                                            from '../../../shared/lib/logger.js';

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

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
  // strictDiscipline=false: card generation shows best performer who uploaded
  // any weight today, not only those within the discipline window.
  // The cron (autoFinalizeActiveMarathons) uses strict=true for official scoring.
  const liveData   = await computeCardData(marathonId, cardType, { strictDiscipline: false });
  const todayDate  = new Date(Date.now() + IST_OFFSET_MS).toISOString().substring(0, 10);

  // ── Fallback: if live found no leader for the requested type, use stored
  //    daily results (written by the cron after the discipline window closes).
  //    This covers: coach generates card after 08:15 AM, or mid-day when
  //    nobody has logged in the discipline window yet. ──────────────────────
  let { dayLeader, lapLeader, communityLeader } = liveData;

  const needsFallback =
    (cardType === CARD_TYPES.DAY_LEADER       && !dayLeader) ||
    (cardType === CARD_TYPES.LAP_LEADER       && !lapLeader) ||
    (cardType === CARD_TYPES.COMMUNITY_LEADER && !communityLeader);

  if (needsFallback) {
    const stored = await getStoredLeaderData(marathonId, todayDate);
    if (stored) {
      if (!dayLeader       && stored.dayLeader)       dayLeader       = stored.dayLeader;
      if (!lapLeader       && stored.lapLeader)       lapLeader       = stored.lapLeader;
      if (!communityLeader && stored.communityLeader) communityLeader = stored.communityLeader;
      logger.info('[handleGetCardData] Using stored leader fallback', {
        marathonId, cardType, todayDate,
        dayLeaderId:  stored.dayLeader?.userId  ?? null,
        lapLeaderId:  stored.lapLeader?.userId  ?? null,
      });
    }
  }

  // ── Enrich participants with display-formatted values ─────────────────────
 const dayLeaderId = dayLeader?.userId;
const lapLeaderId = lapLeader?.userId;

const enrichedParticipants = (liveData.participants || []).map(p => ({
  ...p,
  isDayLeader: p.userId === dayLeaderId,
  isLapLeader: p.userId === lapLeaderId,
  dailyChangeDisplay: formatWeightChange(p.dailyChange),
  lapChangeDisplay: formatWeightChange(p.lapChange),
}));

  const cardPayload = {
    ...liveData,
    participants: enrichedParticipants,
    dayLeader:    dayLeader  ? { ...dayLeader,  dailyChangeDisplay: dayLeader.dailyChangeDisplay  || formatWeightChange(dayLeader.dailyChange)  } : null,
    lapLeader:    lapLeader  ? { ...lapLeader,  lapChangeDisplay:   lapLeader.lapChangeDisplay    || formatWeightChange(lapLeader.lapChange)    } : null,
    communityLeader: communityLeader ? { ...communityLeader, lapChangeDisplay: communityLeader.lapChangeDisplay || formatWeightChange(communityLeader.lapChange) } : null,
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
