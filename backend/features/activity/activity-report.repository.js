/**
 * Activity Report Repository
 * Fetches activity records and member details for downline users
 */
import { getSupabaseClient } from '../../utils/supabaseClient.js';
import { isExemptedBeverageOnly, isExemptedFood } from '../../utils/foodTypeDetection.js';

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
 * Fetch member details from team_table for given user IDs
 */
export async function fetchMemberDetails(userIds) {
  if (!userIds || userIds.length === 0) return [];
  
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('team_table')
    .select('UserId, UserName, PhoneNumber, Email, CoachId, Role')
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
export async function fetchWeightRecords(userIds, startDate, endDate) {
  if (!userIds || userIds.length === 0) return [];
  
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('weight_records_table')
    .select('UserId, Weight, CreatedAt, City, Village, AttendanceType, CenterName, NutritionCenterId')
    .in('UserId', userIds)
    .gte('CreatedAt', `${startDate}T00:00:00`)
    .lte('CreatedAt', `${endDate}T23:59:59`)
    .or('IsDeleted.is.null,IsDeleted.eq.0')
    .order('CreatedAt', { ascending: false });
  
  if (error) throw error;
  return data || [];
}

/**
 * Fetch education logs for given user IDs and date range
 * NOTE: education_logs_table uses mixed-case column names that require quoting.
 */
export async function fetchEducationRecords(userIds, startDate, endDate) {
  if (!userIds || userIds.length === 0) return [];
  
  const supabase = getSupabaseClient();
  // education_logs_table stores UserId as string
  const userIdsAsString = userIds.map(String);
  
  const { data, error } = await supabase
    .from('education_logs_table')
    .select('"UserId", "Topic", "CreatedAt", attendance_type, center_name, nutrition_center_id, "City", "Village"')
    .in('"UserId"', userIdsAsString)
    .gte('"CreatedAt"', `${startDate}T00:00:00`)
    .lte('"CreatedAt"', `${endDate}T23:59:59`)
    .or('"IsDeleted".is.null,"IsDeleted".eq.0')
    .order('"CreatedAt"', { ascending: false });
  
  if (error) throw error;
  
  // Filter out watch-synced "Calories Burned:" entries
  return (data || []).filter(log => {
    const topic = String(log.Topic || '');
    return !topic.startsWith('Calories Burned:');
  });
}

/**
 * Fetch food records for given user IDs and date range
 */
export async function fetchFoodRecords(userIds, startDate, endDate) {
  if (!userIds || userIds.length === 0) return [];
  
  const supabase = getSupabaseClient();
  const userIdsAsString = userIds.map(String);
  
  const { data, error } = await supabase
    .from('food_nutrition_data_table')
    .select('UserID, CreatedAt, TotalCalories, AnalysisData, City, Village, AttendanceType, CenterName, NutritionCenterId')
    .in('UserID', userIdsAsString)
    .gte('CreatedAt', `${startDate}T00:00:00`)
    .lte('CreatedAt', `${endDate}T23:59:59`)
    .or('IsDeleted.is.null,IsDeleted.eq.0')
    .order('CreatedAt', { ascending: false });
  
  if (error) throw error;
  return data || [];
}

/**
 * Fetch step activity records for given user IDs and date range
 */
export async function fetchStepRecords(userIds, startDate, endDate) {
  if (!userIds || userIds.length === 0) return [];
  
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('daily_step_activity')
    .select('UserId, CreatedAt, Steps, CaloriesBurned')
    .in('UserId', userIds)
    .gte('CreatedAt', `${startDate}T00:00:00`)
    .lte('CreatedAt', `${endDate}T23:59:59`)
    .order('CreatedAt', { ascending: false });
  
  if (error) throw error;
  return data || [];
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
 * Keep only the first log per member per calendar day (earliest CreatedAt).
 * Used by attendance report detail so repeated uploads on the same day show once.
 */
export function dedupeFirstLogPerMemberPerDay(records) {
  if (!records || records.length === 0) return [];

  const sorted = [...records].sort((a, b) =>
    String(a.CreatedAt || '').localeCompare(String(b.CreatedAt || ''))
  );

  const seen = new Set();
  const deduped = [];

  for (const record of sorted) {
    const dateMatch = String(record.CreatedAt || '').match(/^(\d{4}-\d{2}-\d{2})/);
    const date = dateMatch ? dateMatch[1] : 'unknown';
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
export function filterFoodByMealTime(foodRecords, mealType, timeWindows) {
  const window = timeWindows[mealType];
  if (!window) return [];
  
  return foodRecords.filter(record => {
    // Skip beverage-only entries
    if (isExemptedBeverageOnly(record.AnalysisData)) return false;
    
    // Extract time from CreatedAt
    const timeMatch = String(record.CreatedAt || '').match(/(\d{2}:\d{2}:\d{2})/);
    if (!timeMatch) return false;
    
    const time = timeMatch[1];
    return time >= window.start && time <= window.end;
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
    (analysisData?.foods || []).forEach(food => {
      if (isExemptedFood(food.name)) {
        const ml = parseFloat(food.volume_ml) || parseFloat(food.weight_g) || parseFloat(food.estimatedWeight) || 0;
        totalMl += ml;
      }
    });
    
    return (totalMl / 1000).toFixed(2); // Convert to liters
  } catch (e) {
    return '0.00';
  }
}
