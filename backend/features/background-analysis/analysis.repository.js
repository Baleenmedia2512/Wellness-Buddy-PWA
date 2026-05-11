import { getSupabaseClient, getISTTimestamp, convertToIST } from '../../utils/supabaseClient.js';

export async function insertAnalysis(payload) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('food_nutrition_data_table')
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function listAnalyses({ userId, limit, offset }) {
  const supabase = getSupabaseClient();
  const { data, error, count } = await supabase
    .from('food_nutrition_data_table')
    .select('*', { count: 'exact' })
    .eq('"UserID"', userId)
    .eq('"IsDeleted"', 0)
    .order('"CreatedAt"', { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw error;
  return { rows: data || [], count: count || 0 };
}

export async function softDeleteAnalysis(id, userId) {
  const supabase = getSupabaseClient();
  const currentTime = getISTTimestamp();
  const { data, error } = await supabase
    .from('food_nutrition_data_table')
    .update({ IsDeleted: 1, UpdatedAt: currentTime })
    .eq('"ID"', id)
    .eq('"UserID"', userId)
    .select();
  if (error) throw error;
  return data || [];
}

export async function checkOwnership(id, userId) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('food_nutrition_data_table')
    .select('"ID"')
    .eq('"ID"', id)
    .eq('"UserID"', userId)
    .limit(1);
  if (error) throw error;
  return Array.isArray(data) && data.length > 0;
}

export async function restoreAnalysis(id) {
  const supabase = getSupabaseClient();
  const currentTime = getISTTimestamp();
  const { data, error } = await supabase
    .from('food_nutrition_data_table')
    .update({ IsDeleted: 0, UpdatedAt: currentTime })
    .eq('"ID"', id)
    .select();
  if (error) throw error;
  return data || [];
}

export async function touchLastActive(userId) {
  if (!userId) return;
  try {
    const supabase = getSupabaseClient();
    await supabase
      .from('team_table')
      .update({ LastActiveAt: getISTTimestamp() })
      .eq('UserId', userId);
  } catch (_) { /* ignore */ }
}

export { getISTTimestamp, convertToIST };
