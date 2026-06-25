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
      visceral_fat: payload.visceralFat,
      chest_cm:     payload.chestCm,
      waist_cm:     payload.waistCm,
      hip_cm:       payload.hipCm,
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
      visceral_fat:  payload.visceralFat,
      chest_cm:      payload.chestCm,
      waist_cm:      payload.waistCm,
      hip_cm:        payload.hipCm,
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
      'body_age, visceral_fat, chest_cm, waist_cm, hip_cm, recorded_date, location_name, created_at'
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
 * Create a new team_table row from the phone the coach entered.
 * Checks if phone exists first; if yes, UPDATES the member.
 * If no, creates a new member. This avoids duplicate key errors.
 *
 * @param {{ name: string, phoneNumber: string, coachId: number, heightCm?: number|null, bmr?: number|null }} input
 * @returns {Promise<{ userId: number, isNew: boolean }>}
 */
export async function createTeamMemberFromPhone({ name, phoneNumber, coachId, heightCm, bmr }) {
  const supabase = getSupabaseClient();
  const storedPhone = canonicalPhoneForStorage(phoneNumber);

  // STEP 1: Check if phone number already exists (search all variants)
  let existingUserId = null;
  for (const variant of buildPhoneLookupVariants(phoneNumber)) {
    const { data: existing, error: lookupErr } = await supabase
      .from('team_table')
      .select('UserId')
      .eq('PhoneNumber', variant)
      .order('UserId', { ascending: true })
      .limit(1);
    
    if (lookupErr) throw lookupErr;
    
    if (existing?.[0]?.UserId) {
      existingUserId = existing[0].UserId;
      break; // Found existing member
    }
  }

  // STEP 2: If phone exists, UPDATE existing member
  if (existingUserId) {
    const updatePatch = {};
    if (name && String(name).trim()) updatePatch.UserName = String(name).trim();
    if (heightCm != null) updatePatch.Height = heightCm;
    if (bmr != null) updatePatch.Bmr = bmr;
    
    if (Object.keys(updatePatch).length > 0) {
      const { error: updateErr } = await supabase
        .from('team_table')
        .update(updatePatch)
        .eq('UserId', existingUserId);
      
      if (updateErr) {
        logger.warn('[body-params-card] failed to update existing member profile', {
          userId: existingUserId, updateErr,
        });
      }
    }
    
    logger.info('[body-params-card] phone exists in team_table, updated and reusing', {
      userId: existingUserId, updated: Object.keys(updatePatch).length > 0
    });
    return { userId: existingUserId, isNew: false };
  }

  // STEP 3: Phone doesn't exist, CREATE new member
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
    Role: 'user',
    ...(memberFields.Height != null ? { Height: memberFields.Height } : {}),
    ...(memberFields.Bmr != null ? { Bmr: memberFields.Bmr } : {}),
  };

  const { data, error } = await supabase
    .from('team_table')
    .insert(insertPayload)
    .select('UserId')
    .single();

  if (error) throw error;

  logger.info('[body-params-card] created new team_table member', { userId: data.UserId });
  return { userId: data.UserId, isNew: true };
}

/** @deprecated Use createTeamMemberFromPhone */
export const findOrCreateTeamMember = async (input) => {
  const { userId } = await createTeamMemberFromPhone(input);
  return userId;
};

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

/**
 * Search team_table rows by phone number prefix, scoped to a specific coach. * Returns up to 10 matches ordered by UserId ascending.
 *
 * @param {{ prefix: string, coachId: number }} opts
 * @returns {Promise<Array<{ userId: number, userName: string, phoneNumber: string, heightCm: number|null, bmr: number|null }>>}
 */
export async function searchTeamPhonesByPrefix({ prefix, coachId }) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('team_table')
    .select('UserId, UserName, PhoneNumber, Height, Bmr')
    .eq('CoachId', coachId)
    .like('PhoneNumber', `${prefix}%`)
    .eq('Status', 'Active')
    .order('UserId', { ascending: true })
    .limit(10);

  if (error) throw error;
  if (!data) return [];

  // Deduplicate by PhoneNumber (keep lowest UserId)
  const seen = new Set();
  const results = [];
  for (const row of data) {
    const phone = String(row.PhoneNumber || '').trim();
    if (!phone || seen.has(phone)) continue;
    seen.add(phone);
    results.push({
      userId:      row.UserId,
      userName:    row.UserName || '',
      phoneNumber: phone,
      heightCm:    row.Height ?? null,
      bmr:         row.Bmr    ?? null,
    });
  }
  return results;
}

