/**
 * completion-learning.rules.js — Pure rules for habit-based reminder learning.
 *
 * Per claude.md §3.1: no I/O, no DB, no network.
 */

import { isExemptedBeverageOnly } from '../../../utils/foodTypeDetection.js';

/** IST offset from UTC in milliseconds. */
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/**
 * Derive IST calendar date + clock time from an injected Date (for cron/tests).
 *
 * @param {Date} clock
 * @returns {{ date: string, time: string, timeHm: string }}
 */
export function getISTPartsFromDate(clock) {
  const ist = new Date(clock.getTime() + IST_OFFSET_MS);
  const iso = ist.toISOString();
  return {
    date:   iso.substring(0, 10),
    time:   iso.substring(11, 19),
    timeHm: iso.substring(11, 16),
  };
}

/**
 * Parse an IST timestamp string into date + time parts.
 *
 * @param {string} istTimestamp  e.g. '2026-06-15 08:05:00' or ISO with T
 * @returns {{ date: string, time: string }|null}
 */
export function extractIstParts(istTimestamp) {
  if (!istTimestamp || typeof istTimestamp !== 'string') return null;
  const normalized = istTimestamp.replace('T', ' ').trim();
  const date = normalized.substring(0, 10);
  const timeMatch = normalized.match(/(\d{2}:\d{2}:\d{2})/);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !timeMatch) return null;
  return { date, time: timeMatch[1] };
}

/**
 * Meal types resolved exclusively from activity_time_windows_table windows.
 * @type {readonly ['breakfast', 'lunch', 'dinner']}
 */
const MEAL_ACTIVITY_TYPES = ['breakfast', 'lunch', 'dinner'];

/** Task types that a food save may complete (meals + beverage-only water). */
const FOOD_SAVE_TASK_TYPES = ['water', ...MEAL_ACTIVITY_TYPES];

/**
 * Normalize an optional client hint (e.g. from "Upload Now" on a task card).
 *
 * @param {unknown} hint
 * @returns {'water'|'breakfast'|'lunch'|'dinner'|null}
 */
export function normalizeTaskTypeHint(hint) {
  if (!hint || typeof hint !== 'string') return null;
  const normalized = hint.toLowerCase().trim();
  return FOOD_SAVE_TASK_TYPES.includes(normalized) ? normalized : null;
}

/**
 * Normalize one activity_time_windows_table row (or task-repo alias) to { start, end }.
 * Accepts ActivityType/WindowStartTime/WindowEndTime or activity_type/start_time/end_time.
 *
 * @param {Object|null|undefined} row
 * @returns {{ start: string, end: string }|null}
 */
export function normalizeActivityWindow(row) {
  if (!row) return null;

  const rawStart = row.WindowStartTime ?? row.start_time ?? row.start;
  const rawEnd   = row.WindowEndTime   ?? row.end_time   ?? row.end;

  if (!rawStart || !rawEnd) return null;

  return {
    start: String(rawStart).substring(0, 8),
    end:   String(rawEnd).substring(0, 8),
  };
}

/**
 * Build a map keyed by ActivityType from activity_time_windows_table rows.
 *
 * @param {Array<Object>|Object|null} rowsOrMap
 * @returns {Object}
 */
export function buildActivityWindowsMap(rowsOrMap) {
  if (!rowsOrMap) return {};
  if (!Array.isArray(rowsOrMap)) return rowsOrMap;

  return Object.fromEntries(
    rowsOrMap
      .map((row) => {
        const activityType = row.ActivityType ?? row.activity_type;
        return activityType ? [activityType, row] : null;
      })
      .filter(Boolean),
  );
}

/**
 * Infer breakfast / lunch / dinner from IST wall-clock time using
 * activity_time_windows_table windows only (no hardcoded fallbacks).
 *
 * @param {string} timeHHMMSS
 * @param {Array<Object>|Object} timeWindows  table rows or map keyed by ActivityType
 * @returns {'breakfast'|'lunch'|'dinner'|null}
 */
export function inferMealTaskType(timeHHMMSS, timeWindows) {
  if (!timeHHMMSS || !timeWindows) return null;

  const windowMap = buildActivityWindowsMap(timeWindows);

  for (const mealType of MEAL_ACTIVITY_TYPES) {
    const bounds = normalizeActivityWindow(windowMap[mealType]);
    if (!bounds) continue;

    if (timeHHMMSS >= bounds.start && timeHHMMSS <= bounds.end) {
      return mealType;
    }
  }

  return null;
}

/**
 * Resolve which task type a food analysis save should contribute to.
 *
 * @param {{ istTimeOnly: string, analysisResult: unknown, timeWindows: Object }} args
 * @returns {'water'|'breakfast'|'lunch'|'dinner'|null}
 */
