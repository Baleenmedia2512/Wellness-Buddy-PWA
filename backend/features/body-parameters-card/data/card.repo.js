/**
 * card.repo.js — Data layer for body_parameters_cards.
 * The ONLY place in this feature that talks to Supabase.
 */
import { getSupabaseClient } from '../../../utils/supabaseClient.js';
import { assertViewerCanAccessMember } from '../../../utils/reportingHierarchyService.js';
import { nowUtc } from '../../../shared/lib/datetime/index.js';
import { canonicalPhoneForStorage, buildPhoneLookupVariants } from '../../auth/domain/phone-identity.rules.js';
import {
  buildTeamMemberInsert,
  computeBmiFromHeightWeight,
  shouldClearBpcLeadCoachId,
  isMemberActivatedForBcmExclusion,
  BCM_ACTIVATED_MEMBER_MESSAGE,
} from '../domain/card.rules.js';
import { getLatestWeight, getLatestWeightBodyFat, getLatestWeightMetricsByUserIds } from '../../user/user.repository.js';
import logger from '../../../shared/lib/logger.js';
import { ValidationError } from '../../../shared/lib/ValidationError.js';

const TABLE = 'body_parameters_cards';
const APPROVALS = 'approval_requests_table';

/**
 * Insert a new body-parameters card.
 * @param {object} payload - validated + coerced from card.schema.js
 * @returns {object} inserted row
 */
export async function insertCard(payload) {
  const supabase = getSupabaseClient();
  const locationName = payload.locationName != null && String(payload.locationName).trim() !== ''
    ? String(payload.locationName).trim().substring(0, 200)
    : null;

  const row = {
    created_by:    payload.createdBy,
    user_id:       payload.userId,
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
    location_name: locationName,
    recovered_health_issues: Array.isArray(payload.recoveredHealthIssues)
      ? payload.recoveredHealthIssues
      : [],
  };
  // Only set recorded_date when provided — otherwise DB DEFAULT CURRENT_DATE applies.
  if (payload.recordedDate) {
    row.recorded_date = payload.recordedDate;
  }

  const { data, error } = await supabase.from(TABLE).insert(row).select().single();

  if (error && /recovered_health_issues/i.test(String(error.message || ''))) {
    logger.error('[body-params-card] recovered_health_issues column missing — run migration add_health_issues_to_body_parameters_cards.sql', {
      message: error.message,
    });
    throw new Error(
      'Health issues cannot be saved: database column recovered_health_issues is missing. '
      + 'Run backend/migrations/add_health_issues_to_body_parameters_cards.sql in Supabase.',
    );
  }

  if (error && /location_name/i.test(String(error.message || ''))) {
    logger.error('[body-params-card] location_name column missing — Venue cannot be saved. Run migration add_location_name_to_body_parameters_cards.sql', {
      message: error.message,
    });
    throw new Error(
      'Venue cannot be saved: database column location_name is missing. '
      + 'Run backend/migrations/add_location_name_to_body_parameters_cards.sql in Supabase.',
    );
  }

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

  const { data: existingRow, error: existingErr } = await supabase
    .from(TABLE)
    .select('id, user_id')
    .eq('id', id)
    .eq('is_deleted', false)
    .maybeSingle();
  if (existingErr) throw existingErr;
  if (!existingRow) {
    throw new ValidationError(404, 'Card not found');
  }
  if (existingRow.user_id && await isUserActivatedForBcm(existingRow.user_id)) {
    await rejectBcmForActivatedMember(existingRow.user_id);
  }

  const locationName = payload.locationName != null && String(payload.locationName).trim() !== ''
    ? String(payload.locationName).trim().substring(0, 200)
    : null;

  const patch = {
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
    location_name: locationName,
    recovered_health_issues: Array.isArray(payload.recoveredHealthIssues)
      ? payload.recoveredHealthIssues
      : [],
  };

  const { data, error } = await supabase
    .from(TABLE)
    .update(patch)
    .eq('id', id)
    .eq('is_deleted', false)
    .select()
    .single();

  if (error && /recovered_health_issues/i.test(String(error.message || ''))) {
    logger.error('[body-params-card] recovered_health_issues column missing — run migration add_health_issues_to_body_parameters_cards.sql', {
      message: error.message,
    });
    throw new Error(
      'Health issues cannot be saved: database column recovered_health_issues is missing. '
      + 'Run backend/migrations/add_health_issues_to_body_parameters_cards.sql in Supabase.',
    );
  }

  if (error && /location_name/i.test(String(error.message || ''))) {
    logger.error('[body-params-card] location_name column missing — Venue cannot be saved. Run migration add_location_name_to_body_parameters_cards.sql', {
      message: error.message,
    });
    throw new Error(
      'Venue cannot be saved: database column location_name is missing. '
      + 'Run backend/migrations/add_location_name_to_body_parameters_cards.sql in Supabase.',
    );
  }

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
      'body_age, visceral_fat, chest_cm, waist_cm, hip_cm, recorded_date, location_name, ' +
      'recovered_health_issues, created_at'
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
 * Whether this member has ever completed coach selection via OTP approval.
 * @param {number} userId
 * @returns {Promise<boolean>}
 */
export async function hasApprovedCoachSelection(userId) {
  const uid = parseInt(userId, 10);
  if (!Number.isFinite(uid) || uid < 1) return false;
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(APPROVALS)
    .select('"Id"')
    .eq('"RequesterId"', uid)
    .eq('"Status"', 'approved')
    .limit(1);
  if (error) {
    logger.warn('[body-params-card] approved coach-selection lookup failed', {
      userId: uid,
      message: error.message,
    });
    // Fail open for BPC cleanup — without OTP approval we must not keep CoachId.
    return false;
  }
  return Boolean(data?.[0]?.Id);
}

/**
 * Activated for BCM exclusion = approved coach/sponsor OTP (implies logged-in member).
 * @param {number} userId
 * @returns {Promise<boolean>}
 */
export async function isUserActivatedForBcm(userId) {
  const approved = await hasApprovedCoachSelection(userId);
  return isMemberActivatedForBcmExclusion({ hasApprovedCoachSelection: approved });
}

/**
 * Hard-delete every body_parameters_cards row linked to this member (all creators).
 * Activation lock remains via OTP approval — delete does not reopen BCM for the phone.
 *
 * @param {number} userId
 * @returns {Promise<{ deleted: number, createdByIds: number[] }>}
 */
export async function hardDeleteCardsForUserId(userId) {
  const uid = parseInt(userId, 10);
  if (!Number.isFinite(uid) || uid < 1) return { deleted: 0, createdByIds: [] };

  const supabase = getSupabaseClient();
  const { data: existing, error: selectErr } = await supabase
    .from(TABLE)
    .select('id, created_by')
    .eq('user_id', uid);
  if (selectErr) throw selectErr;

  const rows = existing || [];
  if (rows.length === 0) return { deleted: 0, createdByIds: [] };

  const createdByIds = [
    ...new Set(
      rows
        .map((r) => parseInt(r.created_by, 10))
        .filter((n) => Number.isFinite(n) && n > 0),
    ),
  ];

  const { error: deleteErr } = await supabase
    .from(TABLE)
    .delete()
    .eq('user_id', uid);
  if (deleteErr) throw deleteErr;

  for (const coachId of createdByIds) {
    invalidateBpcListCache(coachId);
  }

  logger.info('[body-params-card] hard-deleted BCM cards for activated member', {
    userId: uid,
    deleted: rows.length,
    createdByIds,
  });

  return { deleted: rows.length, createdByIds };
}

/**
 * After coach OTP approval: remove all BCM records for this member.
 * Safe to call even when no cards exist.
 *
 * @param {number} userId
 * @returns {Promise<{ deleted: number, createdByIds: number[] }>}
 */
export async function purgeBcmCardsForActivatedMember(userId) {
  return hardDeleteCardsForUserId(userId);
}

/**
 * @param {number[]} userIds
 * @returns {Promise<Set<number>>} userIds that are activated for BCM exclusion
 */
async function findActivatedUserIdsAmong(userIds) {
  const activated = new Set();
  const ids = [...new Set(
    (userIds || [])
      .map((id) => parseInt(id, 10))
      .filter((n) => Number.isFinite(n) && n > 0),
  )];
  if (ids.length === 0) return activated;

  const supabase = getSupabaseClient();
  const CHUNK = 200;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    const { data, error } = await supabase
      .from(APPROVALS)
      .select('"RequesterId"')
      .in('"RequesterId"', chunk)
      .eq('"Status"', 'approved');
    if (error) {
      logger.warn('[body-params-card] batch activated lookup failed', {
        message: error.message,
      });
      continue;
    }
    for (const row of data || []) {
      const rid = parseInt(row.RequesterId, 10);
      if (Number.isFinite(rid) && rid > 0) activated.add(rid);
    }
  }
  return activated;
}

