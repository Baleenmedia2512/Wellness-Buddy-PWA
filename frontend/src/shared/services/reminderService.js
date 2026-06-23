/**
 * reminderService.js
 *
 * Wellness Valley — Daily Activity Reminder Service
 *
 * Responsibilities:
 *  1. Read activity time windows from the backend API
 *  2. Compute reminder time = WindowStartTime − 15 minutes
 *  3. Load/save per-user reminder preferences from localStorage
 *  4. Bridge to the native ReminderPlugin (Android AlarmManager) or
 *     fall back gracefully on web/iOS
 *
 * localStorage key: "wellnessReminders"
 * Shape: {
 *   masterEnabled: boolean,
 *   activities: {
 *     weight:    { enabled: boolean, hour: number, minute: number },
 *     education: { enabled: boolean, hour: number, minute: number },
 *     breakfast: { enabled: boolean, hour: number, minute: number },
 *     lunch:     { enabled: boolean, hour: number, minute: number },
 *     dinner:    { enabled: boolean, hour: number, minute: number },
 *   }
 * }
 */

import { registerPlugin, Capacitor } from '@capacitor/core';
import axios from 'axios';
import { debugLog } from '../utils/logger.js';

// ── Native plugin bridge ────────────────────────────────────────────────────
const ReminderPluginNative = registerPlugin('ReminderPlugin', {
  // Web fallback (no-ops so the app doesn't crash in browser)
  web: () => ({
    scheduleReminder:       async () => ({ success: false, reason: 'not-native' }),
    cancelReminder:         async () => ({ success: false }),
    cancelAllReminders:     async () => ({ success: false }),
    scheduleAll:            async () => ({ success: false, scheduledCount: 0 }),
    canScheduleExactAlarms: async () => ({ canScheduleExact: false }),
    openExactAlarmSettings: async () => ({ success: false }),
    updateWaterIntake:      async () => ({ success: false }),
    scheduleSnooze:         async () => ({ success: false, reason: 'not-native' }),
    cancelSnooze:           async () => ({ success: false }),
  }),
});

// ── Platform helper ─────────────────────────────────────────────────────────
const isNative = () => Capacitor.isNativePlatform();

// ── Constants ───────────────────────────────────────────────────────────────
const STORAGE_KEY         = 'wellnessReminders';
const REMINDER_OFFSET     = 15;  // minutes before activity start
const WATER_INTERVAL_MIN  = 180; // water reminder every 3 hours
const WATER_MAX_REMINDERS = 12;  // hard cap — request codes 3001–3012
const WATER_DEFAULT_WAKE  = { hour: 8,  minute: 30 }; // 8:30 AM
const WATER_DEFAULT_SLEEP = { hour: 21, minute: 0  }; // 9:00 PM

const ACTIVITY_TYPES = ['weight', 'education', 'breakfast', 'lunch', 'dinner'];

const ACTIVITY_LABELS = {
  weight:    'Weight',
  education: 'Education',
  breakfast: 'Breakfast',
  lunch:     'Lunch',
  dinner:    'Dinner',
  water:     'Water',
  sleep:     'Sleep',
};

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Parse "HH:MM:SS" or "HH:MM" into { hour, minute }.
 */
function parseTimeString(timeStr) {
  if (!timeStr) return null;
  const parts = timeStr.split(':');
  if (parts.length < 2) return null;
  const hour   = parseInt(parts[0], 10);
  const minute = parseInt(parts[1], 10);
  if (isNaN(hour) || isNaN(minute)) return null;
  return { hour, minute };
}

/**
 * Subtract `offsetMinutes` from { hour, minute } and return new { hour, minute }.
 * Handles midnight wrap-around.
 */
function subtractMinutes(hour, minute, offsetMinutes) {
  let totalMinutes = hour * 60 + minute - offsetMinutes;
  if (totalMinutes < 0) totalMinutes += 24 * 60; // wrap around midnight
  return {
    hour:   Math.floor(totalMinutes / 60) % 24,
    minute: totalMinutes % 60,
  };
}

/**
 * Format { hour, minute } → "2:45 AM"
 */
