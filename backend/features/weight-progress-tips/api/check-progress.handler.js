/**
 * check-progress.handler.js — Orchestration for checking weight progress and generating tips.
 * Combines data fetching with domain logic.
 */
import { validateCheckProgress } from '../validation/check-progress.schema.js';
import {
  checkReverseProgress,
  generateTips,
  calculateWaterTarget,
  computeCalorieTarget,
  computeProteinTarget,
  computeMacroTargets,
  computeDisplayCalorieTarget,
  STEPS_TARGET,
  SLEEP_TARGET_HRS,
} from '../domain/weight-progress-rules.js';
import {
  getUserWeightGoal,
  getRecentWeights,
  getYesterdayNutrition,
  getTodayNutrition,
  getYesterdayWater,
  getYesterdayActivity,
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

  const goalMode = (userGoal?.WeightGoalMode || 'loss').toLowerCase();
  const bmr = parseFloat(userGoal.Bmr) || 0;
  console.log('✅ [Step 2] goalMode:', goalMode, 'BMR:', bmr);

  // Step 3: Fetch recent weight records
  console.log('🔍 [Step 3] Fetching last 2 weight records for userId:', userId);
  const weights = await getRecentWeights(userId, 2);
  console.log('📋 [Step 3] weights fetched:', weights.length, 'records:', JSON.stringify(weights));

  if (weights.length < 1) {
    console.log('⚠️ [Step 3] No weight records found — returning shouldShow: false');
    return {
      ok: true,
      data: { shouldShow: false, reason: 'No weight records found' },
    };
  }

  // If a specific weight ID was supplied, use it as "current"; otherwise take the latest.
  let currentWeight = weights[0];
  if (currentWeightId) {
    const match = weights.find((w) => Number(w.ID) === Number(currentWeightId));
    if (match) currentWeight = match;
  }
  console.log('✅ [Step 3] currentWeight:', currentWeight.Weight, 'kg (ID:', currentWeight.ID, ')');

  const currentWeightValue = parseFloat(currentWeight.Weight);
  const waterTarget = calculateWaterTarget(currentWeightValue);
  const calorieTarget = computeCalorieTarget(bmr, goalMode);
  const displayCalorieTarget = computeDisplayCalorieTarget(bmr);
  const { proteinTarget, fatTarget, carbsTarget } = computeMacroTargets(bmr, currentWeightValue);
  const proteinTargetForTips = computeProteinTarget(currentWeightValue);
  console.log('🎯 [Step 3] targets — calories:', displayCalorieTarget, 'kcal | protein:', proteinTarget, 'g | water:', waterTarget, 'ml');

  // If this is the first weight upload, show welcome tips without reverse-progress check.
  if (weights.length === 1) {
    console.log('🎉 [Step 3] First weight upload — showing welcome tips');
    const firstTimeTips = [
      {
        priority: 'high',
        message: `Start your journey! Your goal: ${goalMode === 'loss' ? 'lose weight' : 'gain weight'}. Stay consistent.`,
        icon: '🎯',
      },
      {
        priority: 'high',
        message: `Drink at least ${Math.round(waterTarget / 1000)} L (${waterTarget} ml) of water daily.`,
        icon: '💧',
      },
      {
        priority: 'medium',
        message: 'Track every meal for best results — even small snacks count.',
        icon: '🍽️',
      },
      {
        priority: 'medium',
        message: 'Upload your weight at the same time each morning for accurate trends.',
        icon: '⚖️',
      },
    ];

    return {
      ok: true,
      data: {
        shouldShow: true,
        comparison: {
          weight: { previous: null, current: currentWeightValue, change: 0, direction: 'first' },
          nutrition: {
            yesterday: { calories: 0, protein: 0, carbs: 0, fat: 0 },
          },
          water: { yesterday: 0, target: waterTarget },
          activity: null,
          targets: {
            calories: displayCalorieTarget,
            protein: proteinTarget,
            carbs: carbsTarget,
            fat: fatTarget,
            water: waterTarget,
            steps: STEPS_TARGET,
            sleep: SLEEP_TARGET_HRS,
          },
        },
        tips: firstTimeTips,
        goalMode,
        isFirstUpload: true,
      },
    };
  }

  // From second upload onwards — check for reverse progress.
  const previousWeight = weights.find((w) => w.ID !== currentWeight.ID) || weights[1];
  console.log('📊 [Step 3] previousWeight:', previousWeight.Weight, 'kg | currentWeight:', currentWeightValue, 'kg');

  // Step 4: Check for reverse progress using domain logic
  console.log('🔍 [Step 4] Running checkReverseProgress. goalMode:', goalMode);
  const reverseCheck = checkReverseProgress({
    currentWeight: currentWeightValue,
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

  // Step 5: Calculate date ranges for yesterday (IST timezone)
  console.log('🕐 [Step 5] Calculating IST date ranges...');
  const now = new Date();
  const istResult = convertToIST(now);
  const todayIST = istResult.istDate;
  const todayStart = new Date(todayIST.toISOString().substring(0, 10) + 'T00:00:00.000Z');
  const yesterdayIST = new Date(todayIST);
  yesterdayIST.setDate(yesterdayIST.getDate() - 1);
  const yesterdayStart = new Date(yesterdayIST.toISOString().substring(0, 10) + 'T00:00:00.000Z');
  const yesterdayEnd = todayStart.toISOString();
  console.log('✅ [Step 5] Date ranges — yesterdayStart:', yesterdayStart.toISOString(), 'yesterdayEnd:', yesterdayEnd);

  // Step 6: Fetch yesterday's nutrition
  console.log('🔍 [Step 6] Fetching yesterday nutrition for userId:', userId);
  const yesterdayNutrition = await getYesterdayNutrition(userId, yesterdayStart.toISOString(), yesterdayEnd);
  console.log('📋 [Step 6] yesterdayNutrition:', JSON.stringify(yesterdayNutrition));

  // Step 7: Fetch yesterday's water intake (now implemented)
  console.log('🔍 [Step 7] Fetching yesterday water for userId:', userId);
  const waterYesterday = await getYesterdayWater(userId, yesterdayStart.toISOString(), yesterdayEnd);
  console.log('📋 [Step 7] waterYesterday:', waterYesterday, 'ml');

  // Step 8: Fetch yesterday's activity (steps, calories burned)
  console.log('🔍 [Step 8] Fetching yesterday activity for userId:', userId);
  const activityYesterday = await getYesterdayActivity(userId, yesterdayStart.toISOString(), yesterdayEnd);
  console.log('📋 [Step 8] activityYesterday:', JSON.stringify(activityYesterday));

  // Step 9: Generate yesterday-focused tips using domain logic
  console.log('🔍 [Step 9] Generating tips...');
  const tips = generateTips({
    yesterdayNutrition,
    waterYesterday,
    waterTarget,
    calorieTarget,
    proteinTarget: proteinTargetForTips,
    goalMode,
    weightChange: reverseCheck.change,
    activityYesterday,
  });
  console.log('💡 [Step 9] tips generated:', tips.length, JSON.stringify(tips));

  // Step 10: Build comparison data for UI (includes targets for the modal)
  const comparison = {
    weight: {
      previous: parseFloat(previousWeight.Weight),
      current: currentWeightValue,
      change: reverseCheck.change,
      direction: reverseCheck.direction,
    },
    nutrition: {
      yesterday: yesterdayNutrition,
    },
    water: {
      yesterday: waterYesterday,
      target: waterTarget,
    },
    activity: activityYesterday,
    targets: {
      calories: displayCalorieTarget,
      protein: proteinTarget,
      carbs: carbsTarget,
      fat: fatTarget,
      water: waterTarget,
      steps: STEPS_TARGET,
      sleep: SLEEP_TARGET_HRS,
    },
  };
  console.log('✅ [Step 10] comparison built');

  // Step 11: Return full payload for UI
  console.log('🏁 [Step 11] Returning shouldShow: true with', tips.length, 'tips for goalMode:', goalMode);
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
