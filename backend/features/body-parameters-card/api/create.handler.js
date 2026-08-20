/**
 * create.handler.js — Orchestrates body-parameters card creation.
 * Calls validation → permissions → data. No HTTP concerns here.
 */
import { validateCreateCard } from '../validation/card.schema.js';
import { canCreateCard } from '../domain/permissions/card.policy.js';
import { enrichPayloadWithCalculatedBmr } from '../domain/card.rules.js';
import {
  insertCard,
  createTeamMemberFromPhone,
  findPreviousCardByUserId,
  findLatestCardByUserId,
  updateCard,
  findTeamPhoneByUserId,
  linkCardToUser,
  enforceBpcLeadNoCoachUntilOnboarding,
  invalidateBpcListCache,
} from '../data/card.repo.js';
import { syncCardToProfileAfterSave } from '../data/sync.repo.js';
import { ValidationError } from '../../../shared/lib/ValidationError.js';
import logger from '../../../shared/lib/logger.js';

/**
 * @param {object} body - raw request body
 * @returns {{ httpStatus: number, body: object }}
 */
export async function handleCreateCard(body) {
  logger.info('[handleCreateCard] 🔍 REQUEST RECEIVED', { body });
  
  const payload = enrichPayloadWithCalculatedBmr(validateCreateCard(body));
  logger.info('[handleCreateCard] ✅ Validation passed', { 
    createdBy: payload.createdBy, 
    phoneNumber: payload.phoneNumber,
    name: payload.name 
  });

  if (!canCreateCard({ isCoach: true })) {
    throw new ValidationError(403, 'Not authorised to create a body-parameters card');
  }

  let userId = payload.userId;
  /** True when createTeamMemberFromPhone inserted a brand-new team_table row. */
  let isNewMember = false;

  if (payload.phoneNumber) {
    logger.info('[body-params-card] 📞 Creating team_table member from phone', {
      createdBy: payload.createdBy,
      phoneNumber: payload.phoneNumber,
      name: payload.name
    });
    // CoachId is not set here — member chooses coach during onboarding.
    // counsellorId is only used to detach legacy wrong CoachId assignments.
    const { userId: memberId, isNew } = await createTeamMemberFromPhone({
      name:          payload.name,
      phoneNumber:   payload.phoneNumber,
      counsellorId:  payload.createdBy,
      heightCm:      payload.heightCm,
      bmr:           payload.bmr,
      weightKg:      payload.weightKg,
      fatPercent:    payload.fatPercent,
    });
    userId = memberId;
    isNewMember = Boolean(isNew);
    logger.info('[body-params-card] ✅ Team member ready', { userId, isNew: isNewMember, type: typeof userId });
  }

  // Check if user already has a card
  const existingCard = userId ? await findLatestCardByUserId(userId) : null;
  logger.info('[handleCreateCard] 🔍 Checking for existing card', { 
    userId, 
    existingCardId: existingCard?.id || 'none' 
  });

  let card;
  if (existingCard) {
    // UPDATE existing card (override)
    logger.info('[body-params-card] 🔄 UPDATING existing card', { cardId: existingCard.id, userId });
    card = await updateCard(existingCard.id, {
      name:         payload.name,
      age:          payload.age,
      gender:       payload.gender,
      heightCm:     payload.heightCm,
      weightKg:     payload.weightKg,
      bmi:          payload.bmi,
      fatPercent:   payload.fatPercent,
      bmr:          payload.bmr,
      bodyAge:      payload.bodyAge,
      visceralFat:  payload.visceralFat,
      chestCm:      payload.chestCm,
      waistCm:      payload.waistCm,
      hipCm:        payload.hipCm,
      recordedDate: payload.recordedDate,
      locationName: payload.locationName,
    });
    logger.info('[body-params-card] ✅ Card updated', { cardId: card.id, created_by: card.created_by });
    if (userId && !card.user_id) {
      await linkCardToUser(card.id, userId);
      card.user_id = userId;
    }
  } else {
    // CREATE new card
    logger.info('[body-params-card] 🆕 CREATING new card', { userId, createdBy: payload.createdBy });
    card = await insertCard({ ...payload, userId });
    logger.info('[body-params-card] ✅ Card created', { 
      cardId: card.id, 
      created_by: card.created_by,
      user_id: card.user_id,
      type_created_by: typeof card.created_by
    });
  }

  invalidateBpcListCache(payload.createdBy ?? card.created_by);

  const linkPayload = {
    phoneNumber:   payload.phoneNumber,
    name:          payload.name,
    counsellorId:  payload.createdBy,
    heightCm:      payload.heightCm,
    bmr:           payload.bmr,
    weightKg:      payload.weightKg,
    fatPercent:    payload.fatPercent,
  };

  let syncResult = { synced: false, userId: card.user_id ?? userId ?? null };
  try {
    syncResult = await syncCardToProfileAfterSave(card, linkPayload);
    if (syncResult.userId) card.user_id = syncResult.userId;
  } catch (syncErr) {
    logger.error('[handleCreateCard] profile sync failed', {
      cardId: card.id,
      userId: card.user_id,
      message: syncErr?.message,
    });
    throw syncErr;
  }

  const linkedUserId = card.user_id ?? userId ?? null;
  if (linkedUserId) {
    try {
      await enforceBpcLeadNoCoachUntilOnboarding(linkedUserId);
    } catch (detachErr) {
      logger.error('[handleCreateCard] BPC lead CoachId enforcement failed', {
        userId: linkedUserId,
        message: detachErr?.message,
      });
      throw detachErr;
    }
  }

  // Fetch the previous card for this user so the frontend can show the
  // CURRENT vs PREV vs REFERENCE 3-column layout on the share card.
  const previousCard = userId
    ? await findPreviousCardByUserId(userId, card.id)
    : null;

  const phoneNumber = card.user_id
    ? await findTeamPhoneByUserId(card.user_id)
    : (payload.phoneNumber || null);

  // Final pass — body_parameters_cards insert may fire a DB trigger that re-sets CoachId.
  const finalUserId = card.user_id ?? userId ?? null;
  if (finalUserId) {
    await enforceBpcLeadNoCoachUntilOnboarding(finalUserId);
  }

  return {
    httpStatus: existingCard ? 200 : 201,
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
        recoveredHealthIssues: Array.isArray(card.recovered_health_issues)
          ? card.recovered_health_issues
          : (payload.recoveredHealthIssues || []),
        phoneNumber:      phoneNumber || payload.phoneNumber || null,
        userId:           card.user_id ?? userId ?? null,
        profileSynced:    syncResult.synced,
        isNewMember,
        previousCard,
      },
    },
  };
}
