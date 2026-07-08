import { getSupabaseClient, getISTTimestamp } from '../../../utils/supabaseClient.js';
import logger from '../../../shared/lib/logger.js';
import { isExemptedBeverageOnly } from '../../../utils/foodTypeDetection.js';

export async function getUserTeamRow(userId) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('team_table')
    .select('UserId, Role, Bmr, WeightGoalMode, Weight')
    .eq('UserId', userId)
    .maybeSingle();
  if (error) {
    logger.error('[wellness-score.repo] team row fetch failed', { userId, err: error.message });
    return null;
  }
  return data;
}

export async function getLatestConfig() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('wellness_score_config_table')
    .select('id, parameters, updated_at, updated_by_user_id')
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    logger.error('[wellness-score.repo] config fetch failed', { err: error.message });
    return null;
  }
  return data;
}

export async function insertConfig({ parameters, updatedByUserId }) {
  const supabase = getSupabaseClient();
  const now = getISTTimestamp();
  const { data, error } = await supabase
    .from('wellness_score_config_table')
    .insert({
      parameters,
      updated_at: now,
      updated_by_user_id: updatedByUserId ?? null,
    })
    .select('id, parameters, updated_at, updated_by_user_id')
    .single();
  if (error) throw error;
  return data;
}

export async function getEducationLogsForDate(userId, date) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('education_logs_table')
    .select('CreatedAt, Topic')
    .eq('UserId', userId)
    .or('IsDeleted.is.null,IsDeleted.eq.0')
    .gte('CreatedAt', `${date}T00:00:00`)
    .lte('CreatedAt', `${date}T23:59:59`);
  if (error) {
    logger.error('[wellness-score.repo] education logs failed', { userId, date, err: error.message });
    return [];
  }
  return data || [];
}

export async function getWeightRecordsForDate(userId, date) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('weight_records_table')
    .select('CreatedAt, Weight')
    .eq('UserId', userId)
    .or('IsDeleted.is.null,IsDeleted.eq.0,IsDeleted.eq.false')
    .gte('CreatedAt', `${date}T00:00:00`)
    .lte('CreatedAt', `${date}T23:59:59`);
  if (error) {
    logger.error('[wellness-score.repo] weight records failed', { userId, date, err: error.message });
    return [];
  }
  return data || [];
}

export async function getPreviousWeightBeforeDate(userId, date) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('weight_records_table')
    .select('CreatedAt, Weight')
    .eq('UserId', userId)
    .or('IsDeleted.is.null,IsDeleted.eq.0,IsDeleted.eq.false')
    .lt('CreatedAt', `${date}T00:00:00`)
    .order('CreatedAt', { ascending: false })
    .limit(1);
  if (error) {
    logger.error('[wellness-score.repo] previous weight failed', { userId, date, err: error.message });
    return null;
  }
  return Array.isArray(data) && data.length > 0 ? data[0] : null;
}

const FOOD_NUTRITION_SELECT = [
  'CreatedAt',
  'AnalysisData',
  'GlycemicIndex',
  'TotalCalories',
  'TotalCarbs',
  'TotalFat',
  'TotalProtein',
  'TotalSodium',
  'TotalCholesterol',
  'TotalSugar',
  'TotalFiber',
  'TotalVitaminA',
  'TotalVitaminC',
  'TotalVitaminD',
  'TotalVitaminE',
  'TotalVitaminK',
  'TotalVitaminB1',
  'TotalVitaminB2',
  'TotalVitaminB3',
  'TotalVitaminB6',
  'TotalVitaminB9',
  'TotalVitaminB12',
  'TotalCalcium',
  'TotalIron',
  'TotalMagnesium',
  'TotalPotassium',
  'TotalZinc',
  'TotalPhosphorus',
].join(', ');

export async function getFoodRecordsForDate(userId, date) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('food_nutrition_data_table')
    .select(FOOD_NUTRITION_SELECT)
    .eq('UserID', String(userId))
    .or('IsDeleted.is.null,IsDeleted.eq.0')
    .gte('CreatedAt', `${date}T00:00:00`)
    .lte('CreatedAt', `${date}T23:59:59`);
  if (error) {
    logger.error('[wellness-score.repo] food records failed', { userId, date, err: error.message });
    return [];
  }
  return data || [];
}

export async function getLatestWeightKg(userId) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('weight_records_table')
    .select('Weight')
    .eq('UserId', userId)
    .or('IsDeleted.is.null,IsDeleted.eq.0,IsDeleted.eq.false')
    .order('CreatedAt', { ascending: false })
    .limit(1);
  if (error || !data?.length) return null;
  const w = parseFloat(data[0].Weight);
  return Number.isFinite(w) && w > 0 ? w : null;
}

export async function getFoodRowsForWater(userId, date) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('food_nutrition_data_table')
    .select('CreatedAt, AnalysisData')
    .eq('UserID', String(userId))
    .or('IsDeleted.is.null,IsDeleted.eq.0')
    .gte('CreatedAt', `${date}T00:00:00`)
    .lte('CreatedAt', `${date}T23:59:59`);
  if (error) return [];
  return (data || []).filter((r) => isExemptedBeverageOnly(r.AnalysisData));
}

export async function getStepCaloriesForDate(userId, date) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('daily_step_activity')
    .select('CaloriesBurned')
    .eq('UserId', userId)
    .gte('CreatedAt', `${date}T00:00:00`)
    .lte('CreatedAt', `${date}T23:59:59`);
  if (error) return 0;
  return (data || []).reduce((s, r) => s + (Number(r.CaloriesBurned) || 0), 0);
}

export async function getWatchCaloriesForDate(userId, date) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('education_logs_table')
    .select('Topic')
    .eq('UserId', userId)
    .ilike('Topic', 'Calories Burned:%')
    .or('IsDeleted.is.null,IsDeleted.eq.0')
    .gte('CreatedAt', `${date}T00:00:00`)
    .lte('CreatedAt', `${date}T23:59:59`);
  if (error) return 0;
  let total = 0;
  for (const row of data || []) {
    const m = String(row.Topic || '').match(/(\d+(?:\.\d+)?)\s*kcal/i);
    if (m) total += Math.round(parseFloat(m[1]));
  }
  return total;
}
