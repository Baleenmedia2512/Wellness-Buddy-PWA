/**
 * User feature — repository layer. Owns team_table + cross-cutting deletes
 * needed for account removal.
 */
import { getSupabaseClient } from '../../utils/supabaseClient.js';
import { nowUtc, utcInstantToLegacyIstWallStorage, IANA_IST } from '../../shared/lib/datetime/index.js';
import { buildCardPatchFromProfile } from '../body-parameters-card/domain/sync.rules.js';
import { findLatestCardForProfileSync } from '../body-parameters-card/data/card.repo.js';

const TEAM = 'team_table';
const APPROVALS = 'approval_requests_table';

function legacyIstWallNow() {
  return utcInstantToLegacyIstWallStorage(nowUtc(), IANA_IST);
}

export async function findByEmail(email, columns = '"UserId", "UserName", "Email"') {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TEAM)
    .select(columns)
    .ilike('Email', email)
    .limit(1);
  if (error) throw error;
  return Array.isArray(data) && data.length > 0 ? data[0] : null;
}

export async function findByExactEmail(email, columns) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TEAM)
    .select(columns)
    .eq('"Email"', email)
    .limit(1);
  if (error) throw error;
  return Array.isArray(data) && data.length > 0 ? data[0] : null;
}

/**
 * Find a team_table row with this email (case-insensitive), excluding one UserId.
 * Used to enforce unique email before first-time assignment on phone-OTP users.
 *
 * @param {string} email
 * @param {number} excludeUserId
 * @param {string} [columns]
 * @returns {Promise<object|null>}
 */
export async function findByEmailExcludingUserId(
  email,
  excludeUserId,
  columns = '"UserId"',
) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized) return null;
  const uid = Number(excludeUserId);
  if (!Number.isFinite(uid) || uid < 1) return null;

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TEAM)
    .select(columns)
    .ilike('Email', normalized)
    .neq('UserId', uid)
    .limit(1);
  if (error) throw error;
  return Array.isArray(data) && data.length > 0 ? data[0] : null;
}

/**
 * @param {string|number} userId
 * @param {string} [columns]
 */
export async function findByUserId(userId, columns = '"UserId", "Role"') {
  const uid = Number.parseInt(String(userId), 10);
  if (!Number.isFinite(uid) || uid <= 0) return null;
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TEAM)
    .select(columns)
    .eq('"UserId"', uid)
    .limit(1);
  if (error) throw error;
  return Array.isArray(data) && data.length > 0 ? data[0] : null;
}

export async function findByUsername(username) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TEAM)
    .select('"UserId"')
    .eq('"UserName"', username)
    .limit(1);
  if (error) throw error;
  return Array.isArray(data) && data.length > 0 ? data[0] : null;
}

