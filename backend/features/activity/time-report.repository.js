import { getSupabaseClient } from '../../utils/supabaseClient.js';
import { applyDateRangeFilter } from '../../shared/lib/datetime/applyDayFilter.js';
import { IANA_IST } from '../../shared/lib/datetime/index.js';

export async function fetchAdminUsers() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('team_table')
    .select('UserId, UserName, Email, Role, Bmr, PhysicalActivityLevel')
    .eq('Status', 'Active');
  if (error) throw error;
  return data || [];
}

export async function fetchSelfUser(userIdInt) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('team_table')
    .select('UserId, UserName, Email, Role, Bmr, PhysicalActivityLevel')
    .eq('UserId', userIdInt)
    .eq('Status', 'Active')
    .maybeSingle();
  if (error) return null;
  return data;
}

export async function fetchTimeReportData(targetUserIds, startDate, endDate, timezoneIana = IANA_IST) {
  const supabase = getSupabaseClient();
  const targetIdsAsString = targetUserIds.map(String);

  let weightRangeQuery = supabase.from('weight_records_table')
    .select('UserId, CreatedAt')
    .in('UserId', targetUserIds)
    .or('IsDeleted.is.null,IsDeleted.eq.0');
  weightRangeQuery = applyDateRangeFilter(weightRangeQuery, 'CreatedAt', startDate, endDate, timezoneIana);

  let educationRangeQuery = supabase.from('education_logs_table')
    .select('"UserId", "CreatedAt", "Topic"')
    .in('"UserId"', targetIdsAsString)
    .or('"IsDeleted".is.null,"IsDeleted".eq.0');
  educationRangeQuery = applyDateRangeFilter(educationRangeQuery, '"CreatedAt"', startDate, endDate, timezoneIana);

  // Single food fetch — previously duplicated as calorie + analysis queries against the same table
  let foodRangeQuery = supabase.from('food_nutrition_data_table')
    .select('UserID, CreatedAt, TotalCalories, AnalysisData')
    .in('UserID', targetIdsAsString)
    .or('IsDeleted.is.null,IsDeleted.eq.0');
  foodRangeQuery = applyDateRangeFilter(foodRangeQuery, 'CreatedAt', startDate, endDate, timezoneIana);

  let stepRangeQuery = supabase.from('daily_step_activity')
    .select('UserId, CreatedAt, CaloriesBurned, Steps')
    .in('UserId', targetUserIds);
  stepRangeQuery = applyDateRangeFilter(stepRangeQuery, 'CreatedAt', startDate, endDate, timezoneIana);

  return Promise.all([
    supabase.from('activity_time_windows_table')
      .select('ActivityType, WindowStartTime, WindowEndTime')
      .is('EffectiveToDate', null),
    weightRangeQuery,
    educationRangeQuery,
    foodRangeQuery,
    stepRangeQuery,
    supabase.from('weight_records_table')
      .select('UserId, Weight, Bmr, CreatedAt')
      .in('UserId', targetUserIds)
      .order('CreatedAt', { ascending: false }),
  ]);
}
