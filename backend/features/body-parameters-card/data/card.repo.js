/**
 * card.repo.js — Data layer for body_parameters_cards.
 * The ONLY place in this feature that talks to Supabase.
 */
import { getSupabaseClient } from '../../../utils/supabaseClient.js';

const TABLE = 'body_parameters_cards';

/**
 * Insert a new body-parameters card.
 * @param {object} payload - validated + coerced from card.schema.js
 * @returns {object} inserted row
 */
export async function insertCard(payload) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      created_by:   payload.createdBy,
      user_id:      payload.userId,
      name:         payload.name,
      age:          payload.age,
      gender:       payload.gender,
      height_cm:    payload.heightCm,
      weight_kg:    payload.weightKg,
      bmi:          payload.bmi,
      fat_percent:  payload.fatPercent,
      bmr:          payload.bmr,
      body_age:     payload.bodyAge,
      recorded_date: payload.recordedDate,
      location_name: payload.locationName,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Find an unexpired card by its public share token.
 * Returns null when not found or expired.
 *
 * @param {string} token - UUID
 * @returns {object|null}
 */
export async function findCardByToken(token) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select(
      'id, created_by, user_id, public_share_token, share_expires_at, ' +
      'name, age, gender, height_cm, weight_kg, bmi, fat_percent, bmr, ' +
      'body_age, recorded_date, location_name, created_at'
    )
    .eq('public_share_token', token)
    .eq('is_deleted', false)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}