export async function getProfile(email) {
  // Consent / optional body-metric columns are optional until migrations are applied.
  // Body fat is stored on weight_records_table, not team_table.
  const withPhotos =
    '"UserId", "UserName", "Email", "Height", "DietType", "ProfileImage", "CoachId", "PhoneNumber", "Gender", "Bmr", profile_pic_snooze, "WeightGoalMode", "PhysicalActivityLevel", "CommunityId", timezone_iana, "ConsentAcceptedAt", "ConsentVersion", "Age", "VisceralFat", "BodyAge", "ChestCm", "WaistCm", "HipCm", recovered_health_issues, transformation_photos';
  const withKeyAndPhotos = `"ProfileImageKey", ${withPhotos}`;
  const fullCols =
    '"UserId", "UserName", "Email", "Height", "DietType", "ProfileImage", "CoachId", "PhoneNumber", "Gender", "Bmr", profile_pic_snooze, "WeightGoalMode", "PhysicalActivityLevel", "CommunityId", timezone_iana, "ConsentAcceptedAt", "ConsentVersion", "Age", "VisceralFat", "BodyAge", "ChestCm", "WaistCm", "HipCm", recovered_health_issues';
  const withMetricsNoHealth =
    '"UserId", "UserName", "Email", "Height", "DietType", "ProfileImage", "CoachId", "PhoneNumber", "Gender", "Bmr", profile_pic_snooze, "WeightGoalMode", "PhysicalActivityLevel", "CommunityId", timezone_iana, "ConsentAcceptedAt", "ConsentVersion", "Age", "VisceralFat", "BodyAge", "ChestCm", "WaistCm", "HipCm"';
  const withConsentNoMetrics =
    '"UserId", "UserName", "Email", "Height", "DietType", "ProfileImage", "CoachId", "PhoneNumber", "Gender", "Bmr", profile_pic_snooze, "WeightGoalMode", "PhysicalActivityLevel", "CommunityId", timezone_iana, "ConsentAcceptedAt", "ConsentVersion"';
  const noConsentCols =
    '"UserId", "UserName", "Email", "Height", "DietType", "ProfileImage", "CoachId", "PhoneNumber", "Gender", "Bmr", profile_pic_snooze, "WeightGoalMode", "PhysicalActivityLevel", "CommunityId", timezone_iana';

  async function load(cols) {
    return findByEmail(email, cols);
  }

  try {
    return await load(withKeyAndPhotos);
  } catch (errKey) {
    const msgKey = String(errKey?.message || errKey || '');
    if (!/column/i.test(msgKey)) throw errKey;
    if (!/ProfileImageKey|transformation_photos/i.test(msgKey)) throw errKey;
  }

  try {
    return await load(withPhotos);
  } catch (errPhotos) {
    const msgPhotos = String(errPhotos?.message || errPhotos || '');
    if (!/column/i.test(msgPhotos)) throw errPhotos;
    if (!/transformation_photos/i.test(msgPhotos)) throw errPhotos;
  }

  try {
    return await load(fullCols);
  } catch (err) {
    let current = err;
    const msg = String(current?.message || current || '');
    if (!/column/i.test(msg)) throw current;
    if (/recovered_health_issues/i.test(msg)) {
      try {
        return await load(withMetricsNoHealth);
      } catch (errHealth) {
        const msgH = String(errHealth?.message || errHealth || '');
        if (!/column/i.test(msgH)) throw errHealth;
        current = errHealth;
      }
    }
    const msg2 = String(current?.message || current || '');
    const missingMetrics = /Age|VisceralFat|BodyAge|ChestCm|WaistCm|HipCm/i.test(msg2);
    if (missingMetrics) {
      try {
        return await load(withConsentNoMetrics);
      } catch (err2) {
        const msg3 = String(err2?.message || err2 || '');
        if (!/column/i.test(msg3)) throw err2;
        return load(noConsentCols);
      }
    }
    const missingConsent = /ConsentAcceptedAt|ConsentVersion/i.test(msg2);
    if (missingConsent) return load(noConsentCols);
    throw current;
  }
}

/** Same columns as getProfile, resolved by UserId (phone / pre-email onboarding). */
export async function getProfileByUserId(userId) {
  const withPhotos =
    '"UserId", "UserName", "Email", "Height", "DietType", "ProfileImage", "CoachId", "PhoneNumber", "Gender", "Bmr", profile_pic_snooze, "WeightGoalMode", "PhysicalActivityLevel", "CommunityId", timezone_iana, "ConsentAcceptedAt", "ConsentVersion", "Age", "VisceralFat", "BodyAge", "ChestCm", "WaistCm", "HipCm", recovered_health_issues, transformation_photos';
  const withKeyAndPhotos = `"ProfileImageKey", ${withPhotos}`;
  const fullCols =
    '"UserId", "UserName", "Email", "Height", "DietType", "ProfileImage", "CoachId", "PhoneNumber", "Gender", "Bmr", profile_pic_snooze, "WeightGoalMode", "PhysicalActivityLevel", "CommunityId", timezone_iana, "ConsentAcceptedAt", "ConsentVersion", "Age", "VisceralFat", "BodyAge", "ChestCm", "WaistCm", "HipCm", recovered_health_issues';
  const withMetricsNoHealth =
    '"UserId", "UserName", "Email", "Height", "DietType", "ProfileImage", "CoachId", "PhoneNumber", "Gender", "Bmr", profile_pic_snooze, "WeightGoalMode", "PhysicalActivityLevel", "CommunityId", timezone_iana, "ConsentAcceptedAt", "ConsentVersion", "Age", "VisceralFat", "BodyAge", "ChestCm", "WaistCm", "HipCm"';
  const withConsentNoMetrics =
    '"UserId", "UserName", "Email", "Height", "DietType", "ProfileImage", "CoachId", "PhoneNumber", "Gender", "Bmr", profile_pic_snooze, "WeightGoalMode", "PhysicalActivityLevel", "CommunityId", timezone_iana, "ConsentAcceptedAt", "ConsentVersion"';
  const noConsentCols =
    '"UserId", "UserName", "Email", "Height", "DietType", "ProfileImage", "CoachId", "PhoneNumber", "Gender", "Bmr", profile_pic_snooze, "WeightGoalMode", "PhysicalActivityLevel", "CommunityId", timezone_iana';

  async function load(cols) {
    return findByUserId(userId, cols);
  }

  try {
    return await load(withKeyAndPhotos);
  } catch (errKey) {
    const msgKey = String(errKey?.message || errKey || '');
    if (!/column/i.test(msgKey)) throw errKey;
    if (!/ProfileImageKey|transformation_photos/i.test(msgKey)) throw errKey;
  }

  try {
    return await load(withPhotos);
  } catch (errPhotos) {
    const msgPhotos = String(errPhotos?.message || errPhotos || '');
    if (!/column/i.test(msgPhotos)) throw errPhotos;
    if (!/transformation_photos/i.test(msgPhotos)) throw errPhotos;
  }

  try {
    return await load(fullCols);
  } catch (err) {
    let current = err;
    const msg = String(current?.message || current || '');
    if (!/column/i.test(msg)) throw current;
    if (/recovered_health_issues/i.test(msg)) {
      try {
        return await load(withMetricsNoHealth);
      } catch (errHealth) {
        const msgH = String(errHealth?.message || errHealth || '');
        if (!/column/i.test(msgH)) throw errHealth;
        current = errHealth;
      }
    }
    const msg2 = String(current?.message || current || '');
    const missingMetrics = /Age|VisceralFat|BodyAge|ChestCm|WaistCm|HipCm/i.test(msg2);
    if (missingMetrics) {
      try {
        return await load(withConsentNoMetrics);
      } catch (err2) {
        const msg3 = String(err2?.message || err2 || '');
        if (!/column/i.test(msg3)) throw err2;
        return load(noConsentCols);
      }
    }
    const missingConsent = /ConsentAcceptedAt|ConsentVersion/i.test(msg2);
    if (missingConsent) return load(noConsentCols);
    throw current;
  }
}

