/**
 * check-progress.handler.js — Orchestration for checking weight progress and generating tips.
 * Combines data fetching with domain logic.
 */
import { validateCheckProgress } from '../validation/check-progress.schema.js';
import {
  checkReverseProgress,
  compareNutrition,
  generateTips,
  calculateWaterTarget,
} from '../domain/weight-progress-rules.js';
import {
  getUserWeightGoal,
  getRecentWeights,
  getYesterdayNutrition,
  getTodayNutrition,
  getYesterdayWater,
} from '../data/weight-progress.repo.js';
import { convertToIST } from '../../../utils/supabaseClient.js';

/**
 * Check if user has reverse weight progress and generate actionable tips.
 * 
 * @param {object} query - Request query params
 * @param {number} query.userId - User ID
 * @param {number} [query.currentWeightId] - Optional: specific weight record ID
 * @returns {object} { shouldShow: boolean, comparison?: object, tips?: array, waterTarget?: number }
 */
export async function checkProgressHandler(query) {
  console.log('🚀 [check-progress] Handler started. Query:', query);

  // Step 1: Validate input
  const { userId, currentWeightId } = validateCheckProgress(query);
  console.log('✅ [Step 1] Input validated. userId:', userId, 'currentWeightId:', currentWeightId);

  // Step 2: Fetch user's weight goal mode
  console.log('🔍 [Step 2] Fetching weight goal mode for userId:', userId);
  const userGoal = await getUserWeightGoal(userId);
  console.log('📋 [Step 2] userGoal result:', userGoal);

  if (!userGoal || !userGoal.WeightGoalMode) {
    console.log('⚠️ [Step 2] No WeightGoalMode set — returning shouldShow: false');
    return {
      ok: true,
      data: {
        shouldShow: false,
        reason: 'No weight goal mode set',
      },
    };
  }

  const goalMode = userGoal.WeightGoalMode.toLowerCase();
  console.log('✅ [Step 2] goalMode:', goalMode);

  // Step 3: Fetch recent weight records (today and yesterday)
  console.log('🔍 [Step 3] Fetching last 2 weight records for userId:', userId);
  const weights = await getRecentWeights(userId, 2);
  console.log('📋 [Step 3] weights fetched:', weights.length, 'records:', JSON.stringify(weights));

  if (weights.length < 1) {
    console.log('⚠️ [Step 3] No weight records found — returning shouldShow: false');
    return {
      ok: true,
      data: {
        shouldShow: false,
        reason: 'No weight records found',
      },
    };
  }

  const currentWeight = weights[0];
  console.log('✅ [Step 3] currentWeight:', currentWeight.Weight, 'kg (ID:', currentWeight.ID, ')');

  // If this is the first weight upload, show popup anyway (no comparison)
  if (weights.length === 1) {
    console.log('🎉 [Step 3] First weight upload — showing welcome tips');
    const currentWeightValue = parseFloat(currentWeight.Weight);
    const waterTarget = calculateWaterTarget(currentWeightValue);
    console.log('💧 [Step 3] waterTarget for first upload:', waterTarget, 'ml');

    const firstTimeTips = [
      { tip: `Start your journey! Your target: ${goalMode === 'loss' ? 'lose' : 'gain'} weight`, priority: 'high' },
      { tip: `Drink at least ${Math.round(waterTarget / 1000)} liters of water daily`, priority: 'high' },
      { tip: 'Track your meals every day for best results', priority: 'medium' },
      { tip: 'Upload your weight at the same time every morning', priority: 'medium' },
    ];
    console.log('✅ [Step 3] firstTimeTips generated:', firstTimeTips.length, 'tips');

    return {
      ok: true,
      data: {
        shouldShow: true,
        comparison: {
          weight: {
            previous: null,
            current: currentWeightValue,
            change: 0,
            direction: 'first',
          },
          nutrition: {
            yesterday: { calories: 0, protein: 0, carbs: 0, fat: 0 },
            today: { calories: 0, protein: 0, carbs: 0, fat: 0 },
            diff: { calories: 0, protein: 0, carbs: 0, fat: 0 },
          },
          water: {
            yesterday: 0,
            target: waterTarget,
          },
        },
        tips: firstTimeTips,
        goalMode,
        isFirstUpload: true,
      },
    };
  }

  // From second upload onwards - check for reverse progress
  const previousWeight = weights[1];
  console.log('📊 [Step 3] previousWeight:', previousWeight.Weight, 'kg | currentWeight:', currentWeight.Weight, 'kg');

  // Step 4: Check for reverse progress using domain logic
  console.log('🔍 [Step 4] Running checkReverseProgress. goalMode:', goalMode);
  const reverseCheck = checkReverseProgress({
    currentWeight: parseFloat(currentWeight.Weight),
    previousWeight: parseFloat(previousWeight.Weight),
    goalMode,
  });
  console.log('📋 [Step 4] reverseCheck result:', JSON.stringify(reverseCheck));

  if (!reverseCheck.hasReverseProgress) {
    console.log('✅ [Step 4] No reverse progress. direction:', reverseCheck.direction, '— returning shouldShow: false');
    return {
      ok: true,
      data: {
        shouldShow: false,
        reason: 'No reverse progress detected',
        weightChange: reverseCheck.change,
        direction: reverseCheck.direction,
      },
    };
  }

  console.log('🚨 [Step 4] REVERSE PROGRESS DETECTED! change:', reverseCheck.change, 'kg direction:', reverseCheck.direction);

  // Step 5: Calculate date ranges for yesterday and today (IST timezone)
  console.log('🕐 [Step 5] Calculating IST date ranges...');
  const now = new Date();
  const istResult = convertToIST(now);
  const todayIST = istResult.istDate;
  const todayStart = new Date(todayIST.toISOString().substring(0, 10) + 'T00:00:00.000Z');
  const yesterdayIST = new Date(todayIST);
  yesterdayIST.setDate(yesterdayIST.getDate() - 1);
  const yesterdayStart = new Date(yesterdayIST.toISOString().substring(0, 10) + 'T00:00:00.000Z');
  const yesterdayEnd = todayStart.toISOString();
  console.log('✅ [Step 5] Date ranges — yesterdayStart:', yesterdayStart.toISOString(), 'yesterdayEnd:', yesterdayEnd, 'todayStart:', todayStart.toISOString());

  // Step 6: Fetch yesterday's and today's nutrition
  console.log('🔍 [Step 6] Fetching yesterday nutrition for userId:', userId, 'range:', yesterdayStart.toISOString(), '→', yesterdayEnd);
  const yesterdayNutrition = await getYesterdayNutrition(userId, yesterdayStart.toISOString(), yesterdayEnd);
  console.log('📋 [Step 6] yesterdayNutrition:', JSON.stringify(yesterdayNutrition));

  console.log('🔍 [Step 6] Fetching today nutrition for userId:', userId, 'from:', todayStart.toISOString());
  const todayNutrition = await getTodayNutrition(userId, todayStart.toISOString());
  console.log('📋 [Step 6] todayNutrition:', JSON.stringify(todayNutrition));

  // Step 7: Compare nutrition using domain logic
  console.log('🔍 [Step 7] Comparing nutrition...');
  const nutritionDiff = compareNutrition({
    today: todayNutrition,
    yesterday: yesterdayNutrition,
  });
  console.log('📋 [Step 7] nutritionDiff:', JSON.stringify(nutritionDiff));

  // Step 8: Fetch yesterday's water intake
  console.log('🔍 [Step 8] Fetching yesterday water for userId:', userId);
  const waterYesterday = await getYesterdayWater(userId, yesterdayStart.toISOString(), yesterdayEnd);
  console.log('📋 [Step 8] waterYesterday:', waterYesterday, 'ml');

  // Step 9: Calculate water target based on weight
  const waterTarget = calculateWaterTarget(parseFloat(currentWeight.Weight));
  console.log('💧 [Step 9] waterTarget:', waterTarget, 'ml (based on weight:', currentWeight.Weight, 'kg)');

  // Step 10: Generate tips using domain logic
  console.log('🔍 [Step 10] Generating tips...');
  const tips = generateTips({
    nutritionDiff,
    waterYesterday,
    goalMode,
    weightChange: reverseCheck.change,
  });
  console.log('💡 [Step 10] tips generated:', tips.length, 'tips:', JSON.stringify(tips));

  // Step 11: Build comparison data for UI
  const comparison = {
    weight: {
      previous: parseFloat(previousWeight.Weight),
      current: parseFloat(currentWeight.Weight),
      change: reverseCheck.change,
      direction: reverseCheck.direction,
    },
    nutrition: {
      yesterday: yesterdayNutrition,
      today: todayNutrition,
      diff: nutritionDiff,
    },
    water: {
      yesterday: waterYesterday,
      target: waterTarget,
    },
  };
  console.log('✅ [Step 11] comparison built:', JSON.stringify(comparison));

  // Step 12: Return full payload for UI
  console.log('🏁 [Step 12] Returning shouldShow: true with', tips.length, 'tips for goalMode:', goalMode);
  return {
    ok: true,
    data: {
      shouldShow: true,
      comparison,
      tips,
      goalMode,
    },
  };
}
