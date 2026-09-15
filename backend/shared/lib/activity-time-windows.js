/**
 * Platform-wide activity time windows (discipline + wellness score).
 * Stored in `activity_time_windows_table`; these defaults apply only when
 * no active row exists for an activity (or the DB read fails).
 */

export const ACTIVITY_TIME_WINDOW_TYPES = Object.freeze([
  'weight',
  'education',
  'breakfast',
  'lunch',
  'dinner',
]);

/** HH:MM:SS defaults used when no custom configuration has been saved. */
export const DEFAULT_ACTIVITY_TIME_WINDOWS = Object.freeze({
  weight: Object.freeze({ start: '06:00:00', end: '09:00:00' }),
  education: Object.freeze({ start: '09:00:00', end: '12:00:00' }),
  breakfast: Object.freeze({ start: '07:00:00', end: '10:00:00' }),
  lunch: Object.freeze({ start: '12:00:00', end: '15:00:00' }),
  dinner: Object.freeze({ start: '19:00:00', end: '22:00:00' }),
});

/**
 * @param {Record<string, { start?: string, end?: string }>|null|undefined} windowMap
 * @returns {Record<string, { start: string, end: string }>}
 */
export function mergeActivityTimeWindowsWithDefaults(windowMap = {}) {
  const merged = {};
  for (const type of ACTIVITY_TIME_WINDOW_TYPES) {
    const fromDb = windowMap?.[type];
    const fallback = DEFAULT_ACTIVITY_TIME_WINDOWS[type];
    merged[type] = {
      start: fromDb?.start || fallback.start,
      end: fromDb?.end || fallback.end,
    };
  }
  return merged;
}
