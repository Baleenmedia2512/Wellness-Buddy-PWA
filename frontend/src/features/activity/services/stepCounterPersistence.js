/**
 * stepCounterPersistence.js — wraps the existing dailyActivityService /
 * activity API in a step-counter-shaped contract.
 *
 * Hooks call these instead of touching `saveDailyActivity` directly so the
 * payload shape (activityType, forceWrite, side-effect anchor writes) lives
 * in exactly one place.
 */
import { fetchDailyActivity, saveDailyActivity } from './dailyActivityService';
import { ACTIVITY_TYPE } from './stepCounterConstants';
import { calcCalories, toDateKey } from './stepCounterCalculations';
import { writeSaveAnchors, writeLastSavedTime } from './stepCounterStorage';

/**
 * Persist today's step total to the DB.
 * Always uses forceWrite:false so the backend Math.max guard prevents
 * historic days from ever decreasing.
 */
export const saveStepsForDate = async ({
  userId, dateKey, steps, sensorTotal,
}) => {
  await saveDailyActivity({
    userId,
    activityDate:   dateKey,
    steps,
    activityType:   ACTIVITY_TYPE,
    caloriesBurned: calcCalories(steps),
    forceWrite:     false,
  });
  writeSaveAnchors(dateKey, sensorTotal, steps);
};

/** Fetch today's row for `userId`. Returns the matching trend entry or null. */
export const fetchTodayEntry = async (userId) => {
  const todayKey = toDateKey();
  const response = await fetchDailyActivity(userId, 1, ACTIVITY_TYPE, todayKey);
  const trend    = response?.trend || response?.data || [];
  return trend.find((d) => d.date === todayKey) || null;
};

/**
 * Fetch up to N days of step history for `userId`.
 * Maps `caloriesBurned → calories` so the UI can read either field uniformly.
 */
export const fetchHistory = async (userId, days = 30) => {
  const response = await fetchDailyActivity(userId, days, ACTIVITY_TYPE, toDateKey());
  const trend    = response?.trend || response?.data || [];
  if (!response?.success || !Array.isArray(trend)) return [];
  return trend.map((d) => ({ ...d, calories: d.caloriesBurned ?? d.calories ?? 0 }));
};

/** Update the user-visible "Saved at" label from the most recent DB entry. */
export const syncLastSavedFromEntry = (entry, setLastSaved) => {
  const ts = entry?.savedAt || entry?.updatedAt || entry?.createdAt || null;
  if (!ts) return;
  const dt = new Date(ts);
  if (Number.isNaN(dt.getTime())) return;
  writeLastSavedTime(dt);
  setLastSaved(dt);
};
