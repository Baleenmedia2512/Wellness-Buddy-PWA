import { getSupabaseClient } from '../../utils/supabaseClient.js';

export async function getLatestWeight(userId) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('weight_records_table')
    .select('Weight, CreatedAt')
    .eq('UserId', userId)
    .or('IsDeleted.is.null,IsDeleted.eq.0,IsDeleted.eq.false')
    .order('CreatedAt', { ascending: false })
    .limit(1);
  if (error) console.error('[water.repo] weight query error:', error.message);
  return Array.isArray(data) && data.length > 0 ? data[0] : null;
}

export async function getFoodRowsForDate(userId, date) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('food_nutrition_data_table')
    .select('CreatedAt, AnalysisData')
    .eq('UserID', String(userId))
    .or('IsDeleted.is.null,IsDeleted.eq.0')
    .gte('CreatedAt', `${date}T00:00:00`)
    .lte('CreatedAt', `${date}T23:59:59`);
  if (error) console.error('[water.repo] food query error:', error.message);
  return data || [];
}