/**
 * Find the latest card for a user (to check if card already exists).
 * @param {number} userId
 * @returns {Promise<object|null>}
 */
export async function findLatestCardByUserId(userId) {
  if (!userId) return null;
  const supabase = getSupabaseClient();
  const { data, error} = await supabase
    .from(TABLE)
    .select('id')
    .eq('user_id', userId)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) throw error;
  if (!data || data.length === 0) return null;
  return data[0];
}

/**
 * Find the most recent previous card for a given user, excluding the current card.
 * Returns null when no prior card exists (fresh user).
 *
 * @param {number} userId
 * @param {number} excludeCardId - the card just created/updated (exclude it)
 * @returns {Promise<object|null>}
 */
export async function findPreviousCardByUserId(userId, excludeCardId) {
  if (!userId) return null;
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select('id, weight_kg, bmi, fat_percent, body_age, chest_cm, waist_cm, hip_cm, recorded_date')
    .eq('user_id', userId)
    .neq('id', excludeCardId)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) throw error;
  if (!data || data.length === 0) return null;

  const row = data[0];
  return {
    id:           row.id,
    weightKg:     row.weight_kg     ?? null,
    bmi:          row.bmi           ?? null,
    fatPercent:   row.fat_percent   ?? null,
    bodyAge:      row.body_age      ?? null,
    chestCm:      row.chest_cm      ?? null,
    waistCm:      row.waist_cm      ?? null,
    hipCm:        row.hip_cm        ?? null,
    recordedDate: row.recorded_date ?? null,
  };
}

/**
 * List all body parameter cards for a coach's team members
 * Returns cards sorted by created_at DESC (latest first)
 *
 * @param {string} coachId - UUID of the coach
 * @returns {Promise<Array>}
 */
export async function listCardsForCoach(coachId) {
  const supabase = getSupabaseClient();
  
  logger.info('[listCardsForCoach] 🔍 QUERYING DATABASE', { coachId, type: typeof coachId });
  
  // Directly query cards created by this coach
  const { data: cards, error: cardsError } = await supabase
    .from(TABLE)
    .select('*')
    .eq('created_by', coachId)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false });

  if (cardsError) {
    logger.error('[listCardsForCoach] 💥 DATABASE ERROR:', cardsError);
    throw cardsError;
  }
  if (!cards) {
    logger.warn('[listCardsForCoach] ⚠️ No cards returned (null/undefined)');
    return [];
  }
  
  logger.info('[listCardsForCoach] 🎯 RAW QUERY RESULT', { 
    coachId, 
    cardCount: cards.length,
    cards: cards.map(c => ({ 
      id: c.id, 
      name: c.name, 
      created_by: c.created_by,
      user_id: c.user_id,
      visceral_fat: c.visceral_fat
    }))
  });

  // Get team member info for phone numbers (optional - card has name already)
  const userIds = cards.map(c => c.user_id).filter(Boolean);
  let teamMembersMap = {};
  
  if (userIds.length > 0) {
    logger.info('[listCardsForCoach] 📞 Fetching phone numbers for userIds:', userIds);
    const { data: teamMembers } = await supabase
      .from('team_table')
      .select('UserId, PhoneNumber')
      .in('UserId', userIds);
    
    if (teamMembers) {
      teamMembersMap = Object.fromEntries(
        teamMembers.map(m => [m.UserId, m])
      );
      logger.info('[listCardsForCoach] ✅ Phone numbers fetched', { count: teamMembers.length });
    }
  }

  // Map cards with optional phone number from team_table
  const mappedCards = cards.map(card => {
    const member = teamMembersMap[card.user_id];
    return {
      id:           card.id,
      userId:       card.user_id,
      name:         card.name,
      phoneNumber:  member?.PhoneNumber || null,
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
      createdAt:    card.created_at,
      createdBy:    card.created_by,
    };
  });
  
  logger.info('[listCardsForCoach] 📦 RETURNING MAPPED CARDS', { 
    count: mappedCards.length,
    sample: mappedCards[0] 
  });
  
  return mappedCards;
}
