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
 * True when an ISO-like string already carries an explicit offset (`Z` or ±HH:mm).
 *
 * @param {string} raw
 * @returns {boolean}
 */
function hasExplicitUtcOffset(raw) {
  return /(?:Z|[+-]\d{2}:?\d{2})$/i.test(String(raw).trim());
}

/**
 * Format a stored timestamp for display in a target timezone.
 *
 * Timezone-less strings are treated as wall-clock in `timezoneIana` (IST by
 * default) — the product contract for Supabase `CreatedAt` values that were
 * written without a `Z` suffix.
 *
 * @param {string|Date} utcTimestamp - ISO UTC string, naive business wall-clock, or Date
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

  const iso = utcTimestamp instanceof Date
    ? utcTimestamp.toISOString()
    : normalizeStoredTimestampToUtcIso(utcTimestamp, timezoneIana);

  const dt = DateTime.fromISO(iso, { zone: 'utc' }).setZone(timezoneIana);

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
 * Keep rows whose timestamp column falls on `dateYmd` in `timezoneIana`.
 * Pair with `applyDayFilterWidened` when CreatedAt is IST wall-clock without zone.
 *
 * @param {object[]} rows
 * @param {string} dateYmd - `YYYY-MM-DD`
 * @param {string} [timezoneIana=IANA_IST]
 * @param {string} [column='CreatedAt']
 * @returns {object[]}
 */
export function filterRowsByCalendarDay(rows, dateYmd, timezoneIana = IANA_IST, column = 'CreatedAt') {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  return rows.filter((row) => {
    const raw = row?.[column];
    if (raw == null) return false;
    try {
      const utcIso = normalizeStoredTimestampToUtcIso(raw, timezoneIana);
      return timestampToCalendarYmd(utcIso, timezoneIana) === dateYmd;
    } catch {
      return false;
    }
  });
}

/**
 * Keep rows whose timestamp column falls within [startDate, endDate] in `timezoneIana`.
 * Pair with `applyDateRangeFilterWidened` when CreatedAt is IST wall-clock without zone.
 *
 * @param {object[]} rows
 * @param {string} startDate - `YYYY-MM-DD` (inclusive)
 * @param {string} endDate - `YYYY-MM-DD` (inclusive)
 * @param {string} [timezoneIana=IANA_IST]
 * @param {string} [column='CreatedAt']
 * @returns {object[]}
 */
export function filterRowsByCalendarDateRange(
  rows,
  startDate,
  endDate,
  timezoneIana = IANA_IST,
  column = 'CreatedAt',
) {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  return rows.filter((row) => {
    const raw = row?.[column];
    if (raw == null) return false;
    try {
      const utcIso = normalizeStoredTimestampToUtcIso(raw, timezoneIana);
      const ymd = timestampToCalendarYmd(utcIso, timezoneIana);
      return ymd >= startDate && ymd <= endDate;
    } catch {
      return false;
    }
  });
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
 * Parse a client-provided timestamp for DB storage as UTC ISO (with `Z`).
 *
 * - Offset-aware / `Z` strings are honoured as absolute instants.
 * - Timezone-less strings are interpreted as wall-clock in `timezoneIana`
 *   (default Asia/Kolkata). Never treat naive strings as UTC — that caused
 *   diary times to render +5:30 ahead of the user's clock.
 *
 * @param {string|Date} clientTimestamp
 * @param {string} [timezoneIana=IANA_IST]
 * @returns {{ utcIso: string }}
 */
export function parseClientTimestampToUtc(clientTimestamp, timezoneIana = IANA_IST) {
  assertIanaTimezone(timezoneIana);

  if (clientTimestamp instanceof Date) {
    if (Number.isNaN(clientTimestamp.getTime())) {
      throw new RangeError(`Invalid client timestamp: ${String(clientTimestamp)}`);
    }
    return { utcIso: clientTimestamp.toISOString() };
  }

  const raw = String(clientTimestamp).trim().replace(' ', 'T');
  const dt = hasExplicitUtcOffset(raw)
    ? DateTime.fromISO(raw, { setZone: true })
    : DateTime.fromISO(raw, { zone: timezoneIana });

  if (!dt.isValid) {
    throw new RangeError(`Invalid client timestamp: ${String(clientTimestamp)}`);
  }
  return { utcIso: dt.toUTC().toISO() };
}

/**
 * Normalize a DB-stored `CreatedAt` (often timezone-less) to UTC ISO with `Z`.
 *
 * @param {string|Date} value
 * @param {string} [timezoneIana=IANA_IST]
 * @returns {string}
 */
export function normalizeStoredTimestampToUtcIso(value, timezoneIana = IANA_IST) {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new RangeError(`Invalid stored timestamp: ${String(value)}`);
    }
    return value.toISOString();
  }
  if (value == null || String(value).trim() === '') {
    throw new RangeError('Invalid stored timestamp: empty');
  }
  return parseClientTimestampToUtc(String(value), timezoneIana).utcIso;
}

/**
 * Persist a UTC instant in legacy tables whose `CreatedAt` columns are
 * timezone-less and read back as IST wall clock via
 * {@link normalizeStoredTimestampToUtcIso}.
 *
 * @param {string|Date} utcInstant - UTC ISO string or Date
 * @param {string} [timezoneIana=IANA_IST]
 * @returns {string} e.g. `2026-07-22 07:45:28.287`
 */
export function utcInstantToLegacyIstWallStorage(utcInstant, timezoneIana = IANA_IST) {
  assertIanaTimezone(timezoneIana);

  const iso = utcInstant instanceof Date
    ? utcInstant.toISOString()
    : String(utcInstant).trim();

  const dt = DateTime.fromISO(iso, { zone: 'utc' }).setZone(timezoneIana);
  if (!dt.isValid) {
    throw new RangeError(`Invalid UTC timestamp: ${String(utcInstant)}`);
  }
  return dt.toFormat('yyyy-MM-dd HH:mm:ss.SSS');
}
