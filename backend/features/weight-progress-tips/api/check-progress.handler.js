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
import { convertToIST } from '../../../utils/timezoneConverter.js';

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
  if (weights.length < 2) {
    return {
      ok: true,
      data: {
        shouldShow: false,
        reason: 'Insufficient weight history (need at least 2 records)',
      },
    };
  }

  const [currentWeight, previousWeight] = weights;

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
  const todayIST = convertToIST(now);
  const todayStart = new Date(todayIST.toDateString()).toISOString();

  const yesterdayIST = new Date(todayIST);
  yesterdayIST.setDate(yesterdayIST.getDate() - 1);
  const yesterdayStart = new Date(yesterdayIST.toDateString()).toISOString();
  const yesterdayEnd = todayStart; // yesterday ends when today starts

  // Step 6: Fetch yesterday's and today's nutrition
  const yesterdayNutrition = await getYesterdayNutrition(userId, yesterdayStart, yesterdayEnd);
  const todayNutrition = await getTodayNutrition(userId, todayStart);

  // Step 7: Compare nutrition using domain logic
  const nutritionDiff = compareNutrition({
    today: todayNutrition,
    yesterday: yesterdayNutrition,
  });

  // Step 8: Fetch yesterday's water intake
  const waterYesterday = await getYesterdayWater(userId, yesterdayStart, yesterdayEnd);

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
