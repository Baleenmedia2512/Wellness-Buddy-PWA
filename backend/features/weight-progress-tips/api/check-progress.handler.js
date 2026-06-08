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
  // Step 1: Validate input
  const { userId, currentWeightId } = validateCheckProgress(query);

  // Step 2: Fetch user's weight goal mode
  const userGoal = await getUserWeightGoal(userId);
  if (!userGoal || !userGoal.WeightGoalMode) {
    return {
      ok: true,
      data: {
        shouldShow: false,
        reason: 'No weight goal mode set',
      },
    };
  }

  const goalMode = userGoal.WeightGoalMode.toLowerCase();

  // Step 3: Fetch recent weight records (today and yesterday)
  const weights = await getRecentWeights(userId, 2);
  
  // ✅ MODIFIED: Show popup even on first upload (no comparison needed)
  if (weights.length < 1) {
    return {
      ok: true,
      data: {
        shouldShow: false,
        reason: 'No weight records found',
      },
    };
  }

  const currentWeight = weights[0]; // Most recent weight
  
  // If this is the first weight upload, show popup anyway (no comparison)
  if (weights.length === 1) {
    // First upload - show popup with welcome tips
    const currentWeightValue = parseFloat(currentWeight.Weight);
    
    // Calculate water target
    const waterTarget = calculateWaterTarget(currentWeightValue);
    
    // Generate first-time tips (no comparison)
    const firstTimeTips = [
      { tip: `Start your journey! Your target: ${goalMode === 'loss' ? 'lose' : 'gain'} weight`, priority: 'high' },
      { tip: `Drink at least ${Math.round(waterTarget / 1000)} liters of water daily`, priority: 'high' },
      { tip: 'Track your meals every day for best results', priority: 'medium' },
      { tip: 'Upload your weight at the same time every morning', priority: 'medium' },
    ];
    
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

  // Step 4: Check for reverse progress using domain logic
  const reverseCheck = checkReverseProgress({
    currentWeight: parseFloat(currentWeight.Weight),
    previousWeight: parseFloat(previousWeight.Weight),
    goalMode,
  });

  if (!reverseCheck.hasReverseProgress) {
    return {
      ok: true,
      data: {
        shouldShow: false,
        reason: 'No reverse progress detected',
        weightChange: reverseCheck.weightChange,
        direction: reverseCheck.direction,
      },
    };
  }

  // Step 5: Calculate date ranges for yesterday and today (IST timezone)
  const now = new Date();
  const istResult = convertToIST(now);
  const todayIST = istResult.istDate; // This is a Date object in IST
  const todayStart = new Date(todayIST.toISOString().substring(0, 10) + 'T00:00:00.000Z');

  const yesterdayIST = new Date(todayIST);
  yesterdayIST.setDate(yesterdayIST.getDate() - 1);
  const yesterdayStart = new Date(yesterdayIST.toISOString().substring(0, 10) + 'T00:00:00.000Z');
  const yesterdayEnd = todayStart.toISOString(); // yesterday ends when today starts

  // Step 6: Fetch yesterday's and today's nutrition
  const yesterdayNutrition = await getYesterdayNutrition(userId, yesterdayStart.toISOString(), yesterdayEnd);
  const todayNutrition = await getTodayNutrition(userId, todayStart.toISOString());

  // Step 7: Compare nutrition using domain logic
  const nutritionDiff = compareNutrition({
    today: todayNutrition,
    yesterday: yesterdayNutrition,
  });

  // Step 8: Fetch yesterday's water intake
  const waterYesterday = await getYesterdayWater(userId, yesterdayStart.toISOString(), yesterdayEnd);

  // Step 9: Calculate water target based on weight
  const waterTarget = calculateWaterTarget(parseFloat(currentWeight.Weight));

  // Step 10: Generate tips using domain logic
  const tips = generateTips({
    nutritionDiff,
    waterYesterday,
    goalMode,
    weightChange: reverseCheck.weightChange,
  });

  // Step 11: Build comparison data for UI
  const comparison = {
    weight: {
      previous: parseFloat(previousWeight.Weight),
      current: parseFloat(currentWeight.Weight),
      change: reverseCheck.weightChange,
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

  // Step 12: Return full payload for UI
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
