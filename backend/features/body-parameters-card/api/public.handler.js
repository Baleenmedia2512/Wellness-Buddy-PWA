/**
 * public.handler.js — Resolves a card by share token for the public link.
 * Also handles the profile-save path (POST with requestingUserId).
 */
import { validateToken } from '../validation/card.schema.js';
import { isCardShareValid } from '../domain/card.rules.js';
import { canSaveCardToProfile } from '../domain/permissions/card.policy.js';
import { findCardByToken, findTeamPhoneByUserId } from '../data/card.repo.js';
import { syncCardToProfile } from '../data/sync.repo.js';

/**
 * GET: resolve card by token for public display.
 * @param {string} token
 * @returns {{ httpStatus: number, body: object }}
 */
export async function handleGetPublicCard(token) {
  const t = validateToken(token);
  const card = await findCardByToken(t);

  if (!card) {
    return { httpStatus: 404, body: { success: false, error: { code: 'NOT_FOUND', message: 'Card not found' } } };
  }

  if (!isCardShareValid(card.share_expires_at)) {
    return { httpStatus: 410, body: { success: false, error: { code: 'EXPIRED', message: 'This card link has expired' } } };
  }

  return {
    httpStatus: 200,
    body: { success: true, data: await _safeCard(card) },
  };
}

/**
 * POST: save card data to the requesting user's profile.
 * Silent override if userId matches; 403 otherwise.
 *
 * @param {string} token
 * @param {number} requestingUserId - from authenticated session
 * @returns {{ httpStatus: number, body: object }}
 */
export async function handleSaveCardToProfile(token, requestingUserId) {
  const t = validateToken(token);
  const card = await findCardByToken(t);

  if (!card) {
    return { httpStatus: 404, body: { success: false, error: { code: 'NOT_FOUND', message: 'Card not found' } } };
  }

  if (!isCardShareValid(card.share_expires_at)) {
    return { httpStatus: 410, body: { success: false, error: { code: 'EXPIRED', message: 'This card link has expired' } } };
  }

  if (!canSaveCardToProfile(card.user_id, requestingUserId)) {
    // Card belongs to a different user — show card read-only, no save.
    return {
      httpStatus: 200,
      body: { success: true, data: await _safeCard(card), saved: false,
              message: 'Card viewed as read-only (belongs to a different account)' },
    };
  }

  // Reuse shared card→profile sync (compare-before-write; no circular path).
  const cardForSync = { ...card, user_id: requestingUserId };
  const syncResult = await syncCardToProfile(cardForSync);

  return {
    httpStatus: 200,
    body: {
      success: true,
      data: await _safeCard(card),
      saved: true,
      synced: syncResult.synced,
    },
  };
}

// ── private ───────────────────────────────────────────────────────────────────

async function _safeCard(card) {
  const phoneNumber = card.user_id
    ? await findTeamPhoneByUserId(card.user_id)
    : null;

  return {
    id:           card.id,
    name:         card.name,
    age:          card.age,
    gender:       card.gender,
    heightCm:     card.height_cm,
    weightKg:     card.weight_kg,
    bmi:          card.bmi,
    fatPercent:   card.fat_percent,
    bmr:          card.bmr,
    bodyAge:      card.body_age,
    visceralFat:  card.visceral_fat,
    chestCm:      card.chest_cm,
    waistCm:      card.waist_cm,
    hipCm:        card.hip_cm,
    recordedDate: card.recorded_date,
    locationName: card.location_name,
    recoveredHealthIssues: Array.isArray(card.recovered_health_issues)
      ? card.recovered_health_issues
      : [],
    phoneNumber,
    userId:       card.user_id,
    createdAt:    card.created_at,
  };
}
