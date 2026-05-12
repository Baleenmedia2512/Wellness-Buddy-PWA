import { getSupabaseClient } from '../../utils/supabaseClient.js';

export async function fetchAdminUsers() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('team_table')
    .select('UserId, UserName, Email, Role, Bmr')
    .eq('Status', 'Active');
  if (error) throw error;
  return data || [];
}

export async function fetchSelfUser(userIdInt) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('team_table')
    .select('UserId, UserName, Email, Role, Bmr')
    .eq('UserId', userIdInt)
    .eq('Status', 'Active')
    .maybeSingle();
  if (error) return null;
  return data;
}

export async function fetchTimeReportData(targetUserIds, startStr, endStr) {
  const supabase = getSupabaseClient();
  const targetIdsAsString = targetUserIds.map(String);
  return Promise.all([
    supabase.from('activity_time_windows_table')
      .select('ActivityType, WindowStartTime, WindowEndTime')
      .is('EffectiveToDate', null),
    supabase.from('weight_records_table')
      .select('UserId, CreatedAt')
      .in('UserId', targetUserIds)
      .gte('CreatedAt', startStr)
      .lte('CreatedAt', endStr + 'T23:59:59')
      .or('IsDeleted.is.null,IsDeleted.eq.0'),
    supabase.from('education_logs_table')
      .select('"UserId", "CreatedAt", "Topic"')
      .in('"UserId"', targetIdsAsString)
      .gte('"CreatedAt"', startStr)
      .lte('"CreatedAt"', endStr + 'T23:59:59')
      .or('"IsDeleted".is.null,"IsDeleted".eq.0'),
    supabase.from('food_nutrition_data_table')
      .select('UserID, CreatedAt, TotalCalories, AnalysisData')
      .in('UserID', targetIdsAsString)
      .gte('CreatedAt', startStr)
      .lte('CreatedAt', endStr + 'T23:59:59')
      .or('IsDeleted.is.null,IsDeleted.eq.0'),
    supabase.from('food_nutrition_data_table')
      .select('UserID, CreatedAt, AnalysisData')
      .in('UserID', targetIdsAsString)
      .gte('CreatedAt', startStr)
      .lte('CreatedAt', endStr + 'T23:59:59')
      .or('IsDeleted.is.null,IsDeleted.eq.0'),
    supabase.from('daily_step_activity')
      .select('UserId, CreatedAt, CaloriesBurned, Steps')
      .in('UserId', targetUserIds)
      .gte('CreatedAt', startStr)
      .lte('CreatedAt', endStr + 'T23:59:59'),
    supabase.from('weight_records_table')
      .select('UserId, Weight, Bmr, CreatedAt')
      .in('UserId', targetUserIds)
      .order('CreatedAt', { ascending: false }),
  ]);
}
