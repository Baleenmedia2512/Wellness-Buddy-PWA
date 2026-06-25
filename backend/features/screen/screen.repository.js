/**
 * Screen feature — repository layer (sole owner of screen_sessions_table).
 */
import { getSupabaseClient } from '../../utils/supabaseClient.js';

const TABLE = 'screen_sessions_table';

export async function findByUserAndDate(userId, date) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select('Id')
    .eq('UserId', userId)
    .eq('Date', date)
    .order('Id', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function deleteByIds(ids) {
  if (!ids?.length) return;
  const supabase = getSupabaseClient();
  const { error } = await supabase.from(TABLE).delete().in('Id', ids);
  if (error) throw error;
}

export async function updateRow(id, updates) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TABLE)
    .update(updates)
    .eq('Id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function insertRow(payload) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TABLE)
    .insert(payload)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function listRange(userId, startDate, endDate) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('UserId', userId)
    .not('Date', 'is', null)
    .gte('Date', startDate)
    .lte('Date', endDate)
    .order('Date', { ascending: false });
  if (error) throw error;
  return data || [];
}
