/**
 * public.handler.js — Resolves a card by share token for the public link.
 * Also handles the profile-save path (POST with requestingUserId).
 */
import { validateToken } from '../validation/card.schema.js';
import { isCardShareValid, buildProfilePatch, buildWeightRecord } from '../domain/card.rules.js';
import { canSaveCardToProfile } from '../domain/permissions/card.policy.js';
import { findCardByToken, findTeamPhoneByUserId } from '../data/card.repo.js';
import { getSupabaseClient } from '../../../utils/supabaseClient.js';
import { ValidationError } from '../../../shared/lib/ValidationError.js';

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

  const supabase = getSupabaseClient();

  // 1. Update team_table (height + BMR) — reuse existing update pattern.
  const profilePatch = buildProfilePatch(card);
  const profileUpdates = {};
  if (profilePatch.height !== null) profileUpdates.Height = profilePatch.height;
  if (profilePatch.bmr    !== null) profileUpdates.Bmr    = profilePatch.bmr;

  if (Object.keys(profileUpdates).length > 0) {
    const { error: profileErr } = await supabase
      .from('team_table')
      .update(profileUpdates)
      .eq('UserId', parseInt(requestingUserId));
    if (profileErr) throw profileErr;
  }

  // 2. Insert weight record if weight is present on the card.
  const weightRow = buildWeightRecord(card, requestingUserId);
  if (weightRow) {
    const { error: weightErr } = await supabase
      .from('weight_records_table')
      .insert(weightRow);
    if (weightErr) throw weightErr;
  }

  return {
    httpStatus: 200,
    body: { success: true, data: await _safeCard(card), saved: true },
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
    phoneNumber,
    userId:       card.user_id,
    createdAt:    card.created_at,
  };
}
