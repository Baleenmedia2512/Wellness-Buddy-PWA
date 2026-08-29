/**
 * Activity Report Repository
 * Fetches activity records and member details for downline users
 */
import { getSupabaseClient } from '../../utils/supabaseClient.js';
import { isExemptedBeverageOnly, isExemptedFood, extractFoodItemsFromAnalysis, getFoodItemName } from '../../utils/foodTypeDetection.js';
import { applyDateRangeFilterWidened } from '../../shared/lib/datetime/applyDayFilter.js';
import {
  IANA_IST,
  filterRowsByCalendarDateRange,
  normalizeStoredTimestampToUtcIso,
  timestampToCalendarYmd,
} from '../../shared/lib/datetime/index.js';
import {
  filterFoodRowsByCalendarDateRange,
  resolveFoodTimestamp,
} from '../../shared/lib/datetime/foodTimestamp.js';
import { resolveTimezoneFromMap } from '../user/domain/userTimezone.js';

/** Keep PostgREST IN lists small to avoid statement timeouts on large teams. */
const IN_CHUNK_SIZE = 80;

/**
 * @template T
 * @param {Array<string|number>} ids
 * @param {(chunk: Array<string|number>) => Promise<{ data: T[]|null, error: object|null }>} runChunkQuery
 * @param {{ sequential?: boolean }} [options]
 * @returns {Promise<T[]>}
 */
async function fetchRowsInChunks(ids, runChunkQuery, { sequential = false } = {}) {
  const uniqueIds = [...new Set(ids)];
  if (uniqueIds.length === 0) return [];

  if (uniqueIds.length <= IN_CHUNK_SIZE) {
    const { data, error } = await runChunkQuery(uniqueIds);
    if (error) throw error;
    return data || [];
  }

  const chunks = [];
  for (let i = 0; i < uniqueIds.length; i += IN_CHUNK_SIZE) {
    chunks.push(uniqueIds.slice(i, i + IN_CHUNK_SIZE));
  }

  if (sequential) {
    const results = [];
    for (const chunk of chunks) {
      const { data, error } = await runChunkQuery(chunk);
      if (error) throw error;
      results.push(...(data || []));
    }
    return results;
  }

  const chunkResults = await Promise.all(chunks.map(async (chunk) => {
    const { data, error } = await runChunkQuery(chunk);
    if (error) throw error;
    return data || [];
  }));
  return chunkResults.flat();
}
/**
 * Fetch ALL active members (used by admin role)
 */
export async function fetchAllActiveMembers() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('team_table')
    .select('UserId, UserName, PhoneNumber, Email, CoachId, Role')
    .eq('Status', 'Active');
  if (error) throw error;
  return data || [];
}

/**
 * Active members whose CoachId is the given user (indexed lookup — no full-table scan).
 */
export async function fetchDirectMemberIds(coachId) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('team_table')
    .select('UserId')
    .eq('CoachId', coachId)
    .eq('Status', 'Active');
  if (error) throw error;
  return (data || []).map((row) => row.UserId).filter(Boolean);
}

/**
 * Fetch member details from team_table for given user IDs
 */
export async function fetchMemberDetails(userIds) {
  if (!userIds || userIds.length === 0) return [];

  const supabase = getSupabaseClient();
  return fetchRowsInChunks(userIds, (chunk) => supabase
    .from('team_table')
    .select('UserId, UserName, PhoneNumber, Email, CoachId, Role, Status')
    .in('UserId', chunk)
    .eq('Status', 'Active'));
}

/**
 * Fetch coach names for given coach IDs
 */
export async function fetchCoachNames(coachIds) {
  if (!coachIds || coachIds.length === 0) return {};

  const supabase = getSupabaseClient();
  const data = await fetchRowsInChunks(coachIds, (chunk) => supabase
    .from('team_table')
    .select('UserId, UserName')
    .in('UserId', chunk));

  const coachMap = {};
  data.forEach((coach) => {
    coachMap[coach.UserId] = coach.UserName;
  });
  return coachMap;
}

/**
 * Fetch time windows from activity_time_windows_table
 * Cached in-process — windows change rarely and are hit on every bootstrap.
 */
let timeWindowsCache = null;
let timeWindowsCacheExpiresAt = 0;
const TIME_WINDOWS_TTL_MS = 5 * 60 * 1000;

