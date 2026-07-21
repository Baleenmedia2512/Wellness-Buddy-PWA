/**
 * Shared UTC datetime utilities (Luxon-backed).
 *
 * Canonical source for new timestamp generation and timezone-aware day bounds.
 * Legacy IST helpers remain in utils/supabaseClient.js until repository migration.
 */
import { DateTime } from 'luxon';
export const IANA_IST = 'Asia/Kolkata';

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Current instant as an ISO-8601 UTC string (e.g. `2026-07-21T05:30:00.000Z`).
 * Use this instead of `new Date().toISOString()` for all new timestamp generation.
 *
 * @returns {string}
 */
export function nowUtc() {
  return DateTime.utc().toISO();
}

/**
 * Validate an IANA timezone identifier.
 *
 * @param {string} timezoneIana
 * @returns {string} The validated timezone (passthrough)
 * @throws {TypeError|RangeError}
 */
export function assertIanaTimezone(timezoneIana) {
  if (typeof timezoneIana !== 'string' || !timezoneIana.trim()) {
    throw new TypeError(
      `Invalid IANA timezone: expected non-empty string, got ${String(timezoneIana)}`,
    );
  }

  const probe = DateTime.now().setZone(timezoneIana);
  if (!probe.isValid) {
    throw new RangeError(`Invalid IANA timezone: ${timezoneIana}`);
  }

  return timezoneIana;
}

/**
 * @param {string} dateYmd
 * @param {string} [label]
 */
function assertDateYmd(dateYmd, label = 'date') {
  if (typeof dateYmd !== 'string' || !YMD_RE.test(dateYmd)) {
    throw new TypeError(`Invalid ${label}: expected YYYY-MM-DD, got ${String(dateYmd)}`);
  }

  const probe = DateTime.fromISO(dateYmd, { zone: 'utc' });
  if (!probe.isValid) {
    throw new RangeError(`Invalid ${label}: ${dateYmd}`);
  }
}

/**
 * Convert a single calendar day in `timezoneIana` to an inclusive UTC range.
 *
 * @param {string} dateYmd - Calendar date `YYYY-MM-DD` in the target timezone
 * @param {string} timezoneIana - IANA timezone (e.g. `Asia/Kolkata`)
 * @returns {{ startUtc: string, endUtc: string }} ISO-8601 UTC bounds (inclusive end-of-day)
 */
export function toUtcRange(dateYmd, timezoneIana) {
  assertIanaTimezone(timezoneIana);
  assertDateYmd(dateYmd);

  const start = DateTime.fromISO(dateYmd, { zone: timezoneIana }).startOf('day');
  const end = start.endOf('day');

  return {
    startUtc: start.toUTC().toISO(),
    endUtc: end.toUTC().toISO(),
  };
}

/**
 * Convert an inclusive calendar-date range in `timezoneIana` to UTC bounds.
 *
 * @param {string} startDate - `YYYY-MM-DD` (inclusive)
 * @param {string} endDate - `YYYY-MM-DD` (inclusive)
 * @param {string} timezoneIana - IANA timezone
 * @returns {{ startUtc: string, endUtc: string }}
 */
export function toUtcRangeInclusive(startDate, endDate, timezoneIana) {
  assertIanaTimezone(timezoneIana);
  assertDateYmd(startDate, 'startDate');
  assertDateYmd(endDate, 'endDate');

  const start = DateTime.fromISO(startDate, { zone: timezoneIana }).startOf('day');
  const end = DateTime.fromISO(endDate, { zone: timezoneIana }).endOf('day');

  if (start > end) {
    throw new RangeError(
      `startDate (${startDate}) must be on or before endDate (${endDate})`,
    );
  }

  return {
    startUtc: start.toUTC().toISO(),
    endUtc: end.toUTC().toISO(),
  };
}

/**
 * Today's calendar date (`YYYY-MM-DD`) in the given IANA timezone.
 *
 * @param {string} timezoneIana
 * @returns {string}
 */
export function todayInTimezone(timezoneIana) {
  assertIanaTimezone(timezoneIana);
  return DateTime.now().setZone(timezoneIana).toFormat('yyyy-MM-dd');
}

/**
 * Shift a calendar date by `days` within `timezoneIana`.
 *
 * @param {string} dateYmd
 * @param {number} days
 * @param {string} timezoneIana
 * @returns {string}
 */
export function shiftDateYmd(dateYmd, days, timezoneIana) {
  assertIanaTimezone(timezoneIana);
  assertDateYmd(dateYmd);
  return DateTime.fromISO(dateYmd, { zone: timezoneIana }).plus({ days }).toFormat('yyyy-MM-dd');
}

/**
 * Format a UTC timestamp for display in a target timezone.
 *
 * @param {string|Date} utcTimestamp - ISO UTC string or Date
 * @param {string} [timezoneIana='Asia/Kolkata']
 * @param {string} [format='yyyy-MM-dd HH:mm:ss'] - Luxon format tokens
 * @returns {string}
 */
export function formatUtcForDisplay(
  utcTimestamp,
  timezoneIana = IANA_IST,
  format = 'yyyy-MM-dd HH:mm:ss',
) {
  assertIanaTimezone(timezoneIana);

  const dt = DateTime.fromISO(
    utcTimestamp instanceof Date ? utcTimestamp.toISOString() : utcTimestamp,
    { zone: 'utc' },
  ).setZone(timezoneIana);

  if (!dt.isValid) {
    throw new RangeError(`Invalid UTC timestamp: ${String(utcTimestamp)}`);
  }

  return dt.toFormat(format);
}

/**
 * Add calendar days to a UTC ISO timestamp and return a new UTC ISO string.
 *
 * @param {string} utcIso - Base UTC instant
 * @param {number} days - Days to add (may be negative)
 * @returns {string}
 */
export function addUtcDays(utcIso, days) {
  const dt = DateTime.fromISO(utcIso, { zone: 'utc' });
  if (!dt.isValid) {
    throw new RangeError(`Invalid UTC timestamp: ${String(utcIso)}`);
  }
  return dt.plus({ days }).toUTC().toISO();
}

/**
 * Calendar YYYY-MM-DD for a stored UTC timestamp in a business timezone.
 *
 * @param {string|Date} utcTimestamp
 * @param {string} [timezoneIana=IANA_IST]
 * @returns {string}
 */
export function timestampToCalendarYmd(utcTimestamp, timezoneIana = IANA_IST) {
  return formatUtcForDisplay(utcTimestamp, timezoneIana, 'yyyy-MM-dd');
}

/**
 * Wall-clock HH:mm:ss for a stored UTC timestamp in a business timezone.
 *
 * @param {string|Date} utcTimestamp
 * @param {string} [timezoneIana=IANA_IST]
 * @returns {string}
 */
export function timeOfDayInTimezone(utcTimestamp, timezoneIana = IANA_IST) {
  return formatUtcForDisplay(utcTimestamp, timezoneIana, 'HH:mm:ss');
}

/**
 * Parse a client-provided timestamp (offset-aware or UTC) for DB storage.
 *
 * @param {string|Date} clientTimestamp
 * @returns {{ utcIso: string }}
 */
export function parseClientTimestampToUtc(clientTimestamp) {
  const raw = clientTimestamp instanceof Date
    ? clientTimestamp.toISOString()
    : String(clientTimestamp).trim().replace(' ', 'T');
  const dt = DateTime.fromISO(raw, { setZone: true });
  if (!dt.isValid) {
    throw new RangeError(`Invalid client timestamp: ${String(clientTimestamp)}`);
  }
  return { utcIso: dt.toUTC().toISO() };
}
