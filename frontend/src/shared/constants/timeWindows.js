/**
 * @file Time-window definitions used by reporting, discipline, and
 * attendance features. Times are expressed in minutes-since-midnight
 * in IST (Asia/Kolkata) unless otherwise noted.
 *
 * Placeholder values — overwrite with real product config when known.
 */

/**
 * @typedef {Object} TimeWindow
 * @property {string} id      Stable identifier.
 * @property {string} label   Human-readable label.
 * @property {number} startMin Minutes since midnight (inclusive).
 * @property {number} endMin   Minutes since midnight (exclusive).
 */

/** Convert HH:MM string to minutes-since-midnight. */
export function toMinutes(hhmm) {
  const [h, m] = String(hhmm).split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** @type {TimeWindow} */
export const WINDOW_MORNING = {
  id: 'morning',
  label: 'Morning',
  startMin: toMinutes('05:00'),
  endMin: toMinutes('11:00'),
};

/** @type {TimeWindow} */
export const WINDOW_AFTERNOON = {
  id: 'afternoon',
  label: 'Afternoon',
  startMin: toMinutes('11:00'),
  endMin: toMinutes('16:00'),
};

/** @type {TimeWindow} */
export const WINDOW_EVENING = {
  id: 'evening',
  label: 'Evening',
  startMin: toMinutes('16:00'),
  endMin: toMinutes('21:00'),
};

/** @type {TimeWindow} */
export const WINDOW_NIGHT = {
  id: 'night',
  label: 'Night',
  startMin: toMinutes('21:00'),
  endMin: toMinutes('29:00'), // wraps past midnight
};

/** @type {TimeWindow[]} */
export const ALL_TIME_WINDOWS = [
  WINDOW_MORNING,
  WINDOW_AFTERNOON,
  WINDOW_EVENING,
  WINDOW_NIGHT,
];

/** IANA timezone the app reports in. */
export const APP_TIMEZONE = 'Asia/Kolkata';

/** Day boundary in IST (minutes since midnight). */
export const DAY_START_MIN = 0;
export const DAY_END_MIN = 24 * 60;
