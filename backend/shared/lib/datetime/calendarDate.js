/**
 * Calendar-date helpers for API validation and relative ranges.
 * UTC bounds are always derived via applyDayFilter / toUtcRange — never here.
 */
import { ValidationError } from '../ValidationError.js';
import {
  assertIanaTimezone,
  todayInTimezone,
  shiftDateYmd,
} from './datetime.js';

export const DATE_YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * @param {string} dateYmd
 * @param {string} [label]
 */
export function assertCalendarDateYmd(dateYmd, label = 'date') {
  if (!DATE_YMD_RE.test(String(dateYmd))) {
    throw new ValidationError(400, `${label} must match YYYY-MM-DD`);
  }
  const parsed = new Date(`${dateYmd}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== dateYmd) {
    throw new ValidationError(400, `${label} is not a valid calendar date`);
  }
}

/**
 * @param {string} dateYmd
 * @param {string} timezoneIana
 */
export function assertNotFutureDateYmd(dateYmd, timezoneIana) {
  assertIanaTimezone(timezoneIana);
  const today = todayInTimezone(timezoneIana);
  if (dateYmd > today) {
    throw new ValidationError(400, 'date cannot be in the future');
  }
}

/**
 * @param {unknown} dateRaw
 * @param {string} timezoneIana
 * @returns {string} YYYY-MM-DD
 */
export function resolveRequestedDateYmd(dateRaw, timezoneIana) {
  if (dateRaw != null && dateRaw !== '') {
    const date = String(dateRaw);
    assertCalendarDateYmd(date);
    return date;
  }
  return todayInTimezone(timezoneIana);
}

/**
 * @param {string} dateRange
 * @param {string} [customStartDate]
 * @param {string} [customEndDate]
 * @param {string} timezoneIana
 * @returns {{ startDate: string, endDate: string }}
 */
export function parseRelativeDateRangeYmd(
  dateRange,
  customStartDate,
  customEndDate,
  timezoneIana,
) {
  assertIanaTimezone(timezoneIana);
  const today = todayInTimezone(timezoneIana);
  const range = String(dateRange || '').toLowerCase();

  switch (range) {
    case 'today':
      return { startDate: today, endDate: today };
    case 'yesterday': {
      const y = shiftDateYmd(today, -1, timezoneIana);
      return { startDate: y, endDate: y };
    }
    case 'last7days':
      return { startDate: shiftDateYmd(today, -6, timezoneIana), endDate: today };
    case 'last10days':
      return { startDate: shiftDateYmd(today, -9, timezoneIana), endDate: today };
    case 'last30days':
      return { startDate: shiftDateYmd(today, -29, timezoneIana), endDate: today };
    case 'custom': {
      if (!customStartDate || !customEndDate) {
        throw new ValidationError(400, 'startDate and endDate are required for custom range');
      }
      assertCalendarDateYmd(customStartDate, 'startDate');
      assertCalendarDateYmd(customEndDate, 'endDate');
      if (customStartDate > customEndDate) {
        throw new ValidationError(400, 'startDate must be on or before endDate');
      }
      return { startDate: customStartDate, endDate: customEndDate };
    }
    default:
      throw new ValidationError(400, `Invalid dateRange: ${dateRange}`);
  }
}