/**
 * Reject BCM when the phone belongs to an activated member: hard-delete cards, then throw.
 * @param {number} userId
 */
async function rejectBcmForActivatedMember(userId) {
  try {
    await hardDeleteCardsForUserId(userId);
  } catch (purgeErr) {
    logger.error('[body-params-card] failed to purge cards before activated reject', {
      userId,
      message: purgeErr?.message,
    });
  }
  throw new ValidationError(409, BCM_ACTIVATED_MEMBER_MESSAGE);
}

/**
 * Force CoachId = null on BPC leads that have not completed coach OTP onboarding.
 * Handles legacy rows, stale API processes, and any DB-side default/trigger.
 *
 * @param {number|null|undefined} userId
 * @returns {Promise<boolean>} true when CoachId was cleared
 */
export async function enforceBpcLeadNoCoachUntilOnboarding(userId) {
  const uid = parseInt(userId, 10);
  if (!Number.isFinite(uid) || uid < 1) return false;

  const supabase = getSupabaseClient();
  const { data: member, error } = await supabase
    .from('team_table')
    .select('"UserId", "CoachId", "EntryUser", "SetupSkipped"')
    .eq('"UserId"', uid)
    .maybeSingle();
  if (error) throw error;
  if (!member) return false;

  const approved = await hasApprovedCoachSelection(uid);
  if (
    !shouldClearBpcLeadCoachId({
      currentCoachId: member.CoachId,
      entryUser: member.EntryUser,
      setupSkipped: member.SetupSkipped,
      hasApprovedCoachSelection: approved,
    })
  ) {
    return false;
  }

  const previousCoachId = member.CoachId;
  const { data: updated, error: updateErr } = await supabase
    .from('team_table')
    .update({ CoachId: null })
    .eq('"UserId"', uid)
    .select('"UserId", "CoachId", "EntryUser"')
    .maybeSingle();
  if (updateErr) throw updateErr;
  if (!updated) {
    throw new Error(`[bpc] CoachId clear affected 0 rows for UserId ${uid}`);
  }
  if (updated.CoachId != null && updated.CoachId !== '') {
    throw new Error(
      `[bpc] CoachId still ${updated.CoachId} after clear for UserId ${uid} — check Supabase triggers on team_table / body_parameters_cards`,
    );
  }

  logger.info('[body-params-card] cleared stale BPC lead CoachId', {
    userId: uid,
    previousCoachId,
  });
  return true;
}