/** Team Code / shared-team fields for profile Team Code card. */
export async function getTeamCodeFields(userId) {
  return findByUserId(userId, '"UserId", "TeamId", "CoachTeamId", "CoachId", "Role", "CommunityId"');
}

/** Avatar route + lazy R2 migrate — key first, Base64 / Google URL fallback. */
export async function getAvatarSource(userId) {
  try {
    return await findByUserId(userId, '"UserId", "ProfileImageKey", "ProfileImage"');
  } catch (err) {
    if (!isMissingColumn(err, 'ProfileImageKey')) throw err;
    const row = await findByUserId(userId, '"UserId", "ProfileImage"');
    return row ? { ...row, ProfileImageKey: null } : null;
  }
}

/**
 * Custom data-URI avatars that have not been copied to R2 yet.
 * @param {{ from: number, to: number }} range inclusive Supabase .range()
 */
export async function listPendingAvatarBackfill({ from = 0, to = 49 } = {}) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TEAM)
    .select('"UserId", "ProfileImage", "ProfileImageKey"')
    .is('ProfileImageKey', null)
    .like('ProfileImage', 'data:image%')
    .order('UserId', { ascending: true })
    .range(from, to);
  if (error) {
    if (isMissingColumn(error, 'ProfileImageKey')) {
      throw new Error('Run migration add_profile_image_key_to_team_table.sql before backfill');
    }
    throw error;
  }
  return data || [];
}

/**
 * Custom data-URI avatars already copied to R2 (recompress pass).
 * @param {{ from: number, to: number }} range inclusive Supabase .range()
 */
export async function listAvatarsForRecompress({ from = 0, to = 49 } = {}) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TEAM)
    .select('"UserId", "ProfileImage", "ProfileImageKey"')
    .not('ProfileImageKey', 'is', null)
    .like('ProfileImage', 'data:image%')
    .order('UserId', { ascending: true })
    .range(from, to);
  if (error) {
    if (isMissingColumn(error, 'ProfileImageKey')) {
      throw new Error('Run migration add_profile_image_key_to_team_table.sql before backfill');
    }
    throw error;
  }
  return data || [];
}

/**
 * All persisted R2 keys (any ProfileImage type). Used to avoid deleting live avatars.
 * @param {{ from: number, to: number }} range inclusive Supabase .range()
 */
export async function listProfileImageKeysPage({ from = 0, to = 199 } = {}) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TEAM)
    .select('"UserId", "ProfileImageKey"')
    .not('ProfileImageKey', 'is', null)
    .order('UserId', { ascending: true })
    .range(from, to);
  if (error) {
    if (isMissingColumn(error, 'ProfileImageKey')) {
      throw new Error('Run migration add_profile_image_key_to_team_table.sql before backfill');
    }
    throw error;
  }
  return data || [];
}