export async function fetchTimeWindows() {
  const now = Date.now();
  if (timeWindowsCache && now < timeWindowsCacheExpiresAt) {
    return timeWindowsCache;
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('activity_time_windows_table')
    .select('ActivityType, WindowStartTime, WindowEndTime')
    .is('EffectiveToDate', null);
  
  if (error) {
    // Return default windows if fetch fails
    return {
      breakfast: { start: '05:30:00', end: '08:30:00' },
      lunch: { start: '12:00:00', end: '16:00:00' },
      dinner: { start: '17:30:00', end: '20:30:00' },
    };
  }
  
  const windows = {};
  (data || []).forEach(tw => {
    const key = (tw.ActivityType || '').toLowerCase();
    windows[key] = { start: tw.WindowStartTime, end: tw.WindowEndTime };
  });
  
  const resolved = {
    breakfast: windows.breakfast || { start: '05:30:00', end: '08:30:00' },
    lunch: windows.lunch || { start: '12:00:00', end: '16:00:00' },
    dinner: windows.dinner || { start: '17:30:00', end: '20:30:00' },
  };
  timeWindowsCache = resolved;
  timeWindowsCacheExpiresAt = now + TIME_WINDOWS_TTL_MS;
  return resolved;
}

/**
 * Fetch weight records for given user IDs and date range
 */
export async function fetchWeightRecords(userIds, startDate, endDate, timezoneIana = IANA_IST) {
  if (!userIds || userIds.length === 0) return [];

  const supabase = getSupabaseClient();
  const data = await fetchRowsInChunks(userIds, (chunk) => {
    let query = supabase
      .from('weight_records_table')
      .select('UserId, Weight, CreatedAt, City, Village, AttendanceType, CenterName, NutritionCenterId')
      .in('UserId', chunk)
      .or('IsDeleted.is.null,IsDeleted.eq.0')
      .order('CreatedAt', { ascending: false });
    query = applyDateRangeFilterWidened(query, 'CreatedAt', startDate, endDate, timezoneIana);
    return query;
  });

  return filterRowsByCalendarDateRange(data, startDate, endDate, timezoneIana, 'CreatedAt');
}

/**
 * Fetch education logs for given user IDs and date range
 * NOTE: education_logs_table uses mixed-case column names that require quoting.
 */
export async function fetchEducationRecords(userIds, startDate, endDate, timezoneIana = IANA_IST) {
  if (!userIds || userIds.length === 0) return [];

  const supabase = getSupabaseClient();
  const userIdsAsString = userIds.map(String);
  const data = await fetchRowsInChunks(userIdsAsString, (chunk) => {
    let query = supabase
      .from('education_logs_table')
      .select('"UserId", "Topic", "CreatedAt", attendance_type, center_name, nutrition_center_id, "City", "Village"')
      .in('"UserId"', chunk)
      .or('"IsDeleted".is.null,"IsDeleted".eq.0')
      .order('CreatedAt', { ascending: false });
    query = applyDateRangeFilterWidened(query, '"CreatedAt"', startDate, endDate, timezoneIana);
    return query;
  });

  const filtered = data.filter((log) => {
    const topic = String(log.Topic || '');
    return !topic.startsWith('Calories Burned:');
  });
  return filterRowsByCalendarDateRange(filtered, startDate, endDate, timezoneIana, 'CreatedAt');
}

/**
 * Fetch smartwatch / manual exercise calorie logs for given user IDs and date range.
 * Stored in education_logs_table with Topic "Calories Burned: N kcal".
 */
export async function fetchWatchCalorieRecords(userIds, startDate, endDate, timezoneIana = IANA_IST) {
  if (!userIds || userIds.length === 0) return [];

  const supabase = getSupabaseClient();
  const userIdsAsString = userIds.map(String);
  const data = await fetchRowsInChunks(userIdsAsString, (chunk) => {
    let query = supabase
      .from('education_logs_table')
      .select('"UserId", "Topic", "CreatedAt", center_name, nutrition_center_id, "City", "Village"')
      .in('"UserId"', chunk)
      .or('"IsDeleted".is.null,IsDeleted.eq.0')
      .ilike('"Topic"', 'Calories Burned:%')
      .order('"CreatedAt"', { ascending: false });
    query = applyDateRangeFilterWidened(query, '"CreatedAt"', startDate, endDate, timezoneIana);
    return query;
  });

  return filterRowsByCalendarDateRange(data, startDate, endDate, timezoneIana, 'CreatedAt');
}

/**
 * Fetch food records for given user IDs and date range.
 * AnalysisData is omitted by default. Enable it for water volume or beverage
 * detection when ProcessedBy was not persisted as a preset (legacy water tracker).
 */
export async function fetchFoodRecords(
  userIds,
  startDate,
  endDate,
  timezoneIana = IANA_IST,
  { includeAnalysisData = false } = {},
) {
  if (!userIds || userIds.length === 0) return [];

  const supabase = getSupabaseClient();
  const userIdsAsString = userIds.map(String);
  const columns = includeAnalysisData
    ? 'UserID, CreatedAt, TotalCalories, ProcessedBy, AnalysisData, City, Village, AttendanceType, CenterName, NutritionCenterId'
    : 'UserID, CreatedAt, TotalCalories, ProcessedBy, City, Village, AttendanceType, CenterName, NutritionCenterId';
  const data = await fetchRowsInChunks(userIdsAsString, (chunk) => {
    let query = supabase
      .from('food_nutrition_data_table')
      .select(columns)
      .in('UserID', chunk)
      .or('IsDeleted.is.null,IsDeleted.eq.0')
      .order('CreatedAt', { ascending: false });
    query = applyDateRangeFilterWidened(query, 'CreatedAt', startDate, endDate, timezoneIana);
    return query;
  });

  return filterFoodRowsByCalendarDateRange(data, startDate, endDate, timezoneIana, 'CreatedAt');
}

/**
 * Hydrate AnalysisData for specific food row IDs (water volume on detail tab).
 * @param {Array<string|number>} userIds
 * @param {string} startDate
 * @param {string} endDate
 * @param {string} [timezoneIana]
 */
export async function fetchFoodAnalysisForUsers(userIds, startDate, endDate, timezoneIana = IANA_IST) {
  if (!userIds || userIds.length === 0) return [];
  return fetchFoodRecords(userIds, startDate, endDate, timezoneIana, { includeAnalysisData: true });
}

/**
 * True when a food row is beverage-only for meal discipline / report pills.
 * Prefers ProcessedBy presets so list queries can omit huge AnalysisData payloads.
 */
export function isReportBeverageRecord(record) {
  const by = String(record?.ProcessedBy || '').toLowerCase().trim();
  if (by === 'water_preset' || by === 'afresh_preset') return true;
  if (record?.AnalysisData) {
    try {
      const parsed = typeof record.AnalysisData === 'string'
        ? JSON.parse(record.AnalysisData) : record.AnalysisData;
      const embedded = String(parsed?.processedBy || '').toLowerCase().trim();
      if (embedded === 'water_preset' || embedded === 'afresh_preset') return true;
    } catch {
      /* fall through to beverage-only check */
    }
    return isExemptedBeverageOnly(record.AnalysisData);
  }
  return false;
}

export async function fetchStepRecords(userIds, startDate, endDate, timezoneIana = IANA_IST) {
  if (!userIds || userIds.length === 0) return [];

  const supabase = getSupabaseClient();
  const data = await fetchRowsInChunks(userIds, (chunk) => {
    let query = supabase
      .from('daily_step_activity')
      .select('UserId, CreatedAt, Steps, CaloriesBurned')
      .in('UserId', chunk)
      .order('CreatedAt', { ascending: false });
    query = applyDateRangeFilterWidened(query, 'CreatedAt', startDate, endDate, timezoneIana);
    return query;
  });

  return filterRowsByCalendarDateRange(data, startDate, endDate, timezoneIana, 'CreatedAt');
}

/**
 * Fetch nutrition center details by center ID
 */
export async function fetchNutritionCenters(centerIds) {
  if (!centerIds || centerIds.length === 0) return {};
  
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('nutrition_centers_table')
    .select('Id, CenterName')
    .in('Id', centerIds);
  
  if (error) return {};
  
  const centerMap = {};
  (data || []).forEach(center => {
    centerMap[center.Id] = center.CenterName;
  });
  return centerMap;
}

/**
 * Resolve business calendar YYYY-MM-DD for a record's CreatedAt.
 */
function recordCalendarYmd(record, timezoneIana, {
  foodTimestamp = false,
  column = 'CreatedAt',
  timezoneByUserId = null,
} = {}) {
  try {
    const raw = record?.[column] ?? record?.CreatedAt;
    const uid = record?.UserID ?? record?.UserId;
    const tz = resolveTimezoneFromMap(timezoneByUserId, uid, timezoneIana);
    if (foodTimestamp) {
      return resolveFoodTimestamp(raw, tz).calendarYmd;
    }
    // Legacy IST wall storage → UTC, then owner calendar day.
    return timestampToCalendarYmd(normalizeStoredTimestampToUtcIso(raw, IANA_IST), tz);
  } catch {
    return 'unknown';
  }
}

/**
 * Keep only the latest log per member per calendar day (newest CreatedAt).
 * Used for weight records where the most recent upload is the authoritative value.
 */
export function dedupeLatestLogPerMemberPerDay(records, timezoneIana = IANA_IST, options = {}) {
  if (!records || records.length === 0) return [];

  // Sort descending so the latest timestamp comes first
  const sorted = [...records].sort((a, b) =>
    String(b.CreatedAt || '').localeCompare(String(a.CreatedAt || ''))
  );

  const seen = new Set();
  const deduped = [];

  for (const record of sorted) {
    const date = recordCalendarYmd(record, timezoneIana, options);
    const userKey = String(record.UserID ?? record.UserId ?? '');
    const key = `${userKey}-${date}`;

    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(record);
    }
  }

  // Newest first for the report table
  return deduped.sort((a, b) =>
    String(b.CreatedAt || '').localeCompare(String(a.CreatedAt || ''))
  );
}