/** @deprecated Use enforceBpcLeadNoCoachUntilOnboarding */
export async function clearLegacyCounsellorCoachAssignment(userId, _counsellorId) {
  return enforceBpcLeadNoCoachUntilOnboarding(userId);
}

/**
 * Look up team_table UserId by phone (all variants). Lowest UserId wins.
 * @param {string} phoneNumber
 * @returns {Promise<number|null>}
 */
export async function findTeamMemberIdByPhone(phoneNumber) {
  if (!phoneNumber || !String(phoneNumber).trim()) return null;
  const supabase = getSupabaseClient();
  for (const variant of buildPhoneLookupVariants(phoneNumber)) {
    const { data: existing, error: lookupErr } = await supabase
      .from('team_table')
      .select('"UserId"')
      .eq('PhoneNumber', variant)
      .order('UserId', { ascending: true })
      .limit(1);
    if (lookupErr) throw lookupErr;
    if (existing?.[0]?.UserId) return existing[0].UserId;
  }
  return null;
}

/**
 * Whether this phone belongs to an activated member (BCM blocked).
 * When not activated, also returns the latest saved BCM card fields so the form
 * can restore name/venue/height/etc. (prefer this coach's card, else any).
 *
 * @param {string} phoneNumber
 * @param {{ coachId?: number|null }} [opts]
 * @returns {Promise<{ activated: boolean, userId: number|null, existingCard: object|null }>}
 */
export async function getBcmPhoneActivationStatus(phoneNumber, { coachId = null } = {}) {
  const userId = await findTeamMemberIdByPhone(phoneNumber);
  if (!userId) return { activated: false, userId: null, existingCard: null };

  const activated = await isUserActivatedForBcm(userId);
  if (activated) {
    return { activated: true, userId, existingCard: null };
  }

  const coachIdN = parseInt(coachId, 10);
  let card = null;
  if (Number.isFinite(coachIdN) && coachIdN > 0) {
    card = await findLatestFullCardByUserIdAndCreatedBy(userId, coachIdN);
  }
  if (!card) {
    card = await findLatestFullCardByUserId(userId);
  }

  return {
    activated: false,
    userId,
    existingCard: mapFullCardRowToPrefill(card, phoneNumber),
  };
}

function mapFullCardRowToPrefill(card, phoneNumber) {
  if (!card?.id) return null;
  const issues = Array.isArray(card.recovered_health_issues)
    ? card.recovered_health_issues.filter((x) => typeof x === 'string' && x.trim())
    : [];
  return {
    id: card.id,
    name: card.name ?? '',
    phoneNumber: phoneNumber || null,
    age: card.age ?? null,
    gender: card.gender ?? null,
    heightCm: card.height_cm ?? null,
    weightKg: card.weight_kg ?? null,
    bmi: card.bmi ?? null,
    fatPercent: card.fat_percent ?? null,
    bmr: card.bmr ?? null,
    bodyAge: card.body_age ?? null,
    visceralFat: card.visceral_fat ?? null,
    chestCm: card.chest_cm ?? null,
    waistCm: card.waist_cm ?? null,
    hipCm: card.hip_cm ?? null,
    locationName: card.location_name ?? null,
    recordedDate: card.recorded_date ?? null,
    recoveredHealthIssues: issues,
  };
}

const FULL_CARD_PREFILL_COLS = [
  'id', 'created_by', 'user_id', 'name', 'age', 'gender',
  'height_cm', 'weight_kg', 'bmi', 'fat_percent', 'bmr',
  'body_age', 'visceral_fat', 'chest_cm', 'waist_cm', 'hip_cm',
  'location_name', 'recorded_date', 'recovered_health_issues', 'created_at',
].join(', ');

/**
 * Latest non-deleted card for member + creating coach (own list visibility).
 * @param {number} userId
 * @param {number} createdBy
 * @returns {Promise<object|null>}
 */
export async function findLatestCardByUserIdAndCreatedBy(userId, createdBy) {
  const row = await findLatestFullCardByUserIdAndCreatedBy(userId, createdBy);
  return row ? { id: row.id } : null;
}

