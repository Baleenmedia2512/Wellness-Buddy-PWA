/**
 * Weight feature — repository layer.
 * The ONLY place in this feature allowed to talk to Supabase / weight_records_table.
 */
import { getSupabaseClient } from '../../utils/supabaseClient.js';
import {
  nowUtc,
  utcInstantToLegacyIstWallStorage,
  IANA_IST,
  filterRowsByCalendarDay,
  filterRowsByCalendarDateRange,
  filterRowsOnOrBeforeCalendarDay,
  shiftDateYmd,
} from '../../shared/lib/datetime/index.js';
import { applyDayFilterWidened, applyDateRangeFilterWidened } from '../../shared/lib/datetime/applyDayFilter.js';

function legacyIstWallNow() {
  return utcInstantToLegacyIstWallStorage(nowUtc(), IANA_IST);
}

const TABLE = 'weight_records_table';
const ACTIVE_WEIGHT_FILTER = 'IsDeleted.is.null,IsDeleted.eq.false,IsDeleted.eq.0';
const WEIGHT_ROW_SELECT =
  'ID, UserId, Weight, Bmi, BodyFat, MuscleMass, Bmr, WeightImageBase64, CreatedAt, UpdatedAt, CaptureID, City, Village, CenterName, NutritionCenterId, AttendanceType, Latitude, Longitude, ReverseProgressReview';

function isMissingIsDeletedColumn(error) {
  const msg = String(error?.message || error || '');
  return /IsDeleted/i.test(msg) && /column|does not exist|not find|unknown/i.test(msg);
}

function isMissingColumn(error, columnName) {
  const msg = String(error?.message || error || '');
  return /column/i.test(msg) && new RegExp(columnName, 'i').test(msg);
}

async function withOptionalIsDeletedFilter(buildQuery) {
  let result = await buildQuery(true);
  if (result.error && isMissingIsDeletedColumn(result.error)) {
    console.warn('[weight.repository] IsDeleted missing — retrying without soft-delete filter');
    result = await buildQuery(false);
  }
  return result;
}

export async function findPreviousEntry(userId, excludeId = null) {
  const supabase = getSupabaseClient();
  const run = (withDeletedFilter) => {
    let q = supabase
      .from(TABLE)
      .select('ID, Weight, CreatedAt')
      .eq('UserId', parseInt(userId));
    if (withDeletedFilter) q = q.or(ACTIVE_WEIGHT_FILTER);
    q = q.order('CreatedAt', { ascending: false });
    if (excludeId) q = q.neq('ID', excludeId);
    return q.limit(1).maybeSingle();
  };
  const { data } = await withOptionalIsDeletedFilter(run);
  return data || null;
}

export async function findEntryById(entryId) {
  const supabase = getSupabaseClient();
  const { data } = await supabase
    .from(TABLE)
    .select('ID, Weight, BodyFat, CreatedAt')
    .eq('ID', entryId)
    .maybeSingle();
  return data || null;
}

/**
 * Latest non-null BodyFat % for a user (most recent weight record).
 * @param {number|string} userId
 * @returns {Promise<number|null>}
 */
export async function findLatestBodyFat(userId) {
  const supabase = getSupabaseClient();
  const run = (withDeletedFilter) => {
    let q = supabase
      .from(TABLE)
      .select('BodyFat')
      .eq('UserId', parseInt(userId))
      .not('BodyFat', 'is', null);
    if (withDeletedFilter) q = q.or(ACTIVE_WEIGHT_FILTER);
    return q.order('CreatedAt', { ascending: false }).limit(1).maybeSingle();
  };
  const { data, error } = await withOptionalIsDeletedFilter(run);
  if (error || !data?.BodyFat) return null;
  const bf = parseFloat(data.BodyFat);
  return Number.isFinite(bf) ? bf : null;
}

/**
 * Latest weight logged on a specific business calendar day (IST-aware).
 * Used for marathon Day 0 / Day 10 comparison — not a substitute for latest overall weight.
 *
 * @param {number|string} userId
 * @param {string} dateYmd YYYY-MM-DD
 * @param {string} [timezoneIana]
 * @returns {Promise<{ Weight: number|string, CreatedAt: string }|null>}
 */
export async function findLatestWeightOnCalendarDay(userId, dateYmd, timezoneIana = IANA_IST) {
  const uid = Number.parseInt(String(userId), 10);
  if (!Number.isFinite(uid) || uid <= 0 || !dateYmd) return null;

  const supabase = getSupabaseClient();
  const run = (withDeletedFilter) => {
    let q = supabase
      .from(TABLE)
      .select('Weight, CreatedAt')
      .eq('UserId', uid);
    if (withDeletedFilter) q = q.or(ACTIVE_WEIGHT_FILTER);
    return applyDayFilterWidened(q, 'CreatedAt', dateYmd, timezoneIana);
  };

  const { data, error } = await withOptionalIsDeletedFilter(run);
  if (error || !Array.isArray(data) || data.length === 0) return null;

  const dayRows = filterRowsByCalendarDay(data, dateYmd, timezoneIana, 'CreatedAt');
  if (!dayRows.length) return null;

  const sorted = [...dayRows].sort((a, b) => {
    const aMs = new Date(a.CreatedAt).getTime();
    const bMs = new Date(b.CreatedAt).getTime();
    return bMs - aMs;
  });
  const latest = sorted[0];
  const weight = parseFloat(latest.Weight);
  if (!Number.isFinite(weight) || weight <= 0) return null;
  return latest;
}