export function formatReminderTime(hour, minute) {
  const period       = hour >= 12 ? 'PM' : 'AM';
  const displayHour  = hour % 12 || 12;
  return `${displayHour}:${String(minute).padStart(2, '0')} ${period}`;
}

/**
 * Compute water reminder times.
 *
 * When `weightKg` is supplied the number of reminders is weight-based:
 *   goalMl   = round(weightKg / 20) * 1000   (e.g. 60 kg → 3 000 ml)
 *   count    = round(goalMl / 1000)            (e.g. 3 000 ml → 3 reminders)
 *   spacing  = WATER_INTERVAL_MIN (3 h) from wake time
 *
 * Without `weightKg` falls back to interval-based fill from wake → sleep
 * (backward-compatible with existing saved prefs that have no weight).
 *
 * Returns array of { hour, minute } — capped at WATER_MAX_REMINDERS.
 *
 * @param {number} wakeH    wake hour   (0–23)
 * @param {number} wakeM    wake minute (0–59)
 * @param {number} sleepH   sleep hour  (0–23)
 * @param {number} sleepM   sleep minute(0–59)
 * @param {number|null} weightKg  body weight in kg (optional)
 * @returns {{ hour: number, minute: number }[]}
 */
export function computeWaterReminderTimes(wakeH, wakeM, sleepH, sleepM, weightKg = null) {
  const wakeTotal  = wakeH  * 60 + wakeM;
  let   sleepTotal = sleepH * 60 + sleepM;
  // Handle overnight: if sleep is before (or equal to) wake, add 24h
  if (sleepTotal <= wakeTotal) sleepTotal += 24 * 60;

  const times = [];

  if (weightKg != null && weightKg > 0) {
    // Weight-based: fixed count, evenly spaced every WATER_INTERVAL_MIN
    const goalMl = Math.round(weightKg / 20) * 1000;
    const count  = Math.min(Math.round(goalMl / 1000), WATER_MAX_REMINDERS);
    let cursor   = wakeTotal;
    for (let i = 0; i < count; i++) {
      if (cursor >= sleepTotal) break; // don't fire after bedtime
      const h = Math.floor(cursor / 60) % 24;
      const m = cursor % 60;
      times.push({ hour: h, minute: m });
      cursor += WATER_INTERVAL_MIN;
    }
  } else {
    // Interval-based fill (legacy / no weight data)
    let cursor = wakeTotal;
    while (cursor < sleepTotal && times.length < WATER_MAX_REMINDERS) {
      const h = Math.floor(cursor / 60) % 24;
      const m = cursor % 60;
      times.push({ hour: h, minute: m });
      cursor += WATER_INTERVAL_MIN;
    }
  }

  return times;
}

/**
 * Compute the sleep reminder time: sleepTime − REMINDER_OFFSET minutes.
 *
 * @param {number} sleepH
 * @param {number} sleepM
 * @returns {{ hour: number, minute: number }}
 */
export function computeSleepReminderTime(sleepH, sleepM) {
  return subtractMinutes(sleepH, sleepM, REMINDER_OFFSET);
}

// ── Storage ──────────────────────────────────────────────────────────────────

/**
 * Load reminder preferences from localStorage.
 * Returns null if nothing saved yet.
 */
export function loadReminderPreferences() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Save reminder preferences to localStorage.
 */
export function saveReminderPreferences(prefs) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch (e) {
    console.error('[ReminderService] Failed to save preferences:', e);
  }
}

// ── Default preferences from time windows ────────────────────────────────────

/**
 * Build default reminder preferences from the backend time windows.
 * Default reminder = WindowStartTime − 15 min, all enabled.
 *
 * @param {Object} timeWindowMap  e.g. { weight: { start: '03:00:00', end: '06:30:00' }, ... }
 * @returns {Object} preferences object
 */
