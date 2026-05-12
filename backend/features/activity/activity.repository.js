import { getSupabaseClient, getISTTimestamp } from '../../utils/supabaseClient.js';

export async function fetchDailyRows(userId, startDate, endDate, activityType = null) {
  const supabase = getSupabaseClient();
  let query = supabase
    .from('daily_step_activity')
    .select('*')
    .eq('UserId', userId)
    .gte('CreatedAt', `${startDate}T00:00:00+05:30`)
    .lte('CreatedAt', `${endDate}T23:59:59+05:30`)
    .order('CreatedAt', { ascending: true });
  if (activityType) query = query.eq('ActivityType', activityType);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function findExistingDailyRows(userId, activityDate) {
  const supabase = getSupabaseClient();
  const dayStart = `${activityDate}T00:00:00`;
  const dayEnd = `${activityDate}T23:59:59`;
  const { data, error } = await supabase
    .from('daily_step_activity')
    .select('Id, Steps, CaloriesBurned')
    .eq('UserId', userId)
    .gte('CreatedAt', dayStart)
    .lte('CreatedAt', dayEnd)
    .order('CreatedAt', { ascending: false })
    .limit(2);
  if (error) throw error;
  return data || [];
}

export async function updateDailyRow(id, payload) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('daily_step_activity')
    .update(payload)
    .eq('Id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function insertDailyRow(payload) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('daily_step_activity')
    .insert(payload)
    .select('*')
    .single();
  return { data, error };
}

export async function fetchWatchCalorieRows(userId, targetDate) {
  const supabase = getSupabaseClient();
  const startOfDayUTC = `${targetDate}T00:00:00+05:30`;
  const endOfDayUTC   = `${targetDate}T23:59:59+05:30`;
  const { data, error } = await supabase
    .from('education_logs_table')
    .select('"Id", "Topic", "CreatedAt"')
    .eq('"UserId"', userId)
    .eq('"IsDeleted"', 0)
    .ilike('"Topic"', 'Calories Burned:%')
    .gte('"CreatedAt"', startOfDayUTC)
    .lte('"CreatedAt"', endOfDayUTC)
    .order('"CreatedAt"', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function touchLastActive(userId) {
  if (!userId) return;
  try {
    const supabase = getSupabaseClient();
    await supabase.from('team_table').update({ LastActiveAt: getISTTimestamp() }).eq('UserId', userId);
  } catch (_) { /* ignore */ }
}

export { getISTTimestamp };