/** Max calendar lookback when resolving marathon anchor weights before an end date. */
const MARATHON_ANCHOR_WEIGHT_LOOKBACK_DAYS = 120;

/**
 * Latest weight on `dateYmd`, or the most recent weight logged on an earlier calendar day.
 * Used when a marathon end anchor day has no weight log.
 *
 * @param {number|string} userId
 * @param {string} dateYmd YYYY-MM-DD inclusive upper bound
 * @param {string} [timezoneIana]
 * @returns {Promise<{ Weight: number|string, CreatedAt: string }|null>}
 */
export async function findLatestWeightOnOrBeforeCalendarDay(userId, dateYmd, timezoneIana = IANA_IST) {
  const onDay = await findLatestWeightOnCalendarDay(userId, dateYmd, timezoneIana);
  if (onDay) return onDay;

  const uid = Number.parseInt(String(userId), 10);
  if (!Number.isFinite(uid) || uid <= 0 || !dateYmd) return null;

  const lookbackStartYmd = shiftDateYmd(
    dateYmd,
    -MARATHON_ANCHOR_WEIGHT_LOOKBACK_DAYS,
    timezoneIana,
  );
  const supabase = getSupabaseClient();
  const run = (withDeletedFilter) => {
    let q = supabase
      .from(TABLE)
      .select('Weight, CreatedAt')
      .eq('UserId', uid);
    if (withDeletedFilter) q = q.or(ACTIVE_WEIGHT_FILTER);
    return applyDateRangeFilterWidened(q, 'CreatedAt', lookbackStartYmd, dateYmd, timezoneIana)
      .order('CreatedAt', { ascending: false })
      .limit(100);
  };

  const { data, error } = await withOptionalIsDeletedFilter(run);
  if (error || !Array.isArray(data) || data.length === 0) return null;

  const eligible = filterRowsOnOrBeforeCalendarDay(data, dateYmd, timezoneIana, 'CreatedAt');
  if (!eligible.length) return null;

  const sorted = [...eligible].sort((a, b) => {
    const aMs = new Date(a.CreatedAt).getTime();
    const bMs = new Date(b.CreatedAt).getTime();
    return bMs - aMs;
  });
  const latest = sorted[0];
  const weight = parseFloat(latest.Weight);
  if (!Number.isFinite(weight) || weight <= 0) return null;
  return latest;
}

export async function syncBmrToTeamTable(userId, bmrValue) {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('team_table')
    .update({ Bmr: bmrValue })
    .eq('UserId', parseInt(userId));
  if (error) console.warn('[weight.repository] BMR sync failed:', error.message);
}

export async function insertEntry(payload) {
  const supabase = getSupabaseClient();
  // Explicit column list avoids RETURNING IsDeleted when that column is absent in some envs.
  const { data, error } = await supabase
    .from(TABLE)
    .insert(payload)
    .select(WEIGHT_ROW_SELECT)
    .single();
  if (error) throw error;
  return data;
}

const IMMUTABLE_TIMESTAMP_FIELDS = new Set([
  'CreatedAt', 'created_at', 'UpdatedAt', 'updated_at',
]);

export async function updateEntry(entryId, userId, updates) {
  const supabase = getSupabaseClient();
  const safeUpdates = Object.fromEntries(
    Object.entries(updates).filter(([key]) => !IMMUTABLE_TIMESTAMP_FIELDS.has(key)),
  );
  const run = (withDeletedFilter) => {
    let q = supabase
      .from(TABLE)
      .update({ ...safeUpdates, UpdatedAt: legacyIstWallNow() })
      .eq('ID', entryId)
      .eq('UserId', parseInt(userId));
    if (withDeletedFilter) q = q.or(ACTIVE_WEIGHT_FILTER);
    return q.select(WEIGHT_ROW_SELECT).single();
  };
  const { data, error } = await withOptionalIsDeletedFilter(run);
  if (error) throw error;
  return data;
}

