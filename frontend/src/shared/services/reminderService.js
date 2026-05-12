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
  }),
});

// ── Constants ───────────────────────────────────────────────────────────────
const STORAGE_KEY       = 'wellnessReminders';
const REMINDER_OFFSET   = 15; // minutes before activity start

const ACTIVITY_TYPES = ['weight', 'education', 'breakfast', 'lunch', 'dinner'];

const ACTIVITY_LABELS = {
  weight:    'Weight',
  education: 'Education',
  breakfast: 'Breakfast',
  lunch:     'Lunch',
  dinner:    'Dinner',
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

  return merged;
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

// ── Native scheduling ─────────────────────────────────────────────────────────

const isNative = () => Capacitor.isNativePlatform();

/**
 * Apply the given preferences to the native AlarmManager.
 * Uses scheduleAll() so preferences are also persisted to SharedPreferences
 * for automatic re-scheduling after device reboot.
 */
export async function applyRemindersToNative(prefs) {
  if (!isNative()) {
    console.log('[ReminderService] Not on native platform — skipping alarm scheduling');
    return;
  }

  // Build the reminders array for the native plugin
  const reminders = ACTIVITY_TYPES.map((type) => {
    const activity = prefs.activities[type] || {};
    return {
      activityType: type,
      label:        ACTIVITY_LABELS[type],
      hour:         activity.hour   ?? 7,
      minute:       activity.minute ?? 0,
      enabled:      activity.enabled ?? false,
    };
  });

  // scheduleAll handles master toggle + persists to SharedPreferences for boot recovery
  await ReminderPluginNative.scheduleAll({
    masterEnabled: prefs.masterEnabled,
    reminders,
  });

  console.log('[ReminderService] scheduleAll called — masterEnabled:', prefs.masterEnabled,
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
export async function initReminders() {
  try {
    const windowMap   = await fetchTimeWindows();
    const savedPrefs  = loadReminderPreferences();

    let prefs;
    if (!savedPrefs) {
      prefs = buildDefaultPreferences(windowMap);
    } else {
      prefs = mergePreferencesWithWindows(savedPrefs, windowMap);
    }

    saveReminderPreferences(prefs);
    await applyRemindersToNative(prefs);

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
export async function updateReminders(newPrefs) {
  saveReminderPreferences(newPrefs);
  await applyRemindersToNative(newPrefs);
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

// ── Exports ────────────────────────────────────────────────────────────────────

export {
  ACTIVITY_TYPES,
  ACTIVITY_LABELS,
  REMINDER_OFFSET,
  ReminderPluginNative,
  subtractMinutes,
  parseTimeString,
};
