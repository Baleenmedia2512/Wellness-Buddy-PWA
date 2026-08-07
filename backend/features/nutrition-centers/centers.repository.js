import { getSupabaseClient } from '../../utils/supabaseClient.js';
import { applyDateRangeFilter } from '../../shared/lib/datetime/applyDayFilter.js';
import { IANA_IST } from '../../shared/lib/datetime/index.js';

export async function findByName(name) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('nutrition_centers_table')
    .select('id, center_name')
    .ilike('center_name', name)
    .eq('is_deleted', false)
    .maybeSingle();
  return { data, error };
}

export async function findUserById(userId) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('team_table')
    .select('"UserId"')
    .eq('"UserId"', userId)
    .single();
  return { data, error };
}

export async function findUserRole(userId) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('team_table')
    .select('"Role"')
    .eq('"UserId"', userId)
    .single();
  return { data, error };
}

export async function insertCenter(payload) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('nutrition_centers_table')
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function findCenterOwner(centerId) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('nutrition_centers_table')
    .select('owner_user_id')
    .eq('id', centerId)
    .eq('is_deleted', false)
    .single();
  return { data, error };
}

export async function findCenterById(centerId) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('nutrition_centers_table')
    .select('id, center_name, latitude, longitude, education_hour, owner_user_id, owner_phone')
    .eq('id', centerId)
    .eq('is_deleted', false)
    .single();
  return { data, error };
}

export async function updateCenter(centerId, payload) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('nutrition_centers_table')
    .update(payload)
    .eq('id', centerId)
    .eq('is_deleted', false)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function softDeleteCenter(centerId) {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('nutrition_centers_table')
    .update({ status: 'inactive', is_deleted: true })
    .eq('id', centerId);
  if (error) throw error;
}

export async function findCoachTeamForUser(userIdNum) {
  const supabase = getSupabaseClient();
  const { data } = await supabase
    .from('coach_teams_table')
    .select('CoachId, CoCoachId')
    .or(`CoachId.eq.${userIdNum},CoCoachId.eq.${userIdNum}`)
    .eq('Status', 'active')
    .maybeSingle();
  return data;
}

export async function findDirectMembers(userIdNum) {
  const supabase = getSupabaseClient();
  const { data } = await supabase
    .from('team_table')
    .select('UserId')
    .eq('CoachId', userIdNum)
    .eq('Status', 'Active');
  return data || [];
}

export async function findCoCoachTeams(userIdNum) {
  const supabase = getSupabaseClient();
  const { data } = await supabase
    .from('coach_teams_table')
    .select('CoachId')
    .eq('CoCoachId', userIdNum)
    .eq('Status', 'active');
  return data || [];
}

export async function findMembersByCoachIds(coachIds) {
  const supabase = getSupabaseClient();
  const { data } = await supabase
    .from('team_table')
    .select('UserId')
    .in('CoachId', coachIds)
    .eq('Status', 'Active');
  return data || [];
}