export async function listHistory(userId, includeImage, { limit = null, offset = 0 } = {}) {
  const supabase = getSupabaseClient();
  const selectFields = includeImage
    ? 'ID, UserId, Weight, Bmi, BodyFat, MuscleMass, Bmr, WeightImageBase64, CreatedAt'
    : 'ID, UserId, Weight, Bmi, BodyFat, MuscleMass, Bmr, CreatedAt';
  const run = (withDeletedFilter) => {
    let query = supabase
      .from(TABLE)
      .select(selectFields)
      .eq('UserId', userId);
    if (withDeletedFilter) query = query.or(ACTIVE_WEIGHT_FILTER);
    query = query.order('CreatedAt', { ascending: false });
    if (Number.isFinite(limit) && limit > 0) {
      const from = Number.isFinite(offset) && offset >= 0 ? offset : 0;
      query = query.range(from, from + limit - 1);
    }
    return query;
  };
  const { data, error } = await withOptionalIsDeletedFilter(run);
  if (error) throw error;
  return data || [];
}

export async function listLatestImages(userId, count = 10) {
  const supabase = getSupabaseClient();
  const run = (withDeletedFilter) => {
    let q = supabase
      .from(TABLE)
      .select('ID, WeightImageBase64')
      .eq('UserId', userId);
    if (withDeletedFilter) q = q.or(ACTIVE_WEIGHT_FILTER);
    return q.order('CreatedAt', { ascending: false }).limit(count);
  };
  const { data, error } = await withOptionalIsDeletedFilter(run);
  if (error) throw error;
  return data || [];
}

export async function listAllWeightsForStats(userId) {
  const supabase = getSupabaseClient();
  const run = (withDeletedFilter) => {
    let q = supabase
      .from(TABLE)
      .select('Weight, CreatedAt')
      .eq('UserId', userId);
    if (withDeletedFilter) q = q.or(ACTIVE_WEIGHT_FILTER);
    return q.order('CreatedAt', { ascending: false });
  };
  const { data, error } = await withOptionalIsDeletedFilter(run);
  if (error) throw error;
  return data || [];
}

export async function getImageById(userId, id) {
  const supabase = getSupabaseClient();
  const run = (withDeletedFilter) => {
    let q = supabase
      .from(TABLE)
      .select('ID, WeightImageBase64')
      .eq('UserId', userId)
      .eq('ID', id);
    if (withDeletedFilter) q = q.or(ACTIVE_WEIGHT_FILTER);
    return q.limit(1).maybeSingle();
  };
  const { data, error } = await withOptionalIsDeletedFilter(run);
  if (error) throw error;
  return data || null;
}

export async function softDelete(entryId, userId) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TABLE)
    .update({ IsDeleted: 1, UpdatedAt: legacyIstWallNow() })
    .eq('ID', entryId)
    .eq('UserId', userId)
    .select();
  if (error) throw error;
  return data || [];
}

export async function checkOwnership(entryId, userId) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select('"ID"')
    .eq('"ID"', entryId)
    .eq('"UserId"', userId)
    .limit(1);
  if (error) throw error;
  return Array.isArray(data) && data.length > 0;
}

export async function updateWeightImageKey(recordId, userId, imageKey) {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from(TABLE)
    .update({ WeightImageKey: imageKey })
    .eq('ID', recordId)
    .eq('UserId', parseInt(userId, 10));
  if (error) {
    if (isMissingColumn(error, 'WeightImageKey')) {
      throw new Error('Run migration add_weight_image_key_to_weight_records_table.sql before weight R2');
    }
    throw error;
  }
}

/**
 * Scale photos in the IST calendar window that have not been copied to R2 yet.
 */
export async function listPendingWeightImageBackfill({
  from = 0,
  to = 49,
  startYmd,
  endYmd,
} = {}) {
  const supabase = getSupabaseClient();
  const endExclusiveYmd = shiftDateYmd(endYmd, 1, IANA_IST);
  const run = (withDeletedFilter) => {
    let q = supabase
      .from(TABLE)
      .select('ID, UserId, WeightImageBase64, WeightImageKey, CreatedAt')
      .is('WeightImageKey', null)
      .not('WeightImageBase64', 'is', null)
      .gte('CreatedAt', `${startYmd} 00:00:00`)
      .lt('CreatedAt', `${endExclusiveYmd} 00:00:00`);
    if (withDeletedFilter) q = q.or(ACTIVE_WEIGHT_FILTER);
    return q
      .order('CreatedAt', { ascending: true })
      .order('ID', { ascending: true })
      .range(from, to);
  };
  const { data, error } = await withOptionalIsDeletedFilter(run);
  if (error) {
    if (isMissingColumn(error, 'WeightImageKey')) {
      throw new Error('Run migration add_weight_image_key_to_weight_records_table.sql before backfill');
    }
    throw error;
  }
  return filterRowsByCalendarDateRange(data || [], startYmd, endYmd, IANA_IST, 'CreatedAt');
}

export async function restoreEntry(entryId) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TABLE)
    .update({ IsDeleted: 0, UpdatedAt: legacyIstWallNow() })
    .eq('"ID"', entryId)
    .select();
  if (error) throw error;
  return data || [];
}
