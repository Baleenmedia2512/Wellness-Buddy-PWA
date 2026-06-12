/**
 * weight-progress.repo.js — Data layer for weight progress tips.
 * Fetches weight history, nutrition totals, water intake, and activity.
 */
import { getSupabaseClient } from '../../../utils/supabaseClient.js';
import { isExemptedFood } from '../../../utils/foodTypeDetection.js';

/**
 * Get user's weight goal mode, height, and BMR from team_table.
 * Falls back gracefully if WeightGoalMode column doesn't exist yet.
 */
export async function getUserWeightGoal(userId) {
  const supabase = getSupabaseClient();
  console.log('🗄️ [repo:getUserWeightGoal] Querying team_table for userId:', userId);
  
  try {
    const { data, error } = await supabase
      .from('team_table')
      .select('"WeightGoalMode", "Height", "Bmr"')
      .eq('UserId', parseInt(userId, 10))
      .maybeSingle();

    if (error) {
      console.error('❌ [repo:getUserWeightGoal] Supabase error:', error.message);
      throw error;
    }
    console.log('✅ [repo:getUserWeightGoal] Result:', data);
    return data || { WeightGoalMode: 'loss', Height: null, Bmr: null };
  } catch (error) {
    if (error.message?.includes('column') && error.message?.includes('WeightGoalMode')) {
      console.warn('⚠️ [repo:getUserWeightGoal] WeightGoalMode column not found, using default "loss".');
      return { WeightGoalMode: 'loss', Height: null, Bmr: null };
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
    .select('ID, Weight, CreatedAt')
    .eq('UserId', parseInt(userId, 10))
    .or('IsDeleted.is.null,IsDeleted.eq.0,IsDeleted.eq.false')
    .order('CreatedAt', { ascending: false })
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
    .or('IsDeleted.is.null,IsDeleted.eq.0');

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
    .or('IsDeleted.is.null,IsDeleted.eq.0');

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
 * Get yesterday's water intake (ml) by scanning food_nutrition_data_table AnalysisData.
 * Water-classified food items (beverages, water) contribute their volume_ml/weight_g.
 * Uses isExemptedFood from shared utils — no cross-feature import.
 */
export async function getYesterdayWater(userId, yesterdayStart, yesterdayEnd) {
  const supabase = getSupabaseClient();
  console.log('🗄️ [repo:getYesterdayWater] userId:', userId, 'range:', yesterdayStart, '→', yesterdayEnd);

  const { data, error } = await supabase
    .from('food_nutrition_data_table')
    .select('"AnalysisData"')
    .eq('"UserID"', String(userId))
    .gte('"CreatedAt"', yesterdayStart)
    .lt('"CreatedAt"', yesterdayEnd)
    .or('IsDeleted.is.null,IsDeleted.eq.0');

  if (error) {
    console.error('❌ [repo:getYesterdayWater] Supabase error:', error.message);
    return 0;
  }

  if (!data || data.length === 0) {
    console.log('⚠️ [repo:getYesterdayWater] No food rows for yesterday — returning 0 ml');
    return 0;
  }

  let totalMl = 0;
  for (const row of data) {
    const ad = _parseAnalysisData(row.AnalysisData);
    const foods = Array.isArray(ad?.foods) ? ad.foods : [];
    for (const food of foods) {
      if (!isExemptedFood(food?.name)) continue;
      const ml =
        parseFloat(food.volume_ml) ||
        parseFloat(food.weight_g) ||
        parseFloat(food.estimatedWeight) ||
        0;
      totalMl += ml;
    }
  }

  const result = Math.round(totalMl);
  console.log('✅ [repo:getYesterdayWater] Total water:', result, 'ml');
  return result;
}

/**
 * Get yesterday's best step/activity record from daily_step_activity.
 * Returns null when no activity was recorded (graceful — tips handle the zero case).
 */
export async function getYesterdayActivity(userId, yesterdayStart, yesterdayEnd) {
  const supabase = getSupabaseClient();
  console.log('🗄️ [repo:getYesterdayActivity] userId:', userId, 'range:', yesterdayStart, '→', yesterdayEnd);

  const { data, error } = await supabase
    .from('daily_step_activity')
    .select('"Steps", "CaloriesBurned", "ActivityType"')
    .eq('UserId', parseInt(userId, 10))
    .gte('CreatedAt', yesterdayStart)
    .lt('CreatedAt', yesterdayEnd)
    .order('Steps', { ascending: false })
    .limit(1);

  if (error) {
    console.error('❌ [repo:getYesterdayActivity] Supabase error:', error.message);
    return null;
  }

  if (!data || data.length === 0) {
    console.log('⚠️ [repo:getYesterdayActivity] No activity recorded for yesterday');
    return { steps: 0, caloriesBurned: 0, activityType: null };
  }

  const row = data[0];
  const result = {
    steps: parseInt(row.Steps || 0, 10),
    caloriesBurned: parseFloat(row.CaloriesBurned || 0),
    activityType: row.ActivityType || null,
  };
  console.log('✅ [repo:getYesterdayActivity] Activity:', JSON.stringify(result));
  return result;
}

/**
 * Persist accountability review on the weight record that triggered the alert.
 * Stores JSON in weight_records_table."ReverseProgressReview" (migration 0011).
 * Does not overwrite WeightImageBase64 (scale photo stays intact).
 *
 * @param {object} review  Normalised payload from validateSubmitReview.
 * @returns {Promise<number>} The updated weight record ID.
 * @throws {Error} if the update fails or row not found.
 */
export async function saveProgressReview(review) {
  const supabase = getSupabaseClient();
  console.log(
    '🗄️ [repo:saveProgressReview] Saving review on weight record',
    review.weightRecordId,
    'for userId:',
    review.userId,
  );

  const reviewPayload = {
    followedPlan: review.followedPlan,
    goalMode: review.goalMode,
    weightChangeKg: review.weightChange,
    proofType: review.proofType,
    proofImageBase64: review.proofImageBase64,
    reason: review.reason,
    reasonOther: review.reasonOther,
    nutritionSnapshot: review.nutritionSnapshot || null,
    reviewedAt: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('weight_records_table')
    .update({
      ReverseProgressReview: reviewPayload,
      UpdatedAt: new Date().toISOString(),
    })
    .eq('ID', review.weightRecordId)
    .eq('UserId', review.userId)
    .or('IsDeleted.is.null,IsDeleted.eq.false')
    .select('ID')
    .maybeSingle();

  if (error) {
    console.error('❌ [repo:saveProgressReview] Supabase error:', error.message);
    throw error;
  }

  if (!data?.ID) {
    throw new Error(
      `Weight record ${review.weightRecordId} not found for user ${review.userId}`,
    );
  }

  console.log('✅ [repo:saveProgressReview] Saved on weight record ID:', data.ID);
  return data.ID;
}

/** @private — parse AnalysisData; may be a JSON string or already an object. */
function _parseAnalysisData(value) {
  if (value == null) return null;
  if (typeof value === 'object') return value;
  if (typeof value !== 'string') return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