export function buildDefaultPreferences(timeWindowMap) {
  const activities = {};

  for (const type of ACTIVITY_TYPES) {
    const window = timeWindowMap[type];
    if (window && window.end) {
      const parsed = parseTimeString(window.end);
      if (parsed) {
        const reminder = subtractMinutes(parsed.hour, parsed.minute, REMINDER_OFFSET);
        activities[type] = {
          enabled:      true,
          hour:         reminder.hour,
          minute:       reminder.minute,
          // Store the original window end so the UI can show "15 min before X"
          windowStart:  window.start,
          windowEnd:    window.end,
        };
        continue;
      }
    }
    // Fallback if window not found
    activities[type] = {
      enabled:     false,
      hour:        7,
      minute:      0,
      windowStart: null,
      windowEnd:   null,
    };
  }

  return {
    masterEnabled: true,
    activities,
    water: {
      enabled:      true,
      wakeHour:     WATER_DEFAULT_WAKE.hour,
      wakeMinute:   WATER_DEFAULT_WAKE.minute,
      sleepHour:    WATER_DEFAULT_SLEEP.hour,
      sleepMinute:  WATER_DEFAULT_SLEEP.minute,
    },
    sleep: {
      enabled: true,
      ...computeSleepReminderTime(WATER_DEFAULT_SLEEP.hour, WATER_DEFAULT_SLEEP.minute),
      bedHour:    WATER_DEFAULT_SLEEP.hour,
      bedMinute:  WATER_DEFAULT_SLEEP.minute,
    },
  };
}

/**
 * Merge saved preferences with fresh time-window data.
 * - Preserves user's enabled/time customisations
 * - Updates windowStart/windowEnd from the latest API data
 */
export function mergePreferencesWithWindows(savedPrefs, timeWindowMap) {
  const merged = { ...savedPrefs };

  for (const type of ACTIVITY_TYPES) {
    const window = timeWindowMap[type];
    if (window && window.end) {
      if (merged.activities[type]) {
        // Update window info but keep user's custom time & enabled state
        merged.activities[type] = {
          ...merged.activities[type],
          windowStart: window.start,
          windowEnd:   window.end,
        };
      } else {
        // Activity not in saved prefs — add it with default reminder time
        const parsed   = parseTimeString(window.end);
        const reminder = parsed
          ? subtractMinutes(parsed.hour, parsed.minute, REMINDER_OFFSET)
          : { hour: 7, minute: 0 };
        merged.activities[type] = {
          enabled:     true,
          hour:        reminder.hour,
          minute:      reminder.minute,
          windowStart: window.start,
          windowEnd:   window.end,
        };
      }
    }
  }

  return ensureWaterSleepDefaults(merged);
}

/**
 * Ensure saved prefs contain water + sleep keys (added in a later version).
 * If missing, fill with defaults so existing users get the new reminders.
 */
function ensureWaterSleepDefaults(prefs) {
  const out = { ...prefs };
  if (!out.water) {
    out.water = {
      enabled:     true,
      wakeHour:    WATER_DEFAULT_WAKE.hour,
      wakeMinute:  WATER_DEFAULT_WAKE.minute,
      sleepHour:   WATER_DEFAULT_SLEEP.hour,
      sleepMinute: WATER_DEFAULT_SLEEP.minute,
    };
  }
  if (!out.sleep) {
    out.sleep = {
      enabled:   true,
      bedHour:   WATER_DEFAULT_SLEEP.hour,
      bedMinute: WATER_DEFAULT_SLEEP.minute,
      ...computeSleepReminderTime(WATER_DEFAULT_SLEEP.hour, WATER_DEFAULT_SLEEP.minute),
    };
  }
  return out;
}

// ── Backend API ───────────────────────────────────────────────────────────────

/**
 * Fetch activity time windows from the backend.
 * Returns a normalised map:  { weight: { start, end }, education: { start, end }, ... }
 */
export async function fetchTimeWindows() {

  const apiBase = process.env.REACT_APP_API_BASE_URL;
  try {
    const response = await axios.get(`${apiBase}/api/admin/time-windows`);
    const windowMap = {};
    if (response.data?.timeWindows) {
      response.data.timeWindows.forEach((tw) => {
        windowMap[tw.ActivityType] = {
          start: tw.WindowStartTime,
          end:   tw.WindowEndTime,
        };
      });
    }
    return windowMap;
  } catch (err) {
    console.error('[ReminderService] Failed to fetch time windows:', err);
    // Return null windows — callers must handle unavailability; no hardcoded fallbacks
    return {
      weight:    null,
      education: null,
      breakfast: null,
      lunch:     null,
      dinner:    null,
    };
  }
}