function isMissingColumn(error, columnName) {
  const msg = String(error?.message || error || '');
  return /column/i.test(msg) && new RegExp(columnName, 'i').test(msg);
}

function isMissingIsDeletedColumn(error) {
  const msg = String(error?.message || error || '');
  return /IsDeleted/i.test(msg) && /column/i.test(msg) && /does not exist|not find|unknown/i.test(msg);
}

/**
 * Latest weight metrics for many users (one row each — most recent CreatedAt).
 * @param {Array<number|string>} userIds
 * @returns {Promise<Map<number, { weightKg: number|null, fatPercent: number|null, bmi: number|null, bmr: number|null }>>}
 */
export async function getLatestWeightMetricsByUserIds(userIds) {
  const out = new Map();
  const ids = [...new Set(
    (userIds || []).map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0),
  )];
  if (ids.length === 0) return out;

  const supabase = getSupabaseClient();
  const selectCols = 'UserId, Weight, BodyFat, Bmi, Bmr, CreatedAt';
  const chunkSize = 100;

  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    const run = (withDeletedFilter) => {
      let q = supabase
        .from('weight_records_table')
        .select(selectCols)
        .in('UserId', chunk)
        .order('CreatedAt', { ascending: false });
      if (withDeletedFilter) {
        q = q.or('IsDeleted.is.null,IsDeleted.eq.false,IsDeleted.eq.0');
      }
      return q;
    };

    let { data, error } = await run(true);
    if (error && isMissingIsDeletedColumn(error)) {
      ({ data, error } = await run(false));
    }
    if (error) {
      console.warn('[user.repo] getLatestWeightMetricsByUserIds failed:', error.message);
      continue;
    }

    const num = (v) => (v != null && Number.isFinite(Number(v)) ? Number(v) : null);
    for (const row of data || []) {
      const uid = Number(row.UserId);
      if (!Number.isFinite(uid) || out.has(uid)) continue;
      out.set(uid, {
        weightKg: num(row.Weight),
        fatPercent: num(row.BodyFat),
        bmi: num(row.Bmi),
        bmr: num(row.Bmr),
      });
    }
  }

  return out;
}

export async function getLatestWeight(userId) {
  const uid = Number.parseInt(String(userId), 10);
  if (!Number.isFinite(uid) || uid < 1) return null;

  const supabase = getSupabaseClient();
  const selectCols = 'ID, Weight, BodyFat, Bmi, Bmr, CreatedAt';

  let query = supabase
    .from('weight_records_table')
    .select(selectCols)
    .eq('UserId', uid)
    .or('IsDeleted.is.null,IsDeleted.eq.false,IsDeleted.eq.0')
    .order('CreatedAt', { ascending: false })
    .limit(1);

  let { data, error } = await query;
  if (error && isMissingIsDeletedColumn(error)) {
    console.warn('[user.repo] getLatestWeight: IsDeleted missing — retrying without soft-delete filter');
    ({ data, error } = await supabase
      .from('weight_records_table')
      .select(selectCols)
      .eq('UserId', uid)
      .order('CreatedAt', { ascending: false })
      .limit(1));
  }
  if (error) {
    console.warn('[user.repo] getLatestWeight failed:', error.message);
    return null;
  }
  return Array.isArray(data) && data.length > 0 ? data[0] : null;
}

/**
 * First (oldest) weight record for a user — becomes their Initial Weight.
 * Later uploads must not change this value.
 * @param {number|string} userId
 * @returns {Promise<object|null>}
 */
export async function getInitialWeight(userId) {
  const uid = Number.parseInt(String(userId), 10);
  if (!Number.isFinite(uid) || uid < 1) return null;

  const supabase = getSupabaseClient();
  const selectCols = 'ID, Weight, CreatedAt';

  let { data, error } = await supabase
    .from('weight_records_table')
    .select(selectCols)
    .eq('UserId', uid)
    .or('IsDeleted.is.null,IsDeleted.eq.false,IsDeleted.eq.0')
    .order('CreatedAt', { ascending: true })
    .limit(1);

  if (error && isMissingIsDeletedColumn(error)) {
    console.warn('[user.repo] getInitialWeight: IsDeleted missing — retrying without soft-delete filter');
    ({ data, error } = await supabase
      .from('weight_records_table')
      .select(selectCols)
      .eq('UserId', uid)
      .order('CreatedAt', { ascending: true })
      .limit(1));
  }
  if (error) {
    console.warn('[user.repo] getInitialWeight failed:', error.message);
    return null;
  }
  return Array.isArray(data) && data.length > 0 ? data[0] : null;
}

