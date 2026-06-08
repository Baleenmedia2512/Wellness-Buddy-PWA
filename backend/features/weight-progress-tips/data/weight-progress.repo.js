/**
 * weight-progress.repo.js — Data layer for weight progress tips.
 * Fetches weight history, nutrition totals, water intake.
 */
import { getSupabaseClient } from '../../../utils/supabaseClient.js';

/**
 * Get user's weight goal mode and current weight
 * Falls back to 'loss' if WeightGoalMode column doesn't exist yet
 */
export async function getUserWeightGoal(userId) {
  const supabase = getSupabaseClient();
  
  try {
    const { data, error } = await supabase
      .from('team_table')
      .select('"WeightGoalMode", "Height"')
      .eq('"UserId"', userId)
      .maybeSingle();

    if (error) throw error;
    return data || { WeightGoalMode: 'loss', Height: null };
  } catch (error) {
    // If WeightGoalMode column doesn't exist, return default
    if (error.message?.includes('column') && error.message?.includes('WeightGoalMode')) {
      console.warn('⚠️ WeightGoalMode column not found, using default "loss". Run migration: add_weight_goal_mode.sql');
      return { WeightGoalMode: 'loss', Height: null };
    }
    throw error;
  }
}

/**
 * Get today's and yesterday's weight entries
 */
export async function getRecentWeights(userId, limit = 2) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('weight_records_table')
    .select('"ID", "Weight", "CreatedAt"')
    .eq('"UserId"', userId)
    .or('"IsDeleted".is.null,"IsDeleted".eq.false')
    .order('"CreatedAt"', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

/**
 * Get yesterday's nutrition totals
 * Aggregates all food entries from yesterday
 */
export async function getYesterdayNutrition(userId, yesterdayStart, yesterdayEnd) {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('food_nutrition_data_table')
    .select('"Calories", "Protein", "Carbs", "Fat"')
    .eq('"UserId"', userId)
    .gte('"LoggedAt"', yesterdayStart)
    .lt('"LoggedAt"', yesterdayEnd)
    .or('"IsDeleted".is.null,"IsDeleted".eq.false');

  if (error) throw error;

  // Aggregate totals
  if (!data || data.length === 0) {
    return { calories: 0, protein: 0, carbs: 0, fat: 0 };
  }

  return data.reduce(
    (acc, item) => ({
      calories: acc.calories + (parseFloat(item.Calories) || 0),
      protein: acc.protein + (parseFloat(item.Protein) || 0),
      carbs: acc.carbs + (parseFloat(item.Carbs) || 0),
      fat: acc.fat + (parseFloat(item.Fat) || 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );
}

/**
 * Get today's nutrition totals
 */
export async function getTodayNutrition(userId, todayStart) {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('food_nutrition_data_table')
    .select('"Calories", "Protein", "Carbs", "Fat"')
    .eq('"UserId"', userId)
    .gte('"LoggedAt"', todayStart)
    .or('"IsDeleted".is.null,"IsDeleted".eq.false');

  if (error) throw error;

  if (!data || data.length === 0) {
    return { calories: 0, protein: 0, carbs: 0, fat: 0 };
  }

  return data.reduce(
    (acc, item) => ({
      calories: acc.calories + (parseFloat(item.Calories) || 0),
      protein: acc.protein + (parseFloat(item.Protein) || 0),
      carbs: acc.carbs + (parseFloat(item.Carbs) || 0),
      fat: acc.fat + (parseFloat(item.Fat) || 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );
}

/**
 * Get yesterday's water intake (placeholder - actual implementation depends on water tracking)
 * For now, returns 0 if no water table exists
 */
export async function getYesterdayWater(userId, yesterdayStart, yesterdayEnd) {
  // TODO: Implement when water tracking table is available
  // For now, return 0
  return 0;
}