// ── Personalised alarm helpers ────────────────────────────────────────────────

/**
 * Fetch the user's learned average completion times from the backend.
 *
 * Returns a plain map: { weight: '04:30:00', breakfast: '08:10:00', ... }
 * Returns {} on any error — callers fall back to fixed window-offset times.
 *
 * @param {string|number|null} userId
 * @returns {Promise<Object>}
 */
export async function fetchUserAverages(userId) {
  if (!userId) return {};
  const apiBase = process.env.REACT_APP_API_BASE_URL;
  try {
    const response = await axios.get(`${apiBase}/api/tasks/averages`, {
      params: { userId },
    });
    if (!response.data?.ok) return {};
    const map = {};
    (response.data.data?.averages || []).forEach(({ task_type, average_completion_time }) => {
      if (task_type && average_completion_time) {
        map[task_type] = String(average_completion_time);
      }
    });
    debugLog('[ReminderService] fetchUserAverages:', map);
    return map;
  } catch (err) {
    // Non-critical — native alarm falls back to fixed window offset
    debugLog('[ReminderService] fetchUserAverages failed (non-critical):', err.message);
    return {};
  }
}

/**
 * Parse a Postgres TIME string "HH:MM:SS" into { hour, minute }.
 * Returns null if unparseable.
 */
function parsePgTime(timeStr) {
  if (!timeStr) return null;
  const parts = String(timeStr).split(':');
  if (parts.length < 2) return null;
  const hour   = parseInt(parts[0], 10);
  const minute = parseInt(parts[1], 10);
  if (isNaN(hour) || isNaN(minute)) return null;
  return { hour, minute };
}

/**
 * Return the native alarm trigger time for a task type.
 *
 * If a learned average exists → fire at average + 1 min.
 * Otherwise       → fall back to the user's saved preference time.
 *
 * @param {string} taskType
 * @param {Object} averagesMap   { weight: '04:30:00', breakfast: '08:10:00', ... }
 * @param {number} fallbackHour
 * @param {number} fallbackMinute
 * @returns {{ hour: number, minute: number }}
 */
function computePersonalizedAlarmTime(taskType, averagesMap, fallbackHour, fallbackMinute) {
  const avgTimeStr = averagesMap[taskType];
  if (!avgTimeStr) return { hour: fallbackHour, minute: fallbackMinute };
  const parsed = parsePgTime(avgTimeStr);
  if (!parsed) return { hour: fallbackHour, minute: fallbackMinute };
  // Fire 1 minute after average so task is likely still pending
  const totalMin = parsed.hour * 60 + parsed.minute + 1;
  return { hour: Math.floor(totalMin / 60) % 24, minute: totalMin % 60 };
}

/**
 * Build the personalised notification body for a native alarm.
 * Mirrors buildPersonalisedReminderBody() from completion-learning.rules.js (backend).
 */
function buildPersonalizedNativeBody(taskType, avgLabel) {
  const bodies = {
    weight:    (t) => `You usually upload your weight around ${t}. Today's weight is still pending.`,
    breakfast: (t) => `You usually log breakfast around ${t}. Today's breakfast is still pending.`,
    lunch:     (t) => `You usually log lunch around ${t}. Today's lunch is still pending.`,
    dinner:    (t) => `You usually log dinner around ${t}. Today's dinner is still pending.`,
    education: (t) => `You usually complete education around ${t}. It's still pending today.`,
    water:     (t) => `You usually log water around ${t}. Today's water intake is still pending.`,
  };
  const builder = bodies[taskType];
  return builder ? builder(avgLabel) : `You usually complete this around ${avgLabel}.`;
}

// ── Native scheduling ─────────────────────────────────────────────────────────

/**
 * Apply the given preferences to the native AlarmManager.
 * Uses scheduleAll() so preferences are also persisted to SharedPreferences
 * for automatic re-scheduling after device reboot.
 */
