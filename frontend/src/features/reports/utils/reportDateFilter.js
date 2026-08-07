/**
 * Date preset helpers for Wellness Score Report (IST business calendar).
 */
import {
  todayBusinessDate,
  dateToBusinessYmd,
  DEFAULT_BUSINESS_TIMEZONE,
} from '../../../shared/utils/datetimeUtils.js';

export const DATE_PRESETS = Object.freeze({
  TODAY: 'today',
  YESTERDAY: 'yesterday',
  CUSTOM: 'custom',
});

/**
 * @param {string} [timezoneIana]
 * @param {Date} [now]
 * @returns {string} YYYY-MM-DD
 */
export function yesterdayBusinessDate(
  timezoneIana = DEFAULT_BUSINESS_TIMEZONE,
  now = new Date(),
) {
  const today = todayBusinessDate(timezoneIana, now);
  const [y, m, d] = today.split('-').map(Number);
  const yesterdayAnchor = new Date(Date.UTC(y, m - 1, d - 1, 12));
  return todayBusinessDate(timezoneIana, yesterdayAnchor);
}

/**
 * Resolve API `date` (YYYY-MM-DD) from preset + optional custom date.
 *
 * @param {'today'|'yesterday'|'custom'} preset
 * @param {Date|string|null|undefined} customDate
 * @param {string} [timezoneIana]
 * @returns {string}
 */
export function resolveReportScoreDate(
  preset,
  customDate,
  timezoneIana = DEFAULT_BUSINESS_TIMEZONE,
) {
  if (preset === DATE_PRESETS.YESTERDAY) {
    return yesterdayBusinessDate(timezoneIana);
  }
  if (preset === DATE_PRESETS.CUSTOM) {
    const ymd = dateToBusinessYmd(customDate, timezoneIana);
    if (ymd) return ymd;
  }
  return todayBusinessDate(timezoneIana);
}

/**
 * @param {string} ymd YYYY-MM-DD
 * @returns {string} e.g. Aug 7
 */
export function formatReportDateLabel(ymd) {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return '';
  const [y, m, d] = ymd.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d, 12));
  return date.toLocaleDateString('en-US', {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
  });
}