/**
 * Keep only the first log per member per calendar day (earliest CreatedAt).
 * Used by attendance report detail so repeated uploads on the same day show once.
 */
export function dedupeFirstLogPerMemberPerDay(records, timezoneIana = IANA_IST, options = {}) {
  if (!records || records.length === 0) return [];

  const sorted = [...records].sort((a, b) =>
    String(a.CreatedAt || '').localeCompare(String(b.CreatedAt || ''))
  );

  const seen = new Set();
  const deduped = [];

  for (const record of sorted) {
    const date = recordCalendarYmd(record, timezoneIana, options);
    const userKey = String(record.UserID ?? record.UserId ?? '');
    const key = `${userKey}-${date}`;

    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(record);
    }
  }

  // Newest first for the report table
  return deduped.sort((a, b) =>
    String(b.CreatedAt || '').localeCompare(String(a.CreatedAt || ''))
  );
}

/**
 * Filter food records by meal time window.
 * When `timezoneByUserId` is provided, each record uses that member's TZ.
 */
export function filterFoodByMealTime(
  foodRecords,
  mealType,
  timeWindows,
  timezoneIana = IANA_IST,
  timezoneByUserId = null,
) {
  const window = timeWindows[mealType];
  if (!window) return [];

  return foodRecords.filter((record) => {
    if (isReportBeverageRecord(record)) return false;

    try {
      const tz = resolveTimezoneFromMap(
        timezoneByUserId,
        record.UserID ?? record.UserId,
        timezoneIana,
      );
      const { timeOfDay } = resolveFoodTimestamp(record.CreatedAt, tz);
      return timeOfDay >= window.start && timeOfDay <= window.end;
    } catch {
      return false;
    }
  });
}

/**
 * Filter food records for water/beverage intake
 */
export function filterWaterRecords(foodRecords) {
  return foodRecords.filter((record) => isReportBeverageRecord(record));
}

/**
 * Calculate water volume in liters from beverage record
 */
export function calculateWaterVolume(record) {
  try {
    const analysisData = typeof record.AnalysisData === 'string'
      ? JSON.parse(record.AnalysisData)
      : record.AnalysisData;
    
    let totalMl = 0;
    extractFoodItemsFromAnalysis(analysisData).forEach(food => {
      if (isExemptedFood(getFoodItemName(food))) {
        const ml = parseFloat(food.volume_ml) || parseFloat(food.weight_g) || parseFloat(food.estimatedWeight) || 0;
        totalMl += ml;
      }
    });
    
    return (totalMl / 1000).toFixed(2); // Convert to liters
  } catch (e) {
    return '0.00';
  }
}
