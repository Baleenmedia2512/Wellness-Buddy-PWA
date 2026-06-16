/**
 * card.repo.js — Data layer for body_parameters_cards.
 * The ONLY place in this feature that talks to Supabase.
 */
import { getSupabaseClient, getISTTimestamp } from '../../../utils/supabaseClient.js';
import { canonicalPhoneForStorage, buildPhoneLookupVariants } from '../../auth/domain/phone-identity.rules.js';
import { buildTeamMemberInsert } from '../domain/card.rules.js';
import logger from '../../../shared/lib/logger.js';

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
 * Update an existing body-parameters card by id.
 * @param {number} id
 * @param {object} payload - validated + coerced from validateUpdateCard
 * @returns {object} updated row
 */
export async function updateCard(id, payload) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TABLE)
    .update({
      name:          payload.name,
      age:           payload.age,
      gender:        payload.gender,
      height_cm:     payload.heightCm,
      weight_kg:     payload.weightKg,
      bmi:           payload.bmi,
      fat_percent:   payload.fatPercent,
      bmr:           payload.bmr,
      body_age:      payload.bodyAge,
      recorded_date: payload.recordedDate,
      location_name: payload.locationName,
    })
    .eq('id', id)
    .eq('is_deleted', false)
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

/**
 * Read PhoneNumber from team_table for a linked member.
 * @param {number} userId
 * @returns {Promise<string|null>}
 */
export async function findTeamPhoneByUserId(userId) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('team_table')
    .select('PhoneNumber')
    .eq('UserId', userId)
    .maybeSingle();
  if (error) throw error;
  const phone = data?.PhoneNumber;
  return phone && String(phone).trim() ? String(phone).trim() : null;
}

/**
 * Find an existing team member by phone, or create a new team_table row.
 * Used when a coach enters a phone number on a body-parameters card.
 *
 * @param {{ name: string, phoneNumber: string, coachId: number, heightCm?: number|null, bmr?: number|null }} input
 * @returns {Promise<number>} UserId
 */
export async function findOrCreateTeamMember({ name, phoneNumber, coachId, heightCm, bmr }) {
  const supabase = getSupabaseClient();
  const storedPhone = canonicalPhoneForStorage(phoneNumber);

  for (const variant of buildPhoneLookupVariants(phoneNumber)) {
    const { data, error } = await supabase
      .from('team_table')
      .select('UserId')
      .eq('PhoneNumber', variant)
      .order('UserId', { ascending: true })
      .limit(1);
    if (error) throw error;
    if (data?.[0]?.UserId) return data[0].UserId;
  }

  const memberFields = buildTeamMemberInsert({ name, coachId, heightCm, bmr });
  const now = getISTTimestamp();
  const insertPayload = {
    EntryDateTime: now,
    LastActiveAt: now,
    EntryUser: 'Body Parameters Card',
    UserName: memberFields.UserName,
    Password: 'User@123#',
    TargetWeightInKg: 0,
    Status: 'Active',
    CoachApproved: 0,
    PhoneNumber: storedPhone,
    CoachId: memberFields.CoachId,
    ...(memberFields.Height != null ? { Height: memberFields.Height } : {}),
    ...(memberFields.Bmr != null ? { Bmr: memberFields.Bmr } : {}),
  };

  const { data, error } = await supabase
    .from('team_table')
    .insert(insertPayload)
    .select('UserId')
    .single();

  if (!error) {
    logger.info('[body-params-card] created team_table member', { userId: data.UserId });
    return data.UserId;
  }

  if (error.code === '23505') {
    for (const variant of buildPhoneLookupVariants(phoneNumber)) {
      const { data: existing, error: lookupErr } = await supabase
        .from('team_table')
        .select('UserId')
        .eq('PhoneNumber', variant)
        .order('UserId', { ascending: true })
        .limit(1);
      if (lookupErr) throw lookupErr;
      if (existing?.[0]?.UserId) return existing[0].UserId;
    }
  }

  throw error;
}

/**
 * Link a card to a team member after phone resolution.
 * @param {number} cardId
 * @param {number} userId
 */
export async function linkCardToUser(cardId, userId) {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from(TABLE)
    .update({ user_id: userId })
    .eq('id', cardId)
    .eq('is_deleted', false);
  if (error) throw error;
}
