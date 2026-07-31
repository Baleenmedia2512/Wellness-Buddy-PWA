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
  const { data, error } = await supabase
    .from('team_table')
    .select('UserId, UserName, PhoneNumber, Email, CoachId, Role, Status')
    .in('UserId', userIds)
    .eq('Status', 'Active');
  
  if (error) throw error;
  return data || [];
}

/**
 * Fetch coach names for given coach IDs
 */
export async function fetchCoachNames(coachIds) {
  if (!coachIds || coachIds.length === 0) return {};
  
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('team_table')
    .select('UserId, UserName')
    .in('UserId', coachIds);
  
  if (error) throw error;
  
  const coachMap = {};
  (data || []).forEach(coach => {
    coachMap[coach.UserId] = coach.UserName;
  });
  return coachMap;
}

/**
 * Fetch time windows from activity_time_windows_table
 */
export async function fetchTimeWindows() {
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
  
  return {
    breakfast: windows.breakfast || { start: '05:30:00', end: '08:30:00' },
    lunch: windows.lunch || { start: '12:00:00', end: '16:00:00' },
    dinner: windows.dinner || { start: '17:30:00', end: '20:30:00' },
  };
}

/**
 * Fetch weight records for given user IDs and date range
 */
export async function fetchWeightRecords(userIds, startDate, endDate, timezoneIana = IANA_IST) {
  if (!userIds || userIds.length === 0) return [];
  
  const supabase = getSupabaseClient();
  let query = supabase
    .from('weight_records_table')
    .select('UserId, Weight, CreatedAt, City, Village, AttendanceType, CenterName, NutritionCenterId')
    .in('UserId', userIds)
    .or('IsDeleted.is.null,IsDeleted.eq.0');
  query = applyDateRangeFilterWidened(query, 'CreatedAt', startDate, endDate, timezoneIana);
  const { data, error } = await query.order('CreatedAt', { ascending: false });  
  if (error) throw error;
  return filterRowsByCalendarDateRange(data || [], startDate, endDate, timezoneIana, 'CreatedAt');
}

/**
 * Fetch education logs for given user IDs and date range
 * NOTE: education_logs_table uses mixed-case column names that require quoting.
 */
export async function fetchEducationRecords(userIds, startDate, endDate, timezoneIana = IANA_IST) {
  if (!userIds || userIds.length === 0) return [];
  
  const supabase = getSupabaseClient();
  const userIdsAsString = userIds.map(String);
  
  let query = supabase
    .from('education_logs_table')
    .select('"UserId", "Topic", "CreatedAt", attendance_type, center_name, nutrition_center_id, "City", "Village"')
    .in('"UserId"', userIdsAsString)
    .or('"IsDeleted".is.null,"IsDeleted".eq.0');
  query = applyDateRangeFilterWidened(query, '"CreatedAt"', startDate, endDate, timezoneIana);
  const { data, error } = await query.order('"CreatedAt"', { ascending: false });  
  if (error) throw error;
  
  // Filter out watch-synced "Calories Burned:" entries
  const filtered = (data || []).filter(log => {
    const topic = String(log.Topic || '');
    return !topic.startsWith('Calories Burned:');
  });
  return filterRowsByCalendarDateRange(filtered, startDate, endDate, timezoneIana, 'CreatedAt');
}

/**
 * Fetch food records for given user IDs and date range
 */
export async function fetchFoodRecords(userIds, startDate, endDate, timezoneIana = IANA_IST) {
  if (!userIds || userIds.length === 0) return [];
  
  const supabase = getSupabaseClient();
  const userIdsAsString = userIds.map(String);
  
  let query = supabase
    .from('food_nutrition_data_table')
    .select('UserID, CreatedAt, TotalCalories, AnalysisData, City, Village, AttendanceType, CenterName, NutritionCenterId')
    .in('UserID', userIdsAsString)
    .or('IsDeleted.is.null,IsDeleted.eq.0');
  query = applyDateRangeFilterWidened(query, 'CreatedAt', startDate, endDate, timezoneIana);
  const { data, error } = await query.order('CreatedAt', { ascending: false });  
  if (error) throw error;
  return filterFoodRowsByCalendarDateRange(data || [], startDate, endDate, timezoneIana, 'CreatedAt');
}
export async function fetchStepRecords(userIds, startDate, endDate, timezoneIana = IANA_IST) {
  if (!userIds || userIds.length === 0) return [];
  
  const supabase = getSupabaseClient();
  
  let query = supabase
    .from('daily_step_activity')
    .select('UserId, CreatedAt, Steps, CaloriesBurned')
    .in('UserId', userIds);
  query = applyDateRangeFilterWidened(query, 'CreatedAt', startDate, endDate, timezoneIana);
  const { data, error } = await query.order('CreatedAt', { ascending: false });  
  if (error) throw error;
  return filterRowsByCalendarDateRange(data || [], startDate, endDate, timezoneIana, 'CreatedAt');
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
function recordCalendarYmd(record, timezoneIana, { foodTimestamp = false, column = 'CreatedAt' } = {}) {
  try {
    const raw = record?.[column] ?? record?.CreatedAt;
    if (foodTimestamp) {
      return resolveFoodTimestamp(raw, timezoneIana).calendarYmd;
    }
    return timestampToCalendarYmd(normalizeStoredTimestampToUtcIso(raw, timezoneIana), timezoneIana);
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
 * Filter food records by meal time window
 */
export function filterFoodByMealTime(foodRecords, mealType, timeWindows, timezoneIana = IANA_IST) {
  const window = timeWindows[mealType];
  if (!window) return [];
  
  return foodRecords.filter(record => {
    // Skip beverage-only entries
    if (isExemptedBeverageOnly(record.AnalysisData)) return false;
    
    try {
      const { timeOfDay } = resolveFoodTimestamp(record.CreatedAt, timezoneIana);
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
  return foodRecords.filter(record => {
    return isExemptedBeverageOnly(record.AnalysisData);
  });
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