/**
 * Latest non-null BodyFat % from any weight record (most recent first).
 * @param {number|string} userId
 * @returns {Promise<number|null>}
 */
export async function getLatestWeightBodyFat(userId) {
  const uid = Number.parseInt(String(userId), 10);
  if (!Number.isFinite(uid) || uid < 1) return null;

  const supabase = getSupabaseClient();
  const run = (withDeletedFilter) => {
    let q = supabase
      .from('weight_records_table')
      .select('BodyFat')
      .eq('UserId', uid)
      .not('BodyFat', 'is', null);
    if (withDeletedFilter) {
      q = q.or('IsDeleted.is.null,IsDeleted.eq.false,IsDeleted.eq.0');
    }
    return q.order('CreatedAt', { ascending: false }).limit(1).maybeSingle();
  };

  let { data, error } = await run(true);
  if (error && isMissingIsDeletedColumn(error)) {
    ({ data, error } = await run(false));
  }
  if (error || data?.BodyFat == null) return null;
  const bf = parseFloat(data.BodyFat);
  return Number.isFinite(bf) ? bf : null;
}

/**
 * Persist body fat % onto the user's latest weight record.
 * @param {number|string} userId
 * @param {number} bodyFat
 * @param {number|null} [bmr]
 * @returns {Promise<{ ID: number, Weight: *, BodyFat: *, Bmr: * }|null>}
 */
export async function updateLatestWeightBodyFat(userId, bodyFat, bmr = null) {
  const uid = Number.parseInt(String(userId), 10);
  if (!Number.isFinite(uid) || uid < 1) return null;

  const latest = await getLatestWeight(uid);
  if (!latest?.ID) return null;

  const updates = { BodyFat: bodyFat, UpdatedAt: legacyIstWallNow() };
  if (bmr != null) updates.Bmr = bmr;

  const supabase = getSupabaseClient();
  const runUpdate = (withDeletedFilter) => {
    let q = supabase
      .from('weight_records_table')
      .update(updates)
      .eq('ID', latest.ID)
      .eq('UserId', uid);
    if (withDeletedFilter) {
      q = q.or('IsDeleted.is.null,IsDeleted.eq.false,IsDeleted.eq.0');
    }
    return q.select('ID, Weight, BodyFat, Bmr').maybeSingle();
  };

  let { data, error } = await runUpdate(true);
  if (error && isMissingIsDeletedColumn(error)) {
    ({ data, error } = await runUpdate(false));
  }
  if (error) throw error;
  return data || null;
}

export async function updateUserByEmail(email, updateData) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TEAM)
    .update(updateData)
    .eq('Email', email)
    .select('UserId');
  if (error) throw error;
  return data || [];
}

export async function updateUserById(userId, updateData) {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from(TEAM)
    .update(updateData)
    .eq('UserId', userId);
  if (error) throw error;
}

export async function verifyProfile(userId) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TEAM)
    .select('UserId, Height, DietType, PhoneNumber, "Gender", "CommunityId", timezone_iana')
    .eq('UserId', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function insertUser(payload) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TEAM)
    .insert(payload)
    .select()
    .single();
  return { data, error };
}

export async function setUserStatus(userId, status) {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from(TEAM)
    .update({ Status: status })
    .eq('"UserId"', userId);
  if (error) console.warn('[user.repo] setUserStatus failed:', error.message);
}

export async function getStatusFields(email) {
  return findByEmail(email, '"UserId", "TeamId", "CoachId", "Role", "SetupSkipped", "Status"');
}

export async function getStatusFieldsByUserId(userId) {
  return findByUserId(userId, '"UserId", "TeamId", "CoachId", "Role", "SetupSkipped", "Status"');
}

export async function getPendingApproval(userId) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(APPROVALS)
    .select('"Id", "UplineCoachId", "Status", "OtpExpiresAt", "RequestedAt"')
    .eq('"RequesterId"', userId)
    .eq('"Status"', 'pending')
    .order('"RequestedAt"', { ascending: false })
    .limit(1);
  if (error) {
    console.warn('[user.repo] getPendingApproval failed:', error.message);
    return null;
  }
  return Array.isArray(data) && data.length > 0 ? data[0] : null;
}

