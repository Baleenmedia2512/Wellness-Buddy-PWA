/**
 * Canonical food_nutrition_data_table.CreatedAt interpretation.
 *
 * Storage contract: timezone-less CreatedAt digits are legacy IST (Asia/Kolkata)
 * wall-clock. Drivers sometimes append a spurious `Z` / `+00:00` while leaving
 * IST digits intact — that must NOT shift a daytime meal by +5:30 (lunch into
 * dinner) or into the next calendar day.
 *
 * A clock earlier than 05:30 with that UTC mark is different. Those digits
 * were written as UTC (`now()` / a Date under `time_zone = '+00:00'`), so
 * 02:16 is 7:46 AM in India, not 2:16 AM. 05:30 and later stay IST wall.
 *
 * Display contract: after converting storage → UTC instant (always via IST),
 * calendar day and local time-of-day are derived in the owner's
 * `timezone_iana` (e.g. Asia/Qatar).
 *
 * All Wellness Score food day-bucketing and meal-window checks MUST go through
 * {@link resolveFoodTimestamp} so calendar day and local time-of-day always
 * come from the same interpreted instant.
 */
import {
  IANA_IST,
  assertIanaTimezone,
  normalizeStoredTimestampToUtcIso,
  timestampToCalendarYmd,
  timeOfDayInTimezone,
} from './datetime.js';

/** Legacy food/weight/education CreatedAt wall-clock zone (write path). */
export const LEGACY_STORAGE_TIMEZONE = IANA_IST;

const UTC_OR_ZERO_OFFSET_RE = /(?:Z|[+]00:?00)$/i;
const NON_UTC_OFFSET_RE = /[+-]\d{2}:?\d{2}$/;
const CLOCK_RE = /(?:T|\s)(\d{2}):(\d{2})(?::\d{2})?/;
/** IST is UTC+5:30. A UTC mark on an earlier clock is a real UTC instant. */
const IST_OFFSET_MINUTES = (5 * 60) + 30;

/**
 * @param {string} raw
 * @returns {number|null} minutes since midnight of the clock digits
 */
function clockMinutes(raw) {
  const match = CLOCK_RE.exec(String(raw));
  if (!match) return null;
  return (Number(match[1]) * 60) + Number(match[2]);
}

/**
 * @param {string} raw
 * @returns {boolean}
 */
function isUtcClockBeforeIstOffset(raw) {
  const minutes = clockMinutes(raw);
  return minutes != null && minutes < IST_OFFSET_MINUTES;
}

/**
 * @param {string} raw
 * @returns {boolean}
 */
function hasUtcOrZeroOffset(raw) {
  return UTC_OR_ZERO_OFFSET_RE.test(String(raw).trim());
}

/**
 * @param {string} raw
 * @returns {boolean}
 */
function hasNonUtcExplicitOffset(raw) {
  const s = String(raw).trim();
  if (hasUtcOrZeroOffset(s)) return false;
  return NON_UTC_OFFSET_RE.test(s);
}

/**
 * Normalize food CreatedAt to a UTC ISO instant.
 *
 * Rules:
 * - Timezone-less → IST wall-clock (legacy storage), never the display zone
 * - Explicit non-UTC offset (e.g. +05:30) → absolute instant
 * - `Z` / `+00:00` before 05:30 → real UTC digits (02:16 is 7:46 AM IST).
 * - `Z` / `+00:00` at 05:30 or later → driver-added mark on IST wall
 *   digits. 14:49 stays 2:49 PM lunch, not 8:19 PM dinner.
 *
 * @param {string|Date} raw
 * @param {string} [_ignoredTimezoneIana] Kept for call-site compatibility; storage is always IST
 * @returns {string} UTC ISO with Z
 */
export function normalizeFoodCreatedAt(raw, _ignoredTimezoneIana = IANA_IST) {
  // Storage zone is always IST — do not interpret naive digits in the user's TZ.
  const storageTz = LEGACY_STORAGE_TIMEZONE;
  assertIanaTimezone(storageTz);

  if (raw == null || (!(raw instanceof Date) && String(raw).trim() === '')) {
    throw new RangeError('Invalid food CreatedAt: empty');
  }

  const s = raw instanceof Date ? raw.toISOString() : String(raw).trim();

  if (hasNonUtcExplicitOffset(s)) {
    return normalizeStoredTimestampToUtcIso(s, storageTz);
  }

  if (hasUtcOrZeroOffset(s)) {
    if (isUtcClockBeforeIstOffset(s)) {
      return normalizeStoredTimestampToUtcIso(s, 'UTC');
    }
    const stripped = s.replace(UTC_OR_ZERO_OFFSET_RE, '');
    return normalizeStoredTimestampToUtcIso(stripped, storageTz);
  }

  return normalizeStoredTimestampToUtcIso(s, storageTz);
}

/**
 * Resolve food CreatedAt into one UTC instant + derived calendar day / local time
 * in the owner's display timezone.
 *
 * @param {string|Date} raw
 * @param {string} [timezoneIana=IANA_IST] Owner display timezone (`timezone_iana`)
 * @returns {{ utcIso: string, calendarYmd: string, timeOfDay: string }}
 */
export function resolveFoodTimestamp(raw, timezoneIana = IANA_IST) {
  assertIanaTimezone(timezoneIana);
  const utcIso = normalizeFoodCreatedAt(raw);
  return {
    utcIso,
    calendarYmd: timestampToCalendarYmd(utcIso, timezoneIana),
    timeOfDay: timeOfDayInTimezone(utcIso, timezoneIana),
  };
}

/**
 * Keep food rows whose CreatedAt falls on `dateYmd` in `timezoneIana`, using
 * the canonical food timestamp interpretation.
 *
 * @param {object[]} rows
 * @param {string} dateYmd
 * @param {string} [timezoneIana=IANA_IST]
 * @param {string} [column='CreatedAt']
 * @returns {object[]}
 */
export function filterFoodRowsByCalendarDay(
  rows,
  dateYmd,
  timezoneIana = IANA_IST,
  column = 'CreatedAt',
) {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  return rows.filter((row) => {
    const raw = row?.[column];
    if (raw == null) return false;
    try {
      return resolveFoodTimestamp(raw, timezoneIana).calendarYmd === dateYmd;
    } catch {
      return false;
    }
  });
}

/**
 * Keep food rows whose CreatedAt falls within [startDate, endDate] in `timezoneIana`.
 *
 * @param {object[]} rows
 * @param {string} startDate - `YYYY-MM-DD` (inclusive)
 * @param {string} endDate - `YYYY-MM-DD` (inclusive)
 * @param {string} [timezoneIana=IANA_IST]
 * @param {string} [column='CreatedAt']
 * @returns {object[]}
 */
export function filterFoodRowsByCalendarDateRange(
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
      const { calendarYmd } = resolveFoodTimestamp(raw, timezoneIana);
      return calendarYmd >= startDate && calendarYmd <= endDate;
    } catch {
      return false;
    }
  });
}
