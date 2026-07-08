import { getTimeWindows } from '../../../utils/disciplineCalculationsSupabase.js';
import { computeDailyIntake } from '../../water/domain/intake.rules.js';
import { normalizeParameterConfig, DEFAULT_PARAMETER_CONFIG } from '../domain/parameter-registry.js';
import { computeNutritionTargets } from '../domain/nutrition-targets.js';
import {
  aggregateDailyFoodStats,
  calculateWellnessScore,
} from '../domain/score.rules.js';
import * as repo from '../data/wellness-score.repo.js';

function pickBmr(teamRow) {
  const b = parseFloat(teamRow?.Bmr);
  return Number.isFinite(b) && b > 0 ? b : 0;
}

function pickCurrentWeight(weightRecords, teamRow) {
  if (weightRecords?.length) {
    const sorted = [...weightRecords].sort((a, b) => String(b.CreatedAt).localeCompare(String(a.CreatedAt)));
    const w = parseFloat(sorted[0]?.Weight);
    if (Number.isFinite(w) && w > 0) return w;
  }
  const tw = parseFloat(teamRow?.Weight);
  return Number.isFinite(tw) && tw > 0 ? tw : null;
}

/**
 * GET /api/wellness-score/daily
 */
export async function getDailyScore({ userId, date }) {
  const [
    configRow,
    teamRow,
    timeWindowsRaw,
    educationLogs,
    weightRecords,
    previousWeightRow,
    foodRecords,
    latestWeightKg,
    waterFoodRows,
    stepCalories,
    watchCalories,
  ] = await Promise.all([
    repo.getLatestConfig(),
    repo.getUserTeamRow(userId),
    getTimeWindows(),
    repo.getEducationLogsForDate(userId, date),
    repo.getWeightRecordsForDate(userId, date),
    repo.getPreviousWeightBeforeDate(userId, date),
    repo.getFoodRecordsForDate(userId, date),
    repo.getLatestWeightKg(userId),
    repo.getFoodRowsForWater(userId, date),
    repo.getStepCaloriesForDate(userId, date),
    repo.getWatchCaloriesForDate(userId, date),
  ]);

  const parameterConfig = normalizeParameterConfig(configRow?.parameters ?? DEFAULT_PARAMETER_CONFIG);
  const timeWindows = {
    weight: timeWindowsRaw?.weight,
    breakfast: timeWindowsRaw?.breakfast,
    lunch: timeWindowsRaw?.lunch,
    dinner: timeWindowsRaw?.dinner,
    education: timeWindowsRaw?.education,
  };

  const waterIntake = computeDailyIntake({
    userId,
    date,
    latestWeightKg,
    foodRows: waterFoodRows,
  });

  const bmr = pickBmr(teamRow);
  const weightKg = latestWeightKg ?? pickCurrentWeight(weightRecords, teamRow);
  const dailyStats = aggregateDailyFoodStats(foodRecords);
  const nutritionTargets = computeNutritionTargets({ bmr, weightKg });
  const exerciseCalories = stepCalories + watchCalories;
  const currentWeight = pickCurrentWeight(weightRecords, teamRow);
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
    goalMode: teamRow?.WeightGoalMode,
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
