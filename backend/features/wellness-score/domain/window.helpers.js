/**
 * Time-window helpers for wellness score (aligned with discipline 59s end buffer).
 */

export const WINDOW_BUFFER_SECONDS = 59;

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
 * @param {string} createdAt IST timestamp
 * @param {{ start: string, end: string }|null} window
 * @returns {'ON_TIME'|'LATE'|'MISSED'}
 */
export function resolveAttendanceStatus(createdAt, window) {
  if (!createdAt) return 'MISSED';
  if (!window?.start || !window?.end) return 'ON_TIME';
  const match = String(createdAt).match(/(\d{2}:\d{2}:\d{2})/);
  if (!match) return 'MISSED';
  const time = match[1];
  if (time >= window.start && time <= addBufferToTime(window.end)) return 'ON_TIME';
  return 'LATE';
}

/**
 * @param {string} createdAt
 * @param {{ start: string, end: string }|null} window
 * @returns {'on-time'|'late'|'missed'}
 */
export function resolveSlotStatus(createdAt, window) {
  const s = resolveAttendanceStatus(createdAt, window);
  if (s === 'ON_TIME') return 'on-time';
  if (s === 'LATE') return 'late';
  return 'missed';
}

export function isOnTime(createdAt, window) {
  return resolveAttendanceStatus(createdAt, window) === 'ON_TIME';
}

export function isLate(createdAt, window) {
  return resolveAttendanceStatus(createdAt, window) === 'LATE';
}

/**
 * Non-beverage food logs whose timestamp falls in a meal window (with end buffer).
 */
export function filterFoodByMealWindow(foodRecords, mealWindow) {
  if (!mealWindow?.start || !mealWindow?.end) return [];
  return (foodRecords || []).filter((record) => {
    const match = String(record.CreatedAt || '').match(/(\d{2}:\d{2}:\d{2})/);
    if (!match) return false;
    const time = match[1];
    return time >= mealWindow.start && time <= addBufferToTime(mealWindow.end);
  });
}
