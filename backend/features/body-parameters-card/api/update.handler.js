/**
 * update.handler.js — Orchestrates body-parameters card updates.
 * Calls validation → data. No HTTP concerns here.
 */
import { validateUpdateCard } from '../validation/card.schema.js';
import { enrichPayloadWithCalculatedBmr } from '../domain/card.rules.js';
import {
  updateCard,
  findPreviousCardByUserId,
  findTeamPhoneByUserId,
} from '../data/card.repo.js';
import { syncCardToProfileAfterSave } from '../data/sync.repo.js';
import logger from '../../../shared/lib/logger.js';

function buildLinkPayload(payload, card) {
  return {
    phoneNumber: payload.phoneNumber,
    name:        payload.name,
    coachId:     card.created_by,
    heightCm:    payload.heightCm,
    bmr:         payload.bmr,
    weightKg:    payload.weightKg,
    fatPercent:  payload.fatPercent,
  };
}

/**
 * @param {object} body - raw request body (must include `id`)
 * @returns {{ httpStatus: number, body: object }}
 */
export async function handleUpdateCard(body) {
  const payload = enrichPayloadWithCalculatedBmr(validateUpdateCard(body));

  const card = await updateCard(payload.id, payload);
  const linkPayload = buildLinkPayload(payload, card);

  let syncResult = { synced: false, userId: card.user_id ?? null };
  try {
    syncResult = await syncCardToProfileAfterSave(card, linkPayload);
    if (syncResult.userId) card.user_id = syncResult.userId;
  } catch (syncErr) {
    logger.error('[handleUpdateCard] profile sync failed', {
      cardId: card.id,
      userId: card.user_id,
      message: syncErr?.message,
    });
    throw syncErr;
  }

  const previousCard = card.user_id
    ? await findPreviousCardByUserId(card.user_id, card.id)
    : null;

  const phoneNumber = card.user_id
    ? await findTeamPhoneByUserId(card.user_id)
    : (payload.phoneNumber || null);

  return {
    httpStatus: 200,
    body: {
      success: true,
      data: {
        id:               card.id,
        publicShareToken: card.public_share_token,
        shareExpiresAt:   card.share_expires_at,
        name:             card.name,
        age:              card.age,
        gender:           card.gender,
        heightCm:         card.height_cm,
        weightKg:         card.weight_kg,
        bmi:              card.bmi,
        fatPercent:       card.fat_percent,
        bmr:              card.bmr,
        bodyAge:          card.body_age,
        visceralFat:      card.visceral_fat,
        chestCm:          card.chest_cm,
        waistCm:          card.waist_cm,
        hipCm:            card.hip_cm,
        recordedDate:     card.recorded_date,
        locationName:     card.location_name,
        phoneNumber:      phoneNumber || payload.phoneNumber || null,
        userId:           card.user_id ?? null,
        profileSynced:    syncResult.synced,
        previousCard,
      },
    },
  };
}
