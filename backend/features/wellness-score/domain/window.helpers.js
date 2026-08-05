/**
 * Time-window helpers for wellness score (aligned with discipline 59s end buffer).
 *
 * Meal / activity on-time checks NEVER parse HH:mm:ss from raw CreatedAt strings.
 * Food timestamps go through {@link resolveFoodTimestamp}; other activities use
 * normalizeStoredTimestampToUtcIso (IST storage) + timeOfDayInTimezone (owner
 * display TZ) — both derive local time from the same UTC instant as day bucketing.
 */
import {
  IANA_IST,
  normalizeStoredTimestampToUtcIso,
  timeOfDayInTimezone,
} from '../../../shared/lib/datetime/index.js';
import { resolveFoodTimestamp } from '../../../shared/lib/datetime/foodTimestamp.js';

export const WINDOW_BUFFER_SECONDS = 59;

/** @typedef {'food'|'activity'} TimestampKind */

export function addBufferToTime(timeStr) {
  if (!timeStr) return timeStr;
  const [h, m, s] = String(timeStr).split(':').map(Number);
  const totalSecs = h * 3600 + m * 60 + (s || 0) + WINDOW_BUFFER_SECONDS;
  const nh = Math.floor(totalSecs / 3600) % 24;
  const nm = Math.floor((totalSecs % 3600) / 60);
  const ns = totalSecs % 60;
  return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}:${String(ns).padStart(2, '0')}`;
}

/**
 * Local HH:mm:ss for a stored CreatedAt in `timezoneIana`.
 *
 * @param {string|Date|null|undefined} createdAt
 * @param {string} [timezoneIana=IANA_IST]
 * @param {TimestampKind} [kind='activity']
 * @returns {string|null}
 */
export function resolveCreatedAtTimeOfDay(
  createdAt,
  timezoneIana = IANA_IST,
  kind = 'activity',
) {
  if (createdAt == null || createdAt === '') return null;
  try {
    if (kind === 'food') {
      return resolveFoodTimestamp(createdAt, timezoneIana).timeOfDay;
    }
    // Legacy weight/education CreatedAt is IST wall-clock; display in owner TZ.
    const utcIso = normalizeStoredTimestampToUtcIso(createdAt, IANA_IST);
    return timeOfDayInTimezone(utcIso, timezoneIana);
  } catch {
    return null;
  }
}

/**
 * @param {string|Date|null|undefined} createdAt
 * @param {{ start: string, end: string }|null} window
 * @param {string} [timezoneIana=IANA_IST]
 * @param {TimestampKind} [kind='activity']
 * @returns {'ON_TIME'|'LATE'|'MISSED'}
 */
export function resolveAttendanceStatus(
  createdAt,
  window,
  timezoneIana = IANA_IST,
  kind = 'activity',
) {
  if (!createdAt) return 'MISSED';
  if (!window?.start || !window?.end) return 'ON_TIME';
  const time = resolveCreatedAtTimeOfDay(createdAt, timezoneIana, kind);
  if (!time) return 'MISSED';
  if (time >= window.start && time <= addBufferToTime(window.end)) return 'ON_TIME';
  return 'LATE';
}

/**
 * @param {string|Date|null|undefined} createdAt
 * @param {{ start: string, end: string }|null} window
 * @param {string} [timezoneIana=IANA_IST]
 * @param {TimestampKind} [kind='activity']
 * @returns {'on-time'|'late'|'missed'}
 */
export function resolveSlotStatus(
  createdAt,
  window,
  timezoneIana = IANA_IST,
  kind = 'activity',
) {
  const s = resolveAttendanceStatus(createdAt, window, timezoneIana, kind);
  if (s === 'ON_TIME') return 'on-time';
  if (s === 'LATE') return 'late';
  return 'missed';
}

export function isOnTime(createdAt, window, timezoneIana = IANA_IST, kind = 'activity') {
  return resolveAttendanceStatus(createdAt, window, timezoneIana, kind) === 'ON_TIME';
}

export function isLate(createdAt, window, timezoneIana = IANA_IST, kind = 'activity') {
  return resolveAttendanceStatus(createdAt, window, timezoneIana, kind) === 'LATE';
}

/**
 * Non-beverage food logs whose canonical local time falls in a meal window.
 *
 * @param {object[]} foodRecords
 * @param {{ start: string, end: string }|null} mealWindow
 * @param {string} [timezoneIana=IANA_IST]
 * @returns {object[]}
 */
export function filterFoodByMealWindow(foodRecords, mealWindow, timezoneIana = IANA_IST) {
  if (!mealWindow?.start || !mealWindow?.end) return [];
  const endWithBuffer = addBufferToTime(mealWindow.end);
  return (foodRecords || []).filter((record) => {
    const time = resolveCreatedAtTimeOfDay(record.CreatedAt, timezoneIana, 'food');
    if (!time) return false;
    return time >= mealWindow.start && time <= endWithBuffer;
  });
}