export async function applyRemindersToNative(prefsRaw, averagesMap = {}) {
  if (!isNative()) {
    debugLog('[ReminderService] Not on native platform — skipping alarm scheduling');
    return;
  }

  const prefs = ensureWaterSleepDefaults(prefsRaw);

  // ── 1. Standard activity reminders (weight / education / meals) ──────
  const reminders = ACTIVITY_TYPES.map((type) => {
    const activity  = prefs.activities[type] || {};
    const fallbackH = activity.hour   ?? 7;
    const fallbackM = activity.minute ?? 0;

    // Use the user's personal average + 1 min if we have history; else fixed offset
    const alarmTime = computePersonalizedAlarmTime(type, averagesMap, fallbackH, fallbackM);

    // Build personalised body only when a learned average exists
    const avgStr = averagesMap[type];
    let personalizedBody = undefined;
    if (avgStr) {
      const avg = parsePgTime(avgStr);
      if (avg) {
        const avgLabel = formatReminderTime(avg.hour, avg.minute);
        personalizedBody = buildPersonalizedNativeBody(type, avgLabel);
      }
    }

    return {
      activityType: type,
      label:        ACTIVITY_LABELS[type],
      hour:         alarmTime.hour,
      minute:       alarmTime.minute,
      enabled:      activity.enabled ?? false,
      ...(personalizedBody !== undefined && { personalizedBody }),
    };
  });

  // ── 2. Water reminders — expand into individual slots ─────────────────
  const { water } = prefs;
  if (water) {
    const times = computeWaterReminderTimes(
      water.wakeHour, water.wakeMinute,
      water.sleepHour, water.sleepMinute,
    );
    times.forEach((t, i) => {
      reminders.push({
        activityType: `water_${i + 1}`,
        label:        'Drink Water 💧',
        hour:         t.hour,
        minute:       t.minute,
        enabled:      water.enabled ?? true,
      });
    });
    // Cancel any slots beyond what we just scheduled (e.g. user narrowed window)
    for (let i = times.length + 1; i <= WATER_MAX_REMINDERS; i++) {
      reminders.push({
        activityType: `water_${i}`,
        label:        'Drink Water 💧',
        hour:         6,
        minute:       0,
        enabled:      false, // forces cancel in scheduleAll
      });
    }
  }

  // ── 3. Sleep reminder ─────────────────────────────────────────────────
  const { sleep } = prefs;
  if (sleep) {
    const t = computeSleepReminderTime(sleep.bedHour ?? 22, sleep.bedMinute ?? 0);
    reminders.push({
      activityType: 'sleep',
      label:        'Bedtime Soon 🌙',
      hour:         t.hour,
      minute:       t.minute,
      enabled:      sleep.enabled ?? true,
    });
  }

  // scheduleAll handles master toggle + persists to SharedPreferences for boot recovery
  await ReminderPluginNative.scheduleAll({
    masterEnabled: prefs.masterEnabled,
    reminders,
  });

  debugLog('[ReminderService] scheduleAll called — masterEnabled:', prefs.masterEnabled,
    'enabled activities:', reminders.filter((r) => r.enabled).map((r) => r.activityType));
}

/**
 * Check whether the OS grants permission to schedule exact alarms.
 * Always true on Android < 12 and on web.
 */
export async function checkExactAlarmPermission() {
  if (!isNative()) return { canScheduleExact: true };
  try {
    return await ReminderPluginNative.canScheduleExactAlarms();
  } catch {
    return { canScheduleExact: false };
  }
}

/**
 * Open Android system settings for exact-alarm permission.
 */
export async function openExactAlarmSettings() {
  if (!isNative()) return;
  try {
    await ReminderPluginNative.openExactAlarmSettings();
  } catch (e) {
    console.error('[ReminderService] Failed to open exact alarm settings:', e);
  }
}

/**
 * Push today's water intake totals to the native SharedPreferences cache.
 * Water alarm notifications will read this cache at fire-time to display
 * a smart remaining-balance message even without network access.
 *
 * Safe to call on web — silently no-ops.
 *
 * @param {number} drunkMl   Total ml consumed so far today
 * @param {number} goalMl    Daily water goal in ml
 */