export async function deleteApproval(id) {
  const supabase = getSupabaseClient();
  await supabase.from(APPROVALS).delete().eq('"Id"', id);
}

/**
 * Fetch only the public-facing fields needed by the share landing page.
 * Returns null when the user is not found or on error (non-fatal).
 */
export async function findPublicProfileById(userId) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TEAM)
    .select('"UserName", "ProfileImage"')
    .eq('"UserId"', userId)
    .maybeSingle();
  if (error) return null;
  return data || null;
}

export async function getSnoozeRow(userId) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TEAM)
    .select('profile_pic_snooze')
    .eq('UserId', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function setSnooze(userId, newSnooze) {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from(TEAM)
    .update({ profile_pic_snooze: newSnooze })
    .eq('UserId', userId);
  if (error) throw error;
}

/**
 * Cascade-delete all user data. Returns the parallel deletion results so the
 * caller can log them.
 */
export async function purgeUserData(userId, normalizedEmail) {
  const supabase = getSupabaseClient();
  const results = await Promise.allSettled([
    supabase.from('food_nutrition_data_table').delete().eq('"UserID"', userId.toString()),
    supabase.from('weight_records_table').delete().eq('UserId', userId),
    supabase.from('education_logs_table').delete().eq('UserId', userId),
    supabase.from('daily_step_activity').delete().eq('UserId', userId),
    supabase.from('wellness_university_enrollments_table').delete().eq('UserId', userId),
    supabase.from('wellness_counselling_assessments').delete().eq('UserId', userId),
    supabase.from('otp_tokens_table').delete().ilike('recipient', normalizedEmail),
    // Null-out ownership before team_table row is removed — prevents the FK
    // constraint violation on nutrition_centers_table.owner_user_id.
    supabase.from('nutrition_centers_table').update({ owner_user_id: null }).eq('owner_user_id', userId),
  ]);
  return results;
}

export async function deleteTeamRow(userId) {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from(TEAM)
    .delete()
    .eq('UserId', userId);
  if (error) throw error;
}

/**
 * Sync Profile fields onto the user's latest Body Parameters Card.
 * Only the latest card is patched; historical cards are never touched.
 *
 * @param {number} userId
 * @param {{ name?: string|null, height?: number|null, bmr?: number|null, gender?: string|null, weightKg?: number|null, fatPercent?: number|null, bmi?: number|null }} fields
 * @returns {Promise<{ synced: boolean, fields: string[] }>}
 */
export async function syncProfileToLatestBodyParamsCard(userId, fields = {}) {
  const uid = parseInt(userId, 10);
  if (!Number.isFinite(uid) || uid < 1) {
    return { synced: false, fields: [] };
  }

  const hasAny = Object.keys(fields).some((k) => fields[k] !== undefined);
  if (!hasAny) return { synced: false, fields: [] };

  const card = await findLatestCardForProfileSync(uid);
  if (!card) return { synced: false, fields: [] };

  const patch = buildCardPatchFromProfile(card, fields);
  if (Object.keys(patch).length === 0) {
    return { synced: false, fields: [] };
  }

  const supabase = getSupabaseClient();
  const { error: updateErr } = await supabase
    .from('body_parameters_cards')
    .update(patch)
    .eq('id', card.id)
    .eq('is_deleted', false);
  if (updateErr) {
    return { synced: false, fields: [], error: updateErr.message };
  }

  return { synced: true, fields: Object.keys(patch), cardId: card.id };
}

/** Fetch raw food correction / nutrition data needed by user context. */
export async function getUserContextData(userId) {
  const supabase = getSupabaseClient();
  return Promise.all([
    supabase
      .from('food_corrections_table')
      .select('"AiDetected", "UserCorrected", "TimesCorrected"')
      .eq('"UserId"', userId)
      .order('"TimesCorrected"', { ascending: false })
      .order('"LastCorrected"', { ascending: false })
      .limit(10),
    supabase
      .from('food_corrections_table')
      .select('"AiDetected", "UserCorrected", "UserId", "TimesCorrected", "LastCorrected"')
      .order('"LastCorrected"', { ascending: false }),
    supabase
      .from(TEAM)
      .select('"DietType"')
      .eq('"UserId"', userId)
      .maybeSingle(),
    supabase
      .from('food_nutrition_data_table')
      .select('"AnalysisData", "CreatedAt"')
      .eq('"UserId"', userId)
      .or('"IsDeleted".is.null,"IsDeleted".eq.0')
      .order('"CreatedAt"', { ascending: false })
      .limit(3),
  ]);
}