export function resolveFoodSaveTaskType({ istTimeOnly, analysisResult, timeWindows }) {
  const payload = typeof analysisResult === 'string'
    ? (() => { try { return JSON.parse(analysisResult); } catch { return null; } })()
    : analysisResult;

  if (isExemptedBeverageOnly(payload)) {
    return 'water';
  }

  return inferMealTaskType(istTimeOnly, timeWindows);
}

/**
 * Format a PG TIME value ('06:30:00') to '6:30 AM'.
 *
 * @param {string} avgRaw
 * @returns {string}
 */
export function formatAverageTimeLabel(avgRaw) {
  if (!avgRaw) return '';
  const [h, m] = String(avgRaw).split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const dh     = h % 12 || 12;
  return `${dh}:${String(m).padStart(2, '0')} ${period}`;
}

const REMINDER_TITLE_BY_TYPE = {
  weight:    'Weight Upload Pending',
  breakfast: 'Breakfast Log Pending',
  lunch:     'Lunch Log Pending',
  dinner:    'Dinner Log Pending',
  education: 'Education Log Pending',
  water:     'Water Intake Pending',
};

const FIRST_REMINDER_BODY_BY_TYPE = {
  weight:    (t) => `You usually upload your weight image around ${t}. You haven't uploaded today's weight image yet. Please upload it.`,
  breakfast: (t) => `You usually log breakfast around ${t}. You haven't logged today's breakfast yet. Please log it.`,
  lunch:     (t) => `You usually log lunch around ${t}. You haven't logged today's lunch yet. Please log it.`,
  dinner:    (t) => `You usually log dinner around ${t}. You haven't logged today's dinner yet. Please log it.`,
  education: (t) => `You usually complete your education activity around ${t}. You haven't logged today's education yet. Please log it.`,
  water:     (t) => `You usually reach your water goal around ${t}. You haven't met today's water intake yet. Please log your beverages.`,
};

const SECOND_REMINDER_BODY_BY_TYPE = {
  weight:    'Your weight image is still pending. Please upload it to keep your records updated.',
  breakfast: 'Your breakfast is still pending. Please log it to keep your records updated.',
  lunch:     'Your lunch is still pending. Please log it to keep your records updated.',
  dinner:    'Your dinner is still pending. Please log it to keep your records updated.',
  education: 'Your education activity is still pending. Please log it to keep your records updated.',
  water:     'Your water intake is still pending. Please log beverages to keep your records updated.',
};

/**
 * Notification title for reminder 1 (personalised).
 *
 * @param {string} taskType
 * @returns {string}
 */
export function getReminderTitle(taskType) {
  return REMINDER_TITLE_BY_TYPE[taskType] || 'Task Pending';
}

/**
 * Build the personalised FCM body for reminder 1.
 *
 * @param {string} taskType
 * @param {string} avgLabel  formatted e.g. '6:30 AM'
 * @returns {string}
 */
export function buildPersonalisedReminderBody(taskType, avgLabel) {
  const builder = FIRST_REMINDER_BODY_BY_TYPE[taskType];
  if (builder) return builder(avgLabel);
  return `You usually complete this around ${avgLabel}. It is still pending today — please complete it.`;
}

/**
 * Build the FCM body for reminder 2 (30 minutes after reminder 1).
 *
 * @param {string} taskType
 * @returns {string}
 */
export function buildSecondReminderBody(taskType) {
  return SECOND_REMINDER_BODY_BY_TYPE[taskType]
    || 'This task is still pending. Please complete it to keep your records updated.';
}

/**
 * Return true when current IST clock time matches the target HH:mm (minute precision).
 *
 * @param {string} currentTime  HH:mm:ss (IST)
 * @param {string} targetTime   HH:mm:ss or HH:mm
 * @returns {boolean}
 */
export function isAtReminderMinute(currentTime, targetTime) {
  if (!currentTime || !targetTime) return false;
  return currentTime.substring(0, 5) === String(targetTime).substring(0, 5);
}

/**
 * Add minutes to a PG TIME string and return HH:mm:ss.
 *
 * @param {string} timeStr  HH:mm:ss
 * @param {number} minutes
 * @returns {string}
 */
export function addMinutesToTime(timeStr, minutes) {
  const parts = String(timeStr).split(':').map(Number);
  const h = parts[0] || 0;
  const m = parts[1] || 0;
  const s = parts[2] || 0;
  let total = h * 3600 + m * 60 + s + minutes * 60;
  total = ((total % 86400) + 86400) % 86400;
  const hh = Math.floor(total / 3600);
  const mm = Math.floor((total % 3600) / 60);
  const ss = total % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}
