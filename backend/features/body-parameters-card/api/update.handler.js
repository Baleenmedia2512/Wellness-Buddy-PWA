/**
 * update.handler.js — Orchestrates body-parameters card updates.
 * Calls validation → data. No HTTP concerns here.
 */
import { validateUpdateCard } from '../validation/card.schema.js';
import {
  updateCard,
  createTeamMemberFromPhone,
  linkCardToUser,
  findPreviousCardByUserId,
  findTeamPhoneByUserId,
} from '../data/card.repo.js';

/**
 * @param {object} body - raw request body (must include `id`)
 * @returns {{ httpStatus: number, body: object }}
 */
export async function handleUpdateCard(body) {
  const payload = validateUpdateCard(body);

  const card = await updateCard(payload.id, payload);

  if (payload.phoneNumber && !card.user_id) {
    const { userId } = await createTeamMemberFromPhone({
      name:        payload.name,
      phoneNumber: payload.phoneNumber,
      coachId:     card.created_by,
      heightCm:    payload.heightCm,
      bmr:         payload.bmr,
    });
    await linkCardToUser(payload.id, userId);
    card.user_id = userId;
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
        previousCard,
      },
    },
  };
}
