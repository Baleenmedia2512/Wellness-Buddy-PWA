import { getSupabaseClient } from '../../utils/supabaseClient.js';

export async function fetchEducationLogs(userId, start, end) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('education_logs_table')
    .select('"Id","CreatedAt",attendance_type,nutrition_center_id,center_name')
    .eq('"UserId"', userId)
    .gte('"CreatedAt"', start)
    .lte('"CreatedAt"', end)
    .eq('"IsDeleted"', false)
    .order('"CreatedAt"', { ascending: false });
  if (error) throw new Error(error.message);
  return data || [];
}

export async function fetchClubsByIds(clubIds) {
  if (!clubIds.length) return [];
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('nutrition_centers_table')
    .select('id, center_name, latitude, longitude, owner_user_id')
    .in('id', clubIds)
    .eq('status', 'active')
    .eq('is_deleted', false);
  if (error) return [];
  return data || [];
}

export async function fetchOwnersByIds(ownerIds) {
  if (!ownerIds.length) return [];
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('team_table')
    .select('UserId, UserName')
    .in('UserId', ownerIds);
  if (error) return [];
  return data || [];
}
