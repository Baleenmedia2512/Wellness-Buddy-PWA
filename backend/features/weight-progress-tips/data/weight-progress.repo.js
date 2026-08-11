/**
 * weight-progress.repo.js — Data layer for weight progress tips.
 * Fetches weight history, nutrition totals, water intake, and activity.
 */
import { getSupabaseClient } from '../../../utils/supabaseClient.js';
import { applyDayFilter } from '../../../shared/lib/datetime/applyDayFilter.js';
import { IANA_IST } from '../../../shared/lib/datetime/index.js';
import { isExemptedFood } from '../../../utils/foodTypeDetection.js';

/**
 * Get user's weight goal mode, height, and BMR from team_table.
 * Falls back gracefully if WeightGoalMode column doesn't exist yet.
 */
export async function getUserWeightGoal(userId) {
  const supabase = getSupabaseClient();
  console.log('🗄️ [repo:getUserWeightGoal] Querying team_table for userId:', userId);
  const uid = parseInt(userId, 10);
  try {
    const { data, error } = await supabase
      .from('team_table')
      .select('"WeightGoalMode", "Height", "Bmr", "CoachId", "PhysicalActivityLevel", "Gender"')
      .eq('UserId', uid)
      .maybeSingle();

    if (error) {
      console.error('❌ [repo:getUserWeightGoal] Supabase error:', error.message);
      throw error;
    }
    console.log('✅ [repo:getUserWeightGoal] Result:', data);
    return data || { WeightGoalMode: 'loss', Height: null, Bmr: null, CoachId: null, Gender: null };
  } catch (error) {
    if (error.message?.includes('column') && error.message?.includes('WeightGoalMode')) {
      console.warn('⚠️ [repo:getUserWeightGoal] WeightGoalMode column not found, using default "loss".');
      return { WeightGoalMode: 'loss', Height: null, Bmr: null, CoachId: null, Gender: null };
    }
    throw error;
  }
}

/**
 * Get the phone number of a user's coach from team_table.
 * Returns null if not found or not set.
 *
 * @param {number} coachId
 * @returns {Promise<string|null>}
 */
export async function getCoachPhone(coachId) {
  if (!coachId) return null;
  const supabase = getSupabaseClient();
  console.log('🗄️ [repo:getCoachPhone] Querying team_table for coachId:', coachId);
  const { data, error } = await supabase
    .from('team_table')
    .select('"PhoneNumber"')
    .eq('UserId', parseInt(coachId, 10))
    .maybeSingle();
  if (error) {
    console.warn('⚠️ [repo:getCoachPhone] Error fetching coach phone:', error.message);
    return null;
  }
  const phone = data?.PhoneNumber;
  const result = phone && String(phone).trim() ? String(phone).trim() : null;
  console.log('✅ [repo:getCoachPhone] coachPhone:', result ? 'found' : 'not found');
  return result;
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
 * Get nutrition totals for a calendar day in the user's timezone.
 */
export async function getNutritionForDate(userId, dateYmd, timezoneIana = IANA_IST) {
  const supabase = getSupabaseClient();
  console.log('🗄️ [repo:getNutritionForDate] userId:', userId, 'date:', dateYmd);

  let query = supabase
    .from('food_nutrition_data_table')
    .select('"TotalCalories", "TotalProtein", "TotalCarbs", "TotalFat"')
    .eq('"UserID"', String(userId))
    .or('IsDeleted.is.null,IsDeleted.eq.0');
  query = applyDayFilter(query, '"CreatedAt"', dateYmd, timezoneIana);
  const { data, error } = await query;

  if (error) {
    console.error('❌ [repo:getYesterdayNutrition] Supabase error:', error.message);
    throw error;
  }
  console.log('✅ [repo:getNutritionForDate] Rows found:', data?.length);

  if (!data || data.length === 0) {
    console.log('⚠️ [repo:getNutritionForDate] No nutrition data — returning zeros');
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
  console.log('📊 [repo:getNutritionForDate] Aggregated totals:', JSON.stringify(totals));
  return totals;
}

/** @deprecated Use getNutritionForDate */
export async function getYesterdayNutrition(userId, dateYmd, timezoneIana) {
  return getNutritionForDate(userId, dateYmd, timezoneIana);
}

/** @deprecated Use getNutritionForDate */
export async function getTodayNutrition(userId, dateYmd, timezoneIana) {
  return getNutritionForDate(userId, dateYmd, timezoneIana);
}

/**
 * Get water intake (ml) for a calendar day by scanning beverage food logs.
 */
export async function getWaterForDate(userId, dateYmd, timezoneIana = IANA_IST) {
  const supabase = getSupabaseClient();
  console.log('🗄️ [repo:getWaterForDate] userId:', userId, 'date:', dateYmd);

  let query = supabase
    .from('food_nutrition_data_table')
    .select('"AnalysisData"')
    .eq('"UserID"', String(userId))
    .or('IsDeleted.is.null,IsDeleted.eq.0');
  query = applyDayFilter(query, '"CreatedAt"', dateYmd, timezoneIana);
  const { data, error } = await query;

  if (error) {
    console.error('❌ [repo:getYesterdayWater] Supabase error:', error.message);
    return 0;
  }

  if (!data || data.length === 0) {
    console.log('⚠️ [repo:getWaterForDate] No food rows — returning 0 ml');
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
  console.log('✅ [repo:getWaterForDate] Total water:', result, 'ml');
  return result;
}

/** @deprecated Use getWaterForDate */
export async function getYesterdayWater(userId, dateYmd, timezoneIana) {
  return getWaterForDate(userId, dateYmd, timezoneIana);
}

/**
 * Get best step/activity record for a calendar day.
 */
export async function getActivityForDate(userId, dateYmd, timezoneIana = IANA_IST) {
  const supabase = getSupabaseClient();
  console.log('🗄️ [repo:getActivityForDate] userId:', userId, 'date:', dateYmd);

  let query = supabase
    .from('daily_step_activity')
    .select('"Steps", "CaloriesBurned", "ActivityType"')
    .eq('UserId', parseInt(userId, 10));
  query = applyDayFilter(query, 'CreatedAt', dateYmd, timezoneIana);
  const { data, error } = await query
    .order('Steps', { ascending: false })
    .limit(1);

  if (error) {
    console.error('❌ [repo:getYesterdayActivity] Supabase error:', error.message);
    return null;
  }

  if (!data || data.length === 0) {
    console.log('⚠️ [repo:getActivityForDate] No activity recorded for date');
    return { steps: 0, caloriesBurned: 0, activityType: null };
  }

  const row = data[0];
  const result = {
    steps: parseInt(row.Steps || 0, 10),
    caloriesBurned: parseFloat(row.CaloriesBurned || 0),
    activityType: row.ActivityType || null,
  };
  console.log('✅ [repo:getActivityForDate] Activity:', JSON.stringify(result));
  return result;
}

/** @deprecated Use getActivityForDate */
export async function getYesterdayActivity(userId, dateYmd, timezoneIana) {
  return getActivityForDate(userId, dateYmd, timezoneIana);
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