async function findLatestFullCardByUserIdAndCreatedBy(userId, createdBy) {
  const uid = parseInt(userId, 10);
  const cid = parseInt(createdBy, 10);
  if (!Number.isFinite(uid) || uid < 1 || !Number.isFinite(cid) || cid < 1) return null;

  const supabase = getSupabaseClient();
  let { data, error } = await supabase
    .from(TABLE)
    .select(FULL_CARD_PREFILL_COLS)
    .eq('user_id', uid)
    .eq('created_by', cid)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .limit(1);

  if (error && /recovered_health_issues/i.test(String(error.message || ''))) {
    ({ data, error } = await supabase
      .from(TABLE)
      .select(FULL_CARD_PREFILL_COLS.replace(', recovered_health_issues', ''))
      .eq('user_id', uid)
      .eq('created_by', cid)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .limit(1));
  }
  if (error && /location_name/i.test(String(error.message || ''))) {
    ({ data, error } = await supabase
      .from(TABLE)
      .select('id, created_by, user_id, name, age, gender, height_cm, weight_kg, bmi, fat_percent, bmr, body_age, visceral_fat, chest_cm, waist_cm, hip_cm, recorded_date, created_at')
      .eq('user_id', uid)
      .eq('created_by', cid)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .limit(1));
  }
  if (error) throw error;
  return data?.[0] || null;
}

async function findLatestFullCardByUserId(userId) {
  const uid = parseInt(userId, 10);
  if (!Number.isFinite(uid) || uid < 1) return null;

  const supabase = getSupabaseClient();
  let { data, error } = await supabase
    .from(TABLE)
    .select(FULL_CARD_PREFILL_COLS)
    .eq('user_id', uid)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .limit(1);

  if (error && /recovered_health_issues/i.test(String(error.message || ''))) {
    ({ data, error } = await supabase
      .from(TABLE)
      .select(FULL_CARD_PREFILL_COLS.replace(', recovered_health_issues', ''))
      .eq('user_id', uid)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .limit(1));
  }
  if (error && /location_name/i.test(String(error.message || ''))) {
    ({ data, error } = await supabase
      .from(TABLE)
      .select('id, created_by, user_id, name, age, gender, height_cm, weight_kg, bmi, fat_percent, bmr, body_age, visceral_fat, chest_cm, waist_cm, hip_cm, recorded_date, created_at')
      .eq('user_id', uid)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .limit(1));
  }
  if (error) throw error;
  return data?.[0] || null;
}

/**
 * Create a new team_table row from the phone entered on the body-params form.
 * Checks if phone exists first; if yes, UPDATES the member (name/height/BMR only).
 * If no, creates a new member with CoachId left null — coach is chosen at onboarding.
 * Never assigns CoachId from the counsellor. May clear a legacy wrong assignment
 * when counsellorId matches CoachId and the member never completed coach selection.
 *
 * @param {{ name: string, phoneNumber: string, counsellorId?: number|null, heightCm?: number|null, bmr?: number|null, weightKg?: number|null, fatPercent?: number|null }} input
 * @returns {Promise<{ userId: number, isNew: boolean }>}
 */
