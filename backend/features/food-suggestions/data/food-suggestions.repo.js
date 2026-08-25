/**
 * food-suggestions.repository.js — pair stats + recent meals for suggestions.
 */
import { getSupabaseClient } from '../../../utils/supabaseClient.js';

export async function incrementGlobalPair(keyA, keyB) {
  const supabase = getSupabaseClient();
  const { data: existing, error: findErr } = await supabase
    .from('food_pair_stats_table')
    .select('id, pair_count')
    .eq('food_a', keyA)
    .eq('food_b', keyB)
    .maybeSingle();
  if (findErr) throw findErr;

  const now = new Date().toISOString();
  if (existing?.id) {
    const { error } = await supabase
      .from('food_pair_stats_table')
      .update({
        pair_count: Number(existing.pair_count || 0) + 1,
        updated_at: now,
      })
      .eq('id', existing.id);
    if (error) throw error;
    return;
  }

  const { error } = await supabase.from('food_pair_stats_table').insert({
    food_a: keyA,
    food_b: keyB,
    pair_count: 1,
    updated_at: now,
  });
  if (error) throw error;
}

export async function incrementUserPair(userId, keyA, keyB) {
  const supabase = getSupabaseClient();
  const uid = String(userId);
  const { data: existing, error: findErr } = await supabase
    .from('food_pair_stats_user_table')
    .select('id, pair_count')
    .eq('user_id', uid)
    .eq('food_a', keyA)
    .eq('food_b', keyB)
    .maybeSingle();
  if (findErr) throw findErr;

  const now = new Date().toISOString();
  if (existing?.id) {
    const { error } = await supabase
      .from('food_pair_stats_user_table')
      .update({
        pair_count: Number(existing.pair_count || 0) + 1,
        updated_at: now,
      })
      .eq('id', existing.id);
    if (error) throw error;
    return;
  }

  const { error } = await supabase.from('food_pair_stats_user_table').insert({
    user_id: uid,
    food_a: keyA,
    food_b: keyB,
    pair_count: 1,
    updated_at: now,
  });
  if (error) throw error;
}

export async function listUserPairsForAnchor(userId, anchorKey) {
  const supabase = getSupabaseClient();
  const uid = String(userId);
  const safe = String(anchorKey).replace(/"/g, '');
  const { data, error } = await supabase
    .from('food_pair_stats_user_table')
    .select('food_a, food_b, pair_count')
    .eq('user_id', uid)
    .or(`food_a.eq."${safe}",food_b.eq."${safe}"`)
    .order('pair_count', { ascending: false })
    .limit(40);
  if (error) throw error;
  return data || [];
}

export async function listGlobalPairsForAnchor(anchorKey, minCount) {
  const supabase = getSupabaseClient();
  const safe = String(anchorKey).replace(/"/g, '');
  const { data, error } = await supabase
    .from('food_pair_stats_table')
    .select('food_a, food_b, pair_count')
    .or(`food_a.eq."${safe}",food_b.eq."${safe}"`)
    .gte('pair_count', minCount)
    .order('pair_count', { ascending: false })
    .limit(40);
  if (error) throw error;
  return data || [];
}

/**
 * Recent meal AnalysisData rows for a user (newest first).
 */
export async function listRecentUserMeals(userId, limit = 40) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('food_nutrition_data_table')
    .select('"ID","AnalysisData","CreatedAt"')
    .eq('"UserID"', String(userId))
    .eq('"IsDeleted"', 0)
    .not('"AnalysisData"', 'is', null)
    .order('"CreatedAt"', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}