export async function updateWaterIntakeCache(drunkMl, goalMl) {
  if (!isNative()) return;
  try {
    await ReminderPluginNative.updateWaterIntake({
      drunkMl: Math.round(drunkMl || 0),
      goalMl:  Math.round(goalMl  || 2500),
    });
    debugLog('[ReminderService] updateWaterIntakeCache:', drunkMl, '/', goalMl, 'ml');
  } catch (e) {
    // Non-critical — notifications will fall back to the generic message
    debugLog('[ReminderService] updateWaterIntakeCache failed (non-critical):', e.message);
  }
}

// ── High-level public API ──────────────────────────────────────────────────────

/**
 * Initialise reminders on app start.
 *
 * Flow:
 *  1. Fetch latest time windows from backend
 *  2. Load saved preferences (if any)
 *  3. If no saved prefs → build defaults from time windows
 *  4. Merge saved prefs with latest windows (preserves user customisations)
 *  5. Save merged prefs
 *  6. Apply to native AlarmManager
 *
 * @returns {Object} the current preferences
 */
export async function initReminders(userId = null) {
  try {
    const [windowMap, averagesMap] = await Promise.all([
      fetchTimeWindows(),
      fetchUserAverages(userId),
    ]);

    const savedPrefs = loadReminderPreferences();

    let prefs;
    if (!savedPrefs) {
      prefs = buildDefaultPreferences(windowMap);
    } else {
      prefs = mergePreferencesWithWindows(savedPrefs, windowMap);
    }

    saveReminderPreferences(prefs);
    await applyRemindersToNative(prefs, averagesMap);

    return prefs;
  } catch (err) {
    console.error('[ReminderService] initReminders error:', err);
    return null;
  }
}

/**
 * Update preferences and immediately apply them to the native scheduler.
 *
 * @param {Object} newPrefs  The full updated preferences object
 */
export async function updateReminders(newPrefs, userId = null) {
  saveReminderPreferences(newPrefs);
  const averagesMap = await fetchUserAverages(userId);
  await applyRemindersToNative(newPrefs, averagesMap);
}

/**
 * Reset all reminders to defaults derived from the latest time windows.
 * Fetches fresh data from the backend.
 *
 * @returns {Object} the reset preferences
 */
export async function resetRemindersToDefaults() {
  const windowMap = await fetchTimeWindows();
  const prefs     = buildDefaultPreferences(windowMap);
  saveReminderPreferences(prefs);
  await applyRemindersToNative(prefs);
  return prefs;
}

// ── Snooze helpers (native local notification bridge) ──────────────────────────

/**
 * Schedule a one-shot native local notification at the snooze expiry time.
 * Works on Android (AlarmManager) and iOS (UNTimeIntervalNotificationTrigger).
 * Safe to call on web — silently no-ops.
 *
 * @param {number} taskId        - Task ID (used to uniquely identify the alarm).
 * @param {string} taskType      - e.g. 'weight', 'breakfast'.
 * @param {string} label         - Human-readable label for the notification title.
 * @param {number} snoozeMinutes - Must be 15, 30, or 60.
 */
export async function scheduleSnooze(taskId, taskType, label, snoozeMinutes) {
  if (!isNative()) return;
  try {
    await ReminderPluginNative.scheduleSnooze({ taskId, taskType, label, snoozeMinutes });
    debugLog('[ReminderService] scheduleSnooze', { taskId, taskType, snoozeMinutes });
  } catch (e) {
    // Non-critical — FCM server-side push is the fallback
    debugLog('[ReminderService] scheduleSnooze failed (non-critical):', e.message);
  }
}

/**
 * Cancel a previously scheduled native snooze notification.
 * Safe to call on web — silently no-ops.
 *
 * @param {number} taskId - Task ID passed to scheduleSnooze().
 */
export async function cancelSnooze(taskId) {
  if (!isNative()) return;
  try {
    await ReminderPluginNative.cancelSnooze({ taskId });
    debugLog('[ReminderService] cancelSnooze', { taskId });
  } catch (e) {
    debugLog('[ReminderService] cancelSnooze failed (non-critical):', e.message);
  }
}

// ── Exports ────────────────────────────────────────────────────────────────────

export {
  ACTIVITY_TYPES,
  ACTIVITY_LABELS,
  REMINDER_OFFSET,
  WATER_INTERVAL_MIN,
  WATER_MAX_REMINDERS,
  ReminderPluginNative,
  subtractMinutes,
  parseTimeString,
};
