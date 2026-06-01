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
  const { data } = await supabase
    .from('education_logs_table')
    .select('"UserId"')
    .eq('nutrition_center_id', centerId)
    .eq('"IsDeleted"', false)
    .gte('"CreatedAt"', rangeStart)
    .lte('"CreatedAt"', rangeEnd);
  return data || [];
}
