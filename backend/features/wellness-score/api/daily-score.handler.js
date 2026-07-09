import { getTimeWindows } from '../../../utils/disciplineCalculationsSupabase.js';
import { computeDailyIntake } from '../../water/domain/intake.rules.js';
import * as waterRepo from '../../water/data/water.repo.js';
import { fetchMealsForDate } from '../../food-corrections/food-corrections.repository.js';
import { getUserWeightGoal } from '../../weight-progress-tips/data/weight-progress.repo.js';
import * as activityRepo from '../../activity/activity.repository.js';
import { normalizeParameterConfig, DEFAULT_PARAMETER_CONFIG } from '../domain/parameter-registry.js';
import { resolveCalorieTargetFromProfile } from '../../../utils/tdeeCalculations.js';
import { computeNutritionTargets } from '../domain/nutrition-targets.js';
import {
  aggregateDailyFoodStats,
  calculateWellnessScore,
} from '../domain/score.rules.js';
import * as repo from '../data/wellness-score.repo.js';

function pickBmr(userGoal) {
  const b = parseFloat(userGoal?.Bmr);
  return Number.isFinite(b) && b > 0 ? b : 0;
}

function parseWeightKg(row) {
  const w = parseFloat(row?.Weight);
  return Number.isFinite(w) && w > 0 ? w : null;
}

function pickCurrentWeight(weightRecords, latestWeightRow) {
  if (weightRecords?.length) {
    const sorted = [...weightRecords].sort((a, b) => String(b.CreatedAt).localeCompare(String(a.CreatedAt)));
    const w = parseWeightKg(sorted[0]);
    if (w != null) return w;
  }
  return parseWeightKg(latestWeightRow);
}

function sumStepCalories(stepRows = []) {
  return stepRows.reduce((sum, row) => sum + (Number(row.CaloriesBurned) || 0), 0);
}

function sumWatchCalories(watchRows = []) {
  let total = 0;
  for (const row of watchRows) {
    const match = String(row.Topic || '').match(/(\d+(?:\.\d+)?)\s*kcal/i);
    if (match) total += Math.round(parseFloat(match[1]));
  }
  return total;
}

/**
 * GET /api/wellness-score/daily
 */
export async function getDailyScore({ userId, date }) {
  const [
    configRow,
    userGoal,
    timeWindowsRaw,
    educationLogs,
    weightRecords,
    previousWeightRow,
    foodRecords,
    latestWeightRow,
    waterFoodRows,
    stepRows,
    watchRows,
  ] = await Promise.all([
    repo.getLatestConfig(),
    getUserWeightGoal(userId),
    getTimeWindows(),
    repo.getEducationLogsForDate(userId, date),
    repo.getWeightRecordsForDate(userId, date),
    repo.getPreviousWeightBeforeDate(userId, date),
    fetchMealsForDate(userId, date),
    waterRepo.getLatestWeight(userId),
    waterRepo.getFoodRowsForDate(userId, date),
    activityRepo.fetchDailyRows(userId, date, date),
    activityRepo.fetchWatchCalorieRows(userId, date),
  ]);

  const parameterConfig = normalizeParameterConfig(configRow?.parameters ?? DEFAULT_PARAMETER_CONFIG);
  const timeWindows = {
    weight: timeWindowsRaw?.weight,
    breakfast: timeWindowsRaw?.breakfast,
    lunch: timeWindowsRaw?.lunch,
    dinner: timeWindowsRaw?.dinner,
    education: timeWindowsRaw?.education,
  };

  const latestWeightKg = parseWeightKg(latestWeightRow);
  const waterIntake = computeDailyIntake({
    userId,
    date,
    latestWeightKg: latestWeightRow?.Weight ?? null,
    foodRows: waterFoodRows,
  });

  const bmr = pickBmr(userGoal);
  const calorieTarget = resolveCalorieTargetFromProfile({
    bmr,
    physicalActivityLevel: userGoal?.PhysicalActivityLevel,
  }) || bmr;
  const weightKg = latestWeightKg;
  const dailyStats = aggregateDailyFoodStats(foodRecords);
  const nutritionTargets = computeNutritionTargets({ bmr: calorieTarget, weightKg });
  const exerciseCalories = sumStepCalories(stepRows) + sumWatchCalories(watchRows);
  const currentWeight = pickCurrentWeight(weightRecords, latestWeightRow);
  const previousWeight = previousWeightRow ? parseFloat(previousWeightRow.Weight) : null;

  const scores = calculateWellnessScore({
    parameterConfig,
    educationLogs,
    weightRecords,
    foodRecords,
    waterConsumedMl: waterIntake?.totalMl ?? 0,
    waterRequiredMl: waterIntake?.requiredMl ?? 0,
    timeWindows,
    dailyStats,
    nutritionTargets,
    currentWeight,
    previousWeight,
    goalMode: userGoal?.WeightGoalMode,
    exerciseCalories,
    bmr,
  });

  return {
    httpStatus: 200,
    body: {
      ok: true,
      data: {
        date,
        userId,
        totalEarned: scores.totalEarned,
        totalPossible: scores.totalPossible,
        percentage: scores.percentage,
        parameters: scores.parameters,
      },
    },
  };
}
