import { getTimeWindows } from '../../../utils/disciplineCalculationsSupabase.js';
import { computeDailyIntake } from '../../water/domain/intake.rules.js';
import * as waterRepo from '../../water/data/water.repo.js';
import { fetchMealsForDate } from '../../food-corrections/food-corrections.repository.js';
import { getUserWeightGoal } from '../../weight-progress-tips/data/weight-progress.repo.js';
import * as activityRepo from '../../activity/activity.repository.js';
import { resolveDailyExerciseCalories } from '../../activity/domain/watch-calories.helpers.js';
import { deriveWeightGoalMode } from '../../../utils/weightValidation.js';
import { normalizeParameterConfig, DEFAULT_PARAMETER_CONFIG } from '../domain/parameter-registry.js';
import { resolveCalorieTargetFromProfile } from '../../../utils/tdeeCalculations.js';
import { computeNutritionTargets } from '../domain/nutrition-targets.js';
import {
  aggregateDailyFoodStats,
  calculateWellnessScore,
} from '../domain/score.rules.js';
import { enumerateScoreDates } from '../domain/date-range.js';
import * as repo from '../data/wellness-score.repo.js';
import { todayInIST } from '../validation/wellness-score.schema.js';

function mapStoredDailyScoreRow(row, userId) {
  return {
    date: row.score_date,
    userId: String(userId),
    totalEarned: row.total_earned,
    totalPossible: row.total_possible,
    percentage: row.percentage,
    goalMode: row.goal_mode || 'loss',
    parameters: Array.isArray(row.parameters) ? row.parameters : [],
    computedAt: row.computed_at,
    fromStorage: true,
  };
}

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

function buildScorePayload({ userId, date, goalMode, scores }) {
  return {
    date,
    userId,
    totalEarned: scores.totalEarned,
    totalPossible: scores.totalPossible,
    percentage: scores.percentage,
    goalMode: goalMode || 'loss',
    parameters: scores.parameters,
  };
}

async function persistDailyScore(userId, payload) {
  try {
    await repo.upsertDailyScore({
      userId,
      scoreDate: payload.date,
      totalEarned: payload.totalEarned,
      totalPossible: payload.totalPossible,
      percentage: payload.percentage,
      goalMode: payload.goalMode,
      parameters: payload.parameters,
    });
  } catch {
    /* non-fatal — score still returned to client */
  }
}

/**
 * Compute wellness score for one IST business date and persist snapshot.
 */
export async function computeDailyScoreForDate({ userId, date }) {
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
  const exerciseCalories = resolveDailyExerciseCalories(stepRows, watchRows);
  const currentWeight = pickCurrentWeight(weightRecords, latestWeightRow);
  const previousWeight = previousWeightRow ? parseFloat(previousWeightRow.Weight) : null;
  const resolvedGoalMode = deriveWeightGoalMode({
    heightCm: userGoal?.Height,
    currentWeightKg: currentWeight,
  }) || userGoal?.WeightGoalMode || 'loss';

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
    goalMode: resolvedGoalMode,
    exerciseCalories,
    bmr,
  });

  const payload = buildScorePayload({ userId, date, goalMode: resolvedGoalMode, scores });
  await persistDailyScore(userId, payload);
  return payload;
}

/**
 * GET /api/wellness-score/daily
 */
export async function getDailyScore({ userId, date }) {
  const data = await computeDailyScoreForDate({ userId, date });
  return {
    httpStatus: 200,
    body: {
      ok: true,
      data,
    },
  };
}

/**
 * GET /api/wellness-score/history
 */
export async function getScoreHistory({ userId, startDate, endDate }) {
  const dates = enumerateScoreDates(startDate, endDate);
  const today = todayInIST();
  const storedRows = await repo.getStoredScoresInRange(userId, startDate, endDate);
  const storedByDate = new Map(storedRows.map((row) => [row.score_date, row]));

  const days = await Promise.all(
    dates.map(async (date) => {
      const stored = storedByDate.get(date);
      if (stored && date < today) {
        return mapStoredDailyScoreRow(stored, userId);
      }
      return computeDailyScoreForDate({ userId, date });
    }),
  );

  return {
    httpStatus: 200,
    body: {
      ok: true,
      data: {
        startDate,
        endDate,
        days,
      },
    },
  };
}