export async function createTeamMemberFromPhone({
  name,
  phoneNumber,
  counsellorId = null,
  heightCm,
  bmr,
  weightKg,
  fatPercent,
}) {
  const supabase = getSupabaseClient();
  const storedPhone = canonicalPhoneForStorage(phoneNumber);

  // STEP 1: Check if phone number already exists (search all variants)
  let existingMember = null;
  for (const variant of buildPhoneLookupVariants(phoneNumber)) {
    const { data: existing, error: lookupErr } = await supabase
      .from('team_table')
      .select('"UserId", "CoachId", "EntryUser", "SetupSkipped"')
      .eq('PhoneNumber', variant)
      .order('UserId', { ascending: true })
      .limit(1);
    
    if (lookupErr) throw lookupErr;
    
    if (existing?.[0]?.UserId) {
      existingMember = existing[0];
      break; // Found existing member
    }
  }

  // STEP 2: If phone exists, UPDATE existing member (never assign coach from counsellor)
  if (existingMember) {
    const existingUserId = existingMember.UserId;
    const approved = await hasApprovedCoachSelection(existingUserId);
    if (isMemberActivatedForBcmExclusion({ hasApprovedCoachSelection: approved })) {
      logger.info('[body-params-card] blocking BCM for activated member', {
        userId: existingUserId,
      });
      await rejectBcmForActivatedMember(existingUserId);
    }

    const updatePatch = {};
    if (name && String(name).trim()) updatePatch.UserName = String(name).trim();
    if (heightCm != null) updatePatch.Height = heightCm;
    if (bmr != null) updatePatch.Bmr = bmr;

    if (
      shouldClearBpcLeadCoachId({
        currentCoachId: existingMember.CoachId,
        entryUser: existingMember.EntryUser,
        setupSkipped: existingMember.SetupSkipped,
        hasApprovedCoachSelection: approved,
      })
    ) {
      updatePatch.CoachId = null;
      logger.info('[body-params-card] clearing stale BPC lead CoachId', {
        userId: existingUserId,
        previousCoachId: existingMember.CoachId,
      });
    }
    
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

  // STEP 3: Phone doesn't exist, CREATE new member (CoachId set later via onboarding)
  const memberFields = buildTeamMemberInsert({ name, heightCm, bmr, weightKg, fatPercent });
  const now = nowUtc();
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
    CoachId: null,
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

  // Belt-and-suspenders: old API builds / DB defaults may still set CoachId on insert.
  await enforceBpcLeadNoCoachUntilOnboarding(data.UserId);

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
 * Ensure a card row is linked to a team_table member (via phone).
 * Required before Profile sync — body_parameters_cards.user_id is the join key.
 *
 * @param {object} card - persisted card row
 * @param {{ phoneNumber?: string|null, name?: string, counsellorId?: number|null, heightCm?: number|null, bmr?: number|null, weightKg?: number|null, fatPercent?: number|null }} linkPayload
 * @returns {Promise<number|null>} linked UserId
 */
export async function ensureCardLinkedToUser(card, linkPayload = {}) {
  if (card?.user_id) return card.user_id;
  const phoneNumber = linkPayload.phoneNumber;
  if (!phoneNumber || !card?.id) return null;

  const { userId } = await createTeamMemberFromPhone({
    name:          linkPayload.name ?? card.name,
    phoneNumber,
    counsellorId:  linkPayload.counsellorId ?? card.created_by ?? null,
    heightCm:      linkPayload.heightCm ?? card.height_cm,
    bmr:           linkPayload.bmr ?? card.bmr,
    weightKg:      linkPayload.weightKg ?? card.weight_kg,
    fatPercent:    linkPayload.fatPercent ?? card.fat_percent,
  });
  await linkCardToUser(card.id, userId);
  logger.info('[body-params-card] linked card to team member', { cardId: card.id, userId });
  return userId;
}

/**
 * Latest body_parameters_cards row for Profile → Card sync.
 * Prefers user_id match; backfills user_id on a recent orphan with the same name.
 *
 * @param {number} userId
 * @returns {Promise<object|null>}
 */
export async function findLatestCardForProfileSync(userId) {
  const uid = parseInt(userId, 10);
  if (!Number.isFinite(uid) || uid < 1) return null;

  const supabase = getSupabaseClient();
  const cardSelect = 'id, name, height_cm, bmr, weight_kg, fat_percent, bmi, user_id, age, gender, visceral_fat, body_age, chest_cm, waist_cm, hip_cm';

  const { data: linkedRows, error: linkedErr } = await supabase
    .from(TABLE)
    .select(cardSelect)
    .eq('user_id', uid)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .limit(1);
  if (linkedErr) throw linkedErr;
  if (linkedRows?.[0]) return linkedRows[0];

  const { data: member, error: memberErr } = await supabase
    .from('team_table')
    .select('"UserName", "CoachId"')
    .eq('UserId', uid)
    .maybeSingle();
  if (memberErr) throw memberErr;

  const userName = member?.UserName ? String(member.UserName).trim() : '';
  if (!userName) return null;

  let orphanQuery = supabase
    .from(TABLE)
    .select(cardSelect)
    .is('user_id', null)
    .eq('is_deleted', false)
    .ilike('name', userName);
  const coachId = member?.CoachId != null ? parseInt(member.CoachId, 10) : null;
  if (Number.isFinite(coachId) && coachId > 0) {
    orphanQuery = orphanQuery.eq('created_by', coachId);
  }
  const { data: orphanRows, error: orphanErr } = await orphanQuery
    .order('created_at', { ascending: false })
    .limit(1);
  if (orphanErr) throw orphanErr;

  const orphan = orphanRows?.[0];
  if (!orphan) return null;

  await linkCardToUser(orphan.id, uid);
  return { ...orphan, user_id: uid };
}

/**
 * Latest body_parameters_cards row linked to a member (user_id match only).
 * Read-only profile display — no orphan name matching or auto-link side effects.
 *
 * @param {number} userId
 * @returns {Promise<object|null>}
 */
export async function findLatestLinkedBodyMetricsCard(userId) {
  const uid = parseInt(userId, 10);
  if (!Number.isFinite(uid) || uid < 1) return null;

  const supabase = getSupabaseClient();
  // Include weight_kg / fat_percent / bmr so Wellness Score + profile can resolve
  // BMR when team_table.Bmr is null but a linked BPC has composition data.
  const cardSelect =
    'id, user_id, age, gender, height_cm, weight_kg, fat_percent, bmr, visceral_fat, bmi, body_age, chest_cm, waist_cm, hip_cm';

  const { data, error } = await supabase
    .from(TABLE)
    .select(cardSelect)
    .eq('user_id', uid)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) throw error;
  return data?.[0] ?? null;
}

/**
 * Search team_table rows by phone number prefix, scoped to a specific coach. * Returns up to 10 matches ordered by UserId ascending.
 *
 * @param {{ prefix: string, coachId: number }} opts
 * @returns {Promise<Array<{ userId: number, userName: string, phoneNumber: string, heightCm: number|null, bmr: number|null }>>}
 */
export async function searchTeamPhonesByPrefix({ prefix, coachId }) {
  const supabase = getSupabaseClient();
  const selectFull =
    'UserId, UserName, PhoneNumber, Height, Bmr, Age, VisceralFat, BodyAge, ChestCm, WaistCm, HipCm, Gender';
  const selectBasic = 'UserId, UserName, PhoneNumber, Height, Bmr, Gender';

  let data;
  let error;
  ({ data, error } = await supabase
    .from('team_table')
    .select(selectFull)
    .eq('CoachId', coachId)
    .like('PhoneNumber', `${prefix}%`)
    .eq('Status', 'Active')
    .order('UserId', { ascending: true })
    .limit(10));

  if (error && /Age|VisceralFat|BodyAge|ChestCm|WaistCm|HipCm/i.test(String(error.message || '')) && /column/i.test(String(error.message || ''))) {
    ({ data, error } = await supabase
      .from('team_table')
      .select(selectBasic)
      .eq('CoachId', coachId)
      .like('PhoneNumber', `${prefix}%`)
      .eq('Status', 'Active')
      .order('UserId', { ascending: true })
      .limit(10));
  }

  if (error) throw error;
  if (!data) return [];

  const num = (v) => (v != null && Number.isFinite(Number(v)) ? Number(v) : null);

  // Deduplicate by PhoneNumber (keep lowest UserId); drop activated members (OTP approved).
  const candidateIds = data.map((row) => row.UserId).filter(Boolean);
  const activatedIds = await findActivatedUserIdsAmong(candidateIds);

  const seen = new Set();
  const results = [];
  for (const row of data) {
    const uid = parseInt(row.UserId, 10);
    if (Number.isFinite(uid) && activatedIds.has(uid)) continue;
    const phone = String(row.PhoneNumber || '').trim();
    if (!phone || seen.has(phone)) continue;
    seen.add(phone);
    results.push({
      userId:      row.UserId,
      userName:    row.UserName || '',
      phoneNumber: phone,
      heightCm:    row.Height ?? null,
      bmr:         row.Bmr    ?? null,
      gender:      row.Gender ?? null,
      age:         num(row.Age),
      visceralFat: num(row.VisceralFat),
      bodyAge:     num(row.BodyAge),
      chestCm:     num(row.ChestCm),
      waistCm:     num(row.WaistCm),
      hipCm:       num(row.HipCm),
      weightKg:    null,
      fatPercent:  null,
      bmi:         null,
    });
  }

  const userIds = results.map((r) => r.userId).filter((id) => id != null);
  if (userIds.length > 0) {
    const weightByUser = await getLatestWeightMetricsByUserIds(userIds);
    for (const r of results) {
      const w = weightByUser.get(Number(r.userId));
      if (!w) continue;
      r.weightKg = w.weightKg;
      r.fatPercent = w.fatPercent;
      r.bmi = w.bmi;
      if (r.bmr == null && w.bmr != null) r.bmr = w.bmr;
    }
  }

  return results;
}

/**
 * Resolve weight / fat / BMI for one member (latest weight + any BodyFat row).
 * @param {number} userId
 * @param {number|null|undefined} heightCm
 * @returns {Promise<{ weightKg: number|null, fatPercent: number|null, bmi: number|null, bmr: number|null }>}
 */
async function resolveMemberWeightMetrics(userId, heightCm) {
  const empty = { weightKg: null, fatPercent: null, bmi: null, bmr: null };
  const uid = Number(userId);
  if (!Number.isFinite(uid) || uid < 1) return empty;

  try {
    const [latest, fatFromAny] = await Promise.all([
      getLatestWeight(uid),
      getLatestWeightBodyFat(uid),
    ]);

    const num = (v) => (v != null && Number.isFinite(Number(v)) ? Number(v) : null);
    const weightKg = latest?.Weight != null ? num(latest.Weight) : null;
    const fatPercent = num(latest?.BodyFat) ?? (fatFromAny != null ? num(fatFromAny) : null);
    let bmi = latest?.Bmi != null ? num(latest.Bmi) : null;
    if (bmi == null && weightKg != null && heightCm != null) {
      bmi = computeBmiFromHeightWeight(heightCm, weightKg);
    }
    const bmr = latest?.Bmr != null ? num(latest.Bmr) : null;
    return { weightKg, fatPercent, bmi, bmr };
  } catch (err) {
    logger.warn('[card.repo] resolveMemberWeightMetrics failed', {
      userId: uid,
      message: err?.message || String(err),
    });
    return empty;
  }
}

/**
 * Full BCM form prefill for a team member (team_table + latest weight).
 * @param {number} userId
 * @returns {Promise<object|null>}
 */
export async function getMemberPrefillForCard(userId) {
  const uid = parseInt(userId, 10);
  if (!Number.isFinite(uid) || uid < 1) return null;

  const supabase = getSupabaseClient();
  const selectFull =
    'UserId, UserName, PhoneNumber, Height, Bmr, Age, VisceralFat, BodyAge, ChestCm, WaistCm, HipCm, Gender, recovered_health_issues';
  const selectBasic = 'UserId, UserName, PhoneNumber, Height, Bmr, Gender';

  let data;
  let error;
  ({ data, error } = await supabase
    .from('team_table')
    .select(selectFull)
    .eq('UserId', uid)
    .maybeSingle());

  if (error && /recovered_health_issues/i.test(String(error.message || '')) && /column/i.test(String(error.message || ''))) {
    ({ data, error } = await supabase
      .from('team_table')
      .select('UserId, UserName, PhoneNumber, Height, Bmr, Age, VisceralFat, BodyAge, ChestCm, WaistCm, HipCm, Gender')
      .eq('UserId', uid)
      .maybeSingle());
  }

  if (error && /Age|VisceralFat|BodyAge|ChestCm|WaistCm|HipCm/i.test(String(error.message || '')) && /column/i.test(String(error.message || ''))) {
    ({ data, error } = await supabase
      .from('team_table')
      .select(selectBasic)
      .eq('UserId', uid)
      .maybeSingle());
  }

  if (error) throw error;
  if (!data) return null;

  if (await isUserActivatedForBcm(uid)) {
    await rejectBcmForActivatedMember(uid);
  }

  const num = (v) => (v != null && Number.isFinite(Number(v)) ? Number(v) : null);
  const heightCm = data.Height != null ? Number(data.Height) : null;
  const w = await resolveMemberWeightMetrics(uid, heightCm);

  return {
    userId: uid,
    userName: data.UserName || '',
    phoneNumber: data.PhoneNumber ? String(data.PhoneNumber).trim() : null,
    heightCm,
    bmr: data.Bmr != null ? Number(data.Bmr) : (w.bmr ?? null),
    gender: data.Gender ?? null,
    age: num(data.Age),
    visceralFat: num(data.VisceralFat),
    bodyAge: num(data.BodyAge),
    chestCm: num(data.ChestCm),
    waistCm: num(data.WaistCm),
    hipCm: num(data.HipCm),
    weightKg: w.weightKg ?? null,
    fatPercent: w.fatPercent ?? null,
    bmi: w.bmi ?? null,
    recoveredHealthIssues: Array.isArray(data.recovered_health_issues)
      ? data.recovered_health_issues.filter((x) => typeof x === 'string' && x.trim())
      : [],
  };
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

/** Columns needed for the BCM grid list (no SELECT *). */
const LIST_SUMMARY_COLS = [
  'id',
  'user_id',
  'name',
  'age',
  'gender',
  'height_cm',
  'weight_kg',
  'bmi',
  'recorded_date',
  'location_name',
  'created_at',
  'created_by',
].join(', ');

/** Full card columns for edit / detail. */
const LIST_DETAIL_COLS = [
  'id',
  'user_id',
  'name',
  'age',
  'gender',
  'height_cm',
  'weight_kg',
  'bmi',
  'fat_percent',
  'bmr',
  'body_age',
  'visceral_fat',
  'chest_cm',
  'waist_cm',
  'hip_cm',
  'recorded_date',
  'location_name',
  'recovered_health_issues',
  'created_at',
  'created_by',
].join(', ');

const BPC_LIST_CACHE_TTL_MS = 20 * 1000;
const bpcListCache = new Map();
const bpcListInflight = new Map();

function bpcListCacheKey(coachId) {
  return `bpc:list:v2:${coachId}`;
}

function mapRecoveredHealthIssues(raw) {
  if (Array.isArray(raw)) return raw.filter((x) => typeof x === 'string' && x.trim());
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter((x) => typeof x === 'string' && x.trim());
      }
    } catch {
      /* ignore */
    }
  }
  return [];
}

