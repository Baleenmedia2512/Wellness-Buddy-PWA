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
  console.log('🗄️ [repo:getUserWeightGoal] Querying team_table for userId:', userId);
  
  try {
    const { data, error } = await supabase
      .from('team_table')
      .select('"WeightGoalMode", "Height"')
      .eq('"UserId"', userId)
      .maybeSingle();

    if (error) {
      console.error('❌ [repo:getUserWeightGoal] Supabase error:', error.message);
      throw error;
    }
    console.log('✅ [repo:getUserWeightGoal] Result:', data);
    return data || { WeightGoalMode: 'loss', Height: null };
  } catch (error) {
    if (error.message?.includes('column') && error.message?.includes('WeightGoalMode')) {
      console.warn('⚠️ [repo:getUserWeightGoal] WeightGoalMode column not found, using default "loss".');
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
  console.log('🗄️ [repo:getRecentWeights] Querying weight_records_table for userId:', userId, 'limit:', limit);

  const { data, error } = await supabase
    .from('weight_records_table')
    .select('"ID", "Weight", "CreatedAt"')
    .eq('"UserId"', userId)
    .or('IsDeleted.is.null,IsDeleted.eq.false')
    .order('"CreatedAt"', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('❌ [repo:getRecentWeights] Supabase error:', error.message);
    throw error;
  }
  console.log('✅ [repo:getRecentWeights] Rows returned:', data?.length, JSON.stringify(data));
  return data || [];
}

/**
 * Get yesterday's nutrition totals
 * Aggregates all food entries from yesterday
 */
export async function getYesterdayNutrition(userId, yesterdayStart, yesterdayEnd) {
  const supabase = getSupabaseClient();
  console.log('🗄️ [repo:getYesterdayNutrition] userId:', userId, 'range:', yesterdayStart, '→', yesterdayEnd);
  
  const { data, error } = await supabase
    .from('food_nutrition_data_table')
    .select('"TotalCalories", "TotalProtein", "TotalCarbs", "TotalFat"')
    .eq('"UserID"', String(userId))
    .gte('"CreatedAt"', yesterdayStart)
    .lt('"CreatedAt"', yesterdayEnd)
    .or('IsDeleted.is.null,IsDeleted.eq.false');

  if (error) {
    console.error('❌ [repo:getYesterdayNutrition] Supabase error:', error.message);
    throw error;
  }
  console.log('✅ [repo:getYesterdayNutrition] Rows found:', data?.length);

  if (!data || data.length === 0) {
    console.log('⚠️ [repo:getYesterdayNutrition] No nutrition data for yesterday — returning zeros');
    return { calories: 0, protein: 0, carbs: 0, fat: 0 };
  }

  const totals = data.reduce(
    (acc, item) => ({
      calories: acc.calories + (parseFloat(item.TotalCalories) || 0),
      protein: acc.protein + (parseFloat(item.TotalProtein) || 0),
      carbs: acc.carbs + (parseFloat(item.TotalCarbs) || 0),
      fat: acc.fat + (parseFloat(item.TotalFat) || 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );
  console.log('📊 [repo:getYesterdayNutrition] Aggregated totals:', JSON.stringify(totals));
  return totals;
}

/**
 * Get today's nutrition totals
 */
export async function getTodayNutrition(userId, todayStart) {
  const supabase = getSupabaseClient();
  console.log('🗄️ [repo:getTodayNutrition] userId:', userId, 'from:', todayStart);
  
  const { data, error } = await supabase
    .from('food_nutrition_data_table')
    .select('"TotalCalories", "TotalProtein", "TotalCarbs", "TotalFat"')
    .eq('"UserID"', String(userId))
    .gte('"CreatedAt"', todayStart)
    .or('IsDeleted.is.null,IsDeleted.eq.false');

  if (error) {
    console.error('❌ [repo:getTodayNutrition] Supabase error:', error.message);
    throw error;
  }
  console.log('✅ [repo:getTodayNutrition] Rows found:', data?.length);

  if (!data || data.length === 0) {
    console.log('⚠️ [repo:getTodayNutrition] No nutrition data for today — returning zeros');
    return { calories: 0, protein: 0, carbs: 0, fat: 0 };
  }

  const totals = data.reduce(
    (acc, item) => ({
      calories: acc.calories + (parseFloat(item.TotalCalories) || 0),
      protein: acc.protein + (parseFloat(item.TotalProtein) || 0),
      carbs: acc.carbs + (parseFloat(item.TotalCarbs) || 0),
      fat: acc.fat + (parseFloat(item.TotalFat) || 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );
  console.log('📊 [repo:getTodayNutrition] Aggregated totals:', JSON.stringify(totals));
  return totals;
}

/**
 * Get yesterday's water intake (placeholder - actual implementation depends on water tracking)
 * For now, returns 0 if no water table exists
 */
export async function getYesterdayWater(userId, yesterdayStart, yesterdayEnd) {
  console.log('🗄️ [repo:getYesterdayWater] userId:', userId, 'range:', yesterdayStart, '→', yesterdayEnd);
  // TODO: Implement when water tracking table is available
  console.log('⚠️ [repo:getYesterdayWater] Water table not yet implemented — returning 0 ml');
  return 0;
}
