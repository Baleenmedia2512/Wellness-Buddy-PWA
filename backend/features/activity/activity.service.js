import * as repo from './activity.repository.js';
import {
  maxWatchCaloriesFromRows,
  parseWatchKcalFromTopic,
  groupWatchCaloriesByDate,
} from './domain/watch-calories.helpers.js';
import { getUserTimezoneIana } from '../user/domain/userTimezone.js';
import {
  resolveRequestedDateYmd,
  assertNotFutureDateYmd,
  todayInTimezone,
  shiftDateYmd,
  nowUtc,
} from '../../shared/lib/datetime/index.js';
import { ValidationError } from '../../shared/lib/ValidationError.js';

const MAX_DAILY_STEPS = 50_000;
/** Keep aligned with food-corrections MAX_STATS_RANGE_DAYS (home custom ~6 months). */
const MAX_WATCH_RANGE_DAYS = 186;

function inclusiveDayCount(startDate, endDate) {
  const a = Date.parse(`${startDate}T00:00:00Z`);
  const b = Date.parse(`${endDate}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.floor((b - a) / 86_400_000) + 1;
}

function formatDateKeyFromTimestamp(value) {
  if (!value) return null;
  const match = String(value).match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

function normalizeRow(row) {
  if (!row) return null;
  const createdAt = row.CreatedAt ?? row.EntryDateTime ?? row.ActivityDate ?? null;
  const updatedAt = row.UpdatedAt ?? null;
  return {
    activityDate: formatDateKeyFromTimestamp(createdAt),
    steps: Number.parseInt(row.Steps ?? 0, 10) || 0,
    activityType: (row.ActivityType ?? 'walking').toLowerCase(),
    caloriesBurned: Number(row.CaloriesBurned ?? row.caloriesBurned ?? row.calories_burned ?? 0) || 0,
    createdAt, updatedAt, savedAt: updatedAt || createdAt,
  };
}

function buildTrend(rows, todayKey, days, timezoneIana) {
  const rowMap = new Map();
  rows.forEach((row) => {
    const n = normalizeRow(row);
    if (!n?.activityDate) return;
    const existing = rowMap.get(n.activityDate);
    if (!existing || n.steps > existing.steps) rowMap.set(n.activityDate, n);
  });
  const trend = [];
  const startKey = shiftDateYmd(todayKey, -(days - 1), timezoneIana);
  for (let i = 0; i < days; i++) {
    const dateKey = shiftDateYmd(startKey, i, timezoneIana);
    const item = rowMap.get(dateKey);
    trend.push({
      date: dateKey,
      steps: item?.steps || 0,
      caloriesBurned: Number((item?.caloriesBurned || 0).toFixed(2)),
      activityType: item?.activityType || null,
      createdAt: item?.createdAt || null,
      updatedAt: item?.updatedAt || null,
      savedAt: item?.savedAt || null,
    });
  }
  return trend;
}

function caloriesFor(activityType, steps) {
  const safeSteps = Math.max(0, Number.parseInt(steps, 10) || 0);
  const multipliers = { walking: 0.04 };
  const multiplier = multipliers[activityType] || multipliers.walking;
  return Number((safeSteps * multiplier).toFixed(2));
}

// ─── getDailyActivity ───────────────────────────────────────────────────────
export async function getDailyActivity({ userId, trendDays, activityType, targetDate }) {
  if (userId === 'DEMO_USER') {
    return {
      httpStatus: 200,
      body: { success: true, today: { steps: 0, caloriesBurned: 0, activityType: 'walking' }, trend: [] },
    };
  }
  const timezoneIana = await getUserTimezoneIana(userId);
  const resolvedDate = resolveRequestedDateYmd(targetDate, timezoneIana);
  assertNotFutureDateYmd(resolvedDate, timezoneIana);
  const startDate = shiftDateYmd(resolvedDate, -(trendDays - 1), timezoneIana);
  const rows = await repo.fetchDailyRows(userId, startDate, resolvedDate, activityType, timezoneIana);
  const trend = buildTrend(rows, resolvedDate, trendDays, timezoneIana);
  const today = trend[trend.length - 1] || {
    date: resolvedDate, steps: 0, caloriesBurned: 0, activityType: null, createdAt: null,
  };
  return { httpStatus: 200, body: { success: true, today, trend } };
}

// ─── saveDailyActivity ──────────────────────────────────────────────────────
export async function saveDailyActivity(input) {
  const { userId, activityDate: activityDateRaw, steps, activityType, caloriesBurned } = input;
  const timezoneIana = await getUserTimezoneIana(userId);
  const activityDate = activityDateRaw || todayInTimezone(timezoneIana);
  const safeSteps = Math.max(0, Number.parseInt(steps, 10) || 0);
  const computedCalories = caloriesBurned !== undefined && caloriesBurned !== null
    ? Math.abs(Number(caloriesBurned)) : caloriesFor(activityType, safeSteps);
  const numericUserId = Number.parseInt(userId, 10);

  const existingRows = await repo.findExistingDailyRows(numericUserId, activityDate);
  const existing = existingRows[0] || null;

  if (safeSteps > MAX_DAILY_STEPS) {
    return {
      httpStatus: 200,
      body: { success: true, message: 'Daily activity saved successfully', data: existing || null },
    };
  }

  const effectiveSteps = Math.max(safeSteps, existing?.Steps ?? 0);
  const effectiveCalories = Math.max(computedCalories, existing?.CaloriesBurned ?? 0);
  const now = nowUtc();
  const payload = {
    UserId: numericUserId, Steps: effectiveSteps, ActivityType: activityType,
    CaloriesBurned: effectiveCalories, UpdatedAt: now,
  };

  let savedRow;
  if (existing) {
    if (effectiveSteps === existing.Steps) {
      savedRow = existing;
    } else {
      savedRow = await repo.updateDailyRow(existing.Id, payload);
    }
  } else {
    const createdAt = `${activityDate}T12:00:00`;
    const { data, error } = await repo.insertDailyRow({ ...payload, CreatedAt: createdAt });
    if (error) {
      // Retry as update fallback (race condition)
      const retryRows = await repo.findExistingDailyRows(numericUserId, activityDate);
      const retryExisting = retryRows[0];
      if (!retryExisting) throw error;
      if (effectiveSteps <= retryExisting.Steps) {
        savedRow = retryExisting;
      } else {
        savedRow = await repo.updateDailyRow(retryExisting.Id, payload);
      }
    } else {
      savedRow = data;
    }
  }

  await repo.touchLastActive(userId);

  return {
    httpStatus: 200,
    body: { success: true, message: 'Daily activity saved successfully', data: savedRow },
  };
}

// ─── getWatchBurnedCalories ─────────────────────────────────────────────────
export async function getWatchBurnedCalories({
  userId,
  targetDate,
  startDate = null,
  endDate = null,
}) {
  if (userId === 'DEMO_USER') {
    return { httpStatus: 200, body: { success: true, caloriesBurned: 0, entries: [], byDate: {} } };
  }
  const timezoneIana = await getUserTimezoneIana(userId);

  if (startDate && endDate) {
    const resolvedStart = resolveRequestedDateYmd(startDate, timezoneIana);
    const resolvedEnd = resolveRequestedDateYmd(endDate, timezoneIana);
    assertNotFutureDateYmd(resolvedEnd, timezoneIana);
    if (resolvedStart > resolvedEnd) {
      throw new ValidationError(400, 'startDate must be on or before endDate');
    }
    const dayCount = inclusiveDayCount(resolvedStart, resolvedEnd);
    if (dayCount > MAX_WATCH_RANGE_DAYS) {
      throw new ValidationError(400, `Date range cannot exceed ${MAX_WATCH_RANGE_DAYS} days`);
    }
    const rows = await repo.fetchWatchCalorieRowsForRange(
      userId,
      resolvedStart,
      resolvedEnd,
      timezoneIana,
    );
    const byDate = groupWatchCaloriesByDate(rows, resolvedStart, resolvedEnd, timezoneIana);
    const caloriesBurned = Object.values(byDate).reduce((sum, n) => sum + (Number(n) || 0), 0);
    return {
      httpStatus: 200,
      body: {
        success: true,
        startDate: resolvedStart,
        endDate: resolvedEnd,
        byDate,
        caloriesBurned,
        totalCaloriesBurned: caloriesBurned,
      },
    };
  }

  const resolvedDate = resolveRequestedDateYmd(targetDate, timezoneIana);
  assertNotFutureDateYmd(resolvedDate, timezoneIana);
  const rows = await repo.fetchWatchCalorieRows(userId, resolvedDate, timezoneIana);
  const entries = rows.map((row) => {
    const kcal = parseWatchKcalFromTopic(row.Topic);
    return { id: row.Id, topic: row.Topic, kcal, createdAt: row.CreatedAt };
  });
  const maxKcal = maxWatchCaloriesFromRows(rows);
  return {
    httpStatus: 200,
    body: {
      success: true, date: resolvedDate,
      caloriesBurned: maxKcal,
      totalCaloriesBurned: maxKcal,
      entryCount: entries.length, entries,
    },
  };
}