function mapCardSummary(card, memberMeta = null) {
  const phone = memberMeta?.phoneNumber || null;
  return {
    id: card.id,
    userId: card.user_id,
    name: card.name,
    phoneNumber: phone,
    email: memberMeta?.email || null,
    communityId: memberMeta?.communityId || null,
    age: card.age,
    gender: card.gender,
    heightCm: card.height_cm,
    weightKg: card.weight_kg,
    bmi: card.bmi,
    recordedDate: card.recorded_date,
    locationName: card.location_name || null,
    createdAt: card.created_at,
    createdBy: card.created_by,
  };
}

function mapCardDetail(card, memberMeta = null) {
  return {
    ...mapCardSummary(card, memberMeta),
    fatPercent: card.fat_percent,
    bmr: card.bmr,
    bodyAge: card.body_age,
    visceralFat: card.visceral_fat,
    chestCm: card.chest_cm,
    waistCm: card.waist_cm,
    hipCm: card.hip_cm,
    locationName: card.location_name,
    recoveredHealthIssues: mapRecoveredHealthIssues(card.recovered_health_issues),
  };
}

/**
 * Dated body-parameter snapshots for one member (Reports Trend).
 * Includes leftover cards when more than one still exists.
 *
 * @param {number} userId
 * @returns {Promise<object[]>}
 */