export async function listCenters({ teamUserIds, scope }) {
  const supabase = getSupabaseClient();
  let q = supabase
    .from('nutrition_centers_table')
    .select(`
      id, center_name, latitude, longitude, education_hour,
      owner_user_id, owner_phone, registered_at, status
    `)
    .eq('status', 'active')
    .eq('is_deleted', false);
  if (scope === 'team') {
    q = q.in('owner_user_id', teamUserIds);
  }
  const { data, error } = await q.order('registered_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data || [];
}

export async function getOwnerNames(ownerIds) {
  if (ownerIds.length === 0) return [];
  const supabase = getSupabaseClient();
  const { data } = await supabase
    .from('team_table')
    .select('UserId, UserName')
    .in('UserId', ownerIds);
  return data || [];
}

export async function attendanceForCenter(centerId, startDate, endDate, timezoneIana = IANA_IST) {
  const byCenter = await attendanceForCenters([centerId], startDate, endDate, timezoneIana);
  return byCenter.get(centerId) || [];
}

/**
 * Batch attendance for many centres — 3 queries total instead of 3×N.
 * @returns {Promise<Map<number, Array<{ UserId: number }>>>}
 */
export async function attendanceForCenters(centerIds, startDate, endDate, timezoneIana = IANA_IST) {
  const result = new Map();
  const ids = [...new Set((centerIds || []).map((id) => Number(id)).filter(Number.isFinite))];
  ids.forEach((id) => result.set(id, []));
  if (ids.length === 0) return result;

  const supabase = getSupabaseClient();

  let eduQuery = supabase
    .from('education_logs_table')
    .select('"UserId", nutrition_center_id')
    .in('nutrition_center_id', ids)
    .eq('"IsDeleted"', 0);
  eduQuery = applyDateRangeFilter(eduQuery, '"CreatedAt"', startDate, endDate, timezoneIana);

  let weightQuery = supabase
    .from('weight_records_table')
    .select('"UserId", "NutritionCenterId"')
    .in('"NutritionCenterId"', ids)
    .eq('"IsDeleted"', 0);
  weightQuery = applyDateRangeFilter(weightQuery, '"CreatedAt"', startDate, endDate, timezoneIana);

  let foodQuery = supabase
    .from('food_nutrition_data_table')
    .select('"UserID", "NutritionCenterId"')
    .in('"NutritionCenterId"', ids)
    .eq('"IsDeleted"', 0);
  foodQuery = applyDateRangeFilter(foodQuery, '"CreatedAt"', startDate, endDate, timezoneIana);

  const [eduRes, weightRes, foodRes] = await Promise.all([eduQuery, weightQuery, foodQuery]);

  if (eduRes.error) throw new Error(`Education logs query failed: ${eduRes.error.message}`);
  if (weightRes.error) throw new Error(`Weight logs query failed: ${weightRes.error.message}`);
  if (foodRes.error) throw new Error(`Food logs query failed: ${foodRes.error.message}`);

  const push = (centerId, userId) => {
    const key = Number(centerId);
    if (!result.has(key)) result.set(key, []);
    result.get(key).push({ UserId: userId });
  };

  (eduRes.data || []).forEach((row) => push(row.nutrition_center_id, row.UserId));
  (weightRes.data || []).forEach((row) => push(row.NutritionCenterId, row.UserId));
  (foodRes.data || []).forEach((row) => push(row.NutritionCenterId, row.UserID));

  return result;
}

export async function getAttendeeList(centerId, startDate, endDate, timezoneIana = IANA_IST) {
  const supabase = getSupabaseClient();
  
  let eduQuery = supabase
    .from('education_logs_table')
    .select('"UserId", "CreatedAt"')
    .eq('nutrition_center_id', centerId)
    .eq('"IsDeleted"', 0);
  eduQuery = applyDateRangeFilter(eduQuery, '"CreatedAt"', startDate, endDate, timezoneIana);

  let weightQuery = supabase
    .from('weight_records_table')
    .select('"UserId", "CreatedAt"')
    .eq('"NutritionCenterId"', centerId)
    .eq('"IsDeleted"', 0);
  weightQuery = applyDateRangeFilter(weightQuery, '"CreatedAt"', startDate, endDate, timezoneIana);

  let foodQuery = supabase
    .from('food_nutrition_data_table')
    .select('"UserID", "CreatedAt"')
    .eq('"NutritionCenterId"', centerId)
    .eq('"IsDeleted"', 0);
  foodQuery = applyDateRangeFilter(foodQuery, '"CreatedAt"', startDate, endDate, timezoneIana);

  const [eduRes, weightRes, foodRes] = await Promise.all([
    eduQuery,
    weightQuery,
    foodQuery,
  ]);
  
  // Check for errors
  if (eduRes.error) throw new Error(eduRes.error.message);
  if (weightRes.error) throw new Error(weightRes.error.message);
  if (foodRes.error) throw new Error(foodRes.error.message);
  
  // Merge all logs with log type annotation
  const allLogs = [
    ...(eduRes.data || []).map(row => ({ UserId: row.UserId, CreatedAt: row.CreatedAt, logType: 'education' })),
    ...(weightRes.data || []).map(row => ({ UserId: row.UserId, CreatedAt: row.CreatedAt, logType: 'weight' })),
    ...(foodRes.data || []).map(row => ({ UserId: row.UserID, CreatedAt: row.CreatedAt, logType: 'food' })),
  ];
  
  if (allLogs.length === 0) return [];

  // Collect unique user IDs to fetch names
  const uniqueUserIds = [...new Set(allLogs.map((l) => l.UserId))];

  const { data: users } = await supabase
    .from('team_table')
    .select('"UserId", "UserName"')
    .in('"UserId"', uniqueUserIds);

  const nameMap = {};
  (users || []).forEach((u) => { nameMap[u.UserId] = u.UserName; });

  // Return array of log entries (NOT de-duplicated by user) with enriched data
  return allLogs.map((log) => ({
    userId: log.UserId,
    userName: nameMap[log.UserId] || 'Unknown Member',
    logType: log.logType,
    timestamp: log.CreatedAt,
  }));
}
