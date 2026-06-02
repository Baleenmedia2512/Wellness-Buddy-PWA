import { getSupabaseClient } from '../../utils/supabaseClient.js';

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

export async function attendanceForCenter(centerId, rangeStart, rangeEnd) {
  const supabase = getSupabaseClient();
  
  // Fetch from all three log types: education, weight, food
  const [eduRes, weightRes, foodRes] = await Promise.all([
    supabase
      .from('education_logs_table')
      .select('"UserId"')
      .eq('nutrition_center_id', centerId)
      .eq('"IsDeleted"', 0)
      .gte('"CreatedAt"', rangeStart)
      .lte('"CreatedAt"', rangeEnd),
    supabase
      .from('weight_records_table')
      .select('"UserId"')
      .eq('"NutritionCenterId"', centerId)
      .eq('"IsDeleted"', 0)
      .gte('"CreatedAt"', rangeStart)
      .lte('"CreatedAt"', rangeEnd),
    supabase
      .from('food_nutrition_data_table')
      .select('"UserID"')
      .eq('"NutritionCenterId"', centerId)
      .eq('"IsDeleted"', 0)
      .gte('"CreatedAt"', rangeStart)
      .lte('"CreatedAt"', rangeEnd),
  ]);
  
  // Check for errors
  if (eduRes.error) throw new Error(`Education logs query failed: ${eduRes.error.message}`);
  if (weightRes.error) throw new Error(`Weight logs query failed: ${weightRes.error.message}`);
  if (foodRes.error) throw new Error(`Food logs query failed: ${foodRes.error.message}`);
  
  // Merge all logs - normalize food table's UserID to UserId
  const allLogs = [
    ...(eduRes.data || []),
    ...(weightRes.data || []),
    ...(foodRes.data || []).map(row => ({ UserId: row.UserID })),
  ];
  
  return allLogs;
}

export async function getAttendeeList(centerId, rangeStart, rangeEnd) {
  const supabase = getSupabaseClient();
  
  // Fetch from all three log types: education, weight, food
  const [eduRes, weightRes, foodRes] = await Promise.all([
    supabase
      .from('education_logs_table')
      .select('"UserId"')
      .eq('nutrition_center_id', centerId)
      .eq('"IsDeleted"', 0)
      .gte('"CreatedAt"', rangeStart)
      .lte('"CreatedAt"', rangeEnd),
    supabase
      .from('weight_records_table')
      .select('"UserId"')
      .eq('"NutritionCenterId"', centerId)
      .eq('"IsDeleted"', 0)
      .gte('"CreatedAt"', rangeStart)
      .lte('"CreatedAt"', rangeEnd),
    supabase
      .from('food_nutrition_data_table')
      .select('"UserID"')
      .eq('"NutritionCenterId"', centerId)
      .eq('"IsDeleted"', 0)
      .gte('"CreatedAt"', rangeStart)
      .lte('"CreatedAt"', rangeEnd),
  ]);
  
  // Check for errors
  if (eduRes.error) throw new Error(eduRes.error.message);
  if (weightRes.error) throw new Error(weightRes.error.message);
  if (foodRes.error) throw new Error(foodRes.error.message);
  
  // Merge all logs - normalize food table's UserID to UserId
  const allLogs = [
    ...(eduRes.data || []),
    ...(weightRes.data || []),
    ...(foodRes.data || []).map(row => ({ UserId: row.UserID })),
  ];
  
  if (allLogs.length === 0) return [];

  const uniqueUserIds = [...new Set(allLogs.map((l) => l.UserId))];

  const { data: users } = await supabase
    .from('team_table')
    .select('"UserId", "UserName"')
    .in('"UserId"', uniqueUserIds);

  const nameMap = {};
  (users || []).forEach((u) => { nameMap[u.UserId] = u.UserName; });

  return uniqueUserIds.map((uid) => ({
    userId: uid,
    userName: nameMap[uid] || 'Unknown Member',
  }));
}