export async function listCardHistoryByUserId(userId) {
  const uid = parseInt(userId, 10);
  if (!Number.isFinite(uid) || uid < 1) return [];
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select(LIST_DETAIL_COLS)
    .eq('user_id', uid)
    .eq('is_deleted', false)
    .order('recorded_date', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []).map((row) => mapCardDetail(row));
}

/**
 * Hierarchy-gated card history. Same viewer rule as /api/weight/history.
 *
 * @param {number} userId
 * @param {number|null} viewerUserId
 * @returns {Promise<object[]>}
 */
export async function listVisibleCardHistoryByUserId(userId, viewerUserId) {
  await assertViewerCanAccessMember(getSupabaseClient(), viewerUserId, userId);
  return listCardHistoryByUserId(userId);
}

async function fetchTeamMemberMetaByUserIds(supabase, userIds) {
  const teamMembersMap = {};
  if (!userIds.length) return teamMembersMap;

  const CHUNK = 200;
  for (let i = 0; i < userIds.length; i += CHUNK) {
    const chunk = userIds.slice(i, i + CHUNK);
    const { data: teamMembers } = await supabase
      .from('team_table')
      .select('UserId, PhoneNumber, Email, CommunityId')
      .in('UserId', chunk);

    if (teamMembers) {
      for (const m of teamMembers) {
        teamMembersMap[String(m.UserId)] = {
          phoneNumber: m.PhoneNumber && String(m.PhoneNumber).trim()
            ? String(m.PhoneNumber).trim()
            : null,
          email: m.Email && String(m.Email).trim() ? String(m.Email).trim() : null,
          communityId: m.CommunityId && String(m.CommunityId).trim()
            ? String(m.CommunityId).trim()
            : null,
        };
      }
    }
  }
  return teamMembersMap;
}

/** @deprecated use fetchTeamMemberMetaByUserIds */
async function fetchPhonesByUserIds(supabase, userIds) {
  return fetchTeamMemberMetaByUserIds(supabase, userIds);
}

/**
 * Soft-delete a body-parameters card owned by the coach.
 * Sets `is_deleted = true`. Returns null when missing or not owned.
 *
 * @param {{ id: number, coachId: number }} opts
 * @returns {Promise<{ id: number, created_by: number }|null>}
 */
export async function softDeleteCard({ id, coachId }) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TABLE)
    .update({ is_deleted: true })
    .eq('id', id)
    .eq('created_by', coachId)
    .eq('is_deleted', false)
    .select('id, created_by')
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

/**
 * Invalidate the slim list cache for a coach (call after create/update).
 * @param {number|string} coachId
 */
export function invalidateBpcListCache(coachId) {
  if (coachId == null) return;
  bpcListCache.delete(bpcListCacheKey(coachId));
}

/**
 * Load all slim summary cards for a coach (cached ~20s). Used for search + pagination.
 * @param {number|string} coachId
 * @returns {Promise<Array>}
 */
async function loadSlimCardsForCoach(coachId) {
  const key = bpcListCacheKey(coachId);
  const cached = bpcListCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.rows;
  }

  if (bpcListInflight.has(key)) {
    return bpcListInflight.get(key);
  }

  const promise = (async () => {
    const supabase = getSupabaseClient();
    logger.info('[listCardsForCoach] querying slim columns', { coachId });

    let { data: cards, error: cardsError } = await supabase
      .from(TABLE)
      .select(LIST_SUMMARY_COLS)
      .eq('created_by', coachId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false });

    if (cardsError && /location_name/i.test(String(cardsError.message || ''))) {
      logger.error('[listCardsForCoach] location_name missing — retrying without it; run migration', {
        message: cardsError.message,
      });
      const colsWithoutVenue = LIST_SUMMARY_COLS
        .split(',')
        .map((c) => c.trim())
        .filter((c) => c !== 'location_name')
        .join(', ');
      ({ data: cards, error: cardsError } = await supabase
        .from(TABLE)
        .select(colsWithoutVenue)
        .eq('created_by', coachId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false }));
    }

    if (cardsError) {
      logger.error('[listCardsForCoach] database error:', cardsError);
      throw cardsError;
    }

    const rows = cards || [];
    const userIds = [...new Set(rows.map((c) => c.user_id).filter(Boolean))];
    // Only hide activated members from the list. Hard-delete happens on OTP approve /
    // create reject — never purge here (non-activated BCM history must stay visible).
    const activatedIds = await findActivatedUserIdsAmong(userIds);

    const visibleRows = rows.filter((c) => {
      const uid = parseInt(c.user_id, 10);
      return !(Number.isFinite(uid) && activatedIds.has(uid));
    });

    const visibleUserIds = [...new Set(visibleRows.map((c) => c.user_id).filter(Boolean))];
    const teamMembersMap = await fetchTeamMemberMetaByUserIds(supabase, visibleUserIds);

    const mapped = visibleRows.map((card) => {
      const member = teamMembersMap[String(card.user_id)] || null;
      return mapCardSummary(card, member);
    });

    bpcListCache.set(key, { rows: mapped, expiresAt: Date.now() + BPC_LIST_CACHE_TTL_MS });
    return mapped;
  })().finally(() => {
    bpcListInflight.delete(key);
  });

  bpcListInflight.set(key, promise);
  return promise;
}

/**
 * List body-parameter cards for a coach with server-side search + pagination.
 * Returns only summary fields for the grid.
 *
 * @param {number|string} coachId
 * @param {{ page?: number, limit?: number, search?: string }} [opts]
 * @returns {Promise<{ cards: Array, pagination: object }>}
 */
export async function listCardsForCoach(coachId, opts = {}) {
  const { paginateBpcListRecords } = await import('../domain/list.pagination.js');
  const allCards = await loadSlimCardsForCoach(coachId);
  const { records, pagination } = paginateBpcListRecords(allCards, opts);
  logger.info('[listCardsForCoach] page ready', {
    coachId,
    total: pagination.totalRecords,
    page: pagination.currentPage,
    returned: records.length,
  });
  return { cards: records, pagination };
}

/**
 * Full card detail for edit — single row, coach-scoped.
 * @param {number|string} coachId
 * @param {number|string} cardId
 * @returns {Promise<object|null>}
 */
export async function getCardByIdForCoach(coachId, cardId) {
  const supabase = getSupabaseClient();
  const { data: card, error } = await supabase
    .from(TABLE)
    .select(LIST_DETAIL_COLS)
    .eq('id', cardId)
    .eq('created_by', coachId)
    .eq('is_deleted', false)
    .maybeSingle();

  if (error) throw error;
  if (!card) return null;

  let memberMeta = null;
  if (card.user_id) {
    const map = await fetchTeamMemberMetaByUserIds(supabase, [card.user_id]);
    memberMeta = map[String(card.user_id)] || null;
  }
  return mapCardDetail(card, memberMeta);
}
