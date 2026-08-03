/**
 * Canonical food_nutrition_data_table.CreatedAt interpretation.
 *
 * Product contract: food CreatedAt is legacy IST (business) wall-clock when
 * timezone-less. Drivers / timestamptz sessions sometimes append a spurious
 * `Z` / `+00:00` while leaving IST digits intact — that must NOT shift the
 * meal into the next calendar day.
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

const DATE_PREFIX_RE = /^(\d{4}-\d{2}-\d{2})/;
const UTC_OR_ZERO_OFFSET_RE = /(?:Z|[+]00:?00)$/i;
const NON_UTC_OFFSET_RE = /[+-]\d{2}:?\d{2}$/;

/**
 * @param {string} raw
 * @returns {string|null}
 */
function extractDatePrefix(raw) {
  const match = String(raw).trim().match(DATE_PREFIX_RE);
  return match ? match[1] : null;
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
 * - Timezone-less → business wall-clock in `timezoneIana`
 * - Explicit non-UTC offset (e.g. +05:30) → absolute instant
 * - `Z` / `+00:00` → absolute UTC, unless the UTC→business calendar day
 *   disagrees with the embedded date prefix (spurious driver Z on legacy
 *   IST wall) — then reinterpret wall digits in `timezoneIana`
 *
 * @param {string|Date} raw
 * @param {string} [timezoneIana=IANA_IST]
 * @returns {string} UTC ISO with Z
 */
export function normalizeFoodCreatedAt(raw, timezoneIana = IANA_IST) {
  assertIanaTimezone(timezoneIana);

  if (raw instanceof Date) {
    return normalizeStoredTimestampToUtcIso(raw, timezoneIana);
  }
  if (raw == null || String(raw).trim() === '') {
    throw new RangeError('Invalid food CreatedAt: empty');
  }

  const s = String(raw).trim();

  if (hasNonUtcExplicitOffset(s)) {
    return normalizeStoredTimestampToUtcIso(s, timezoneIana);
  }

  if (hasUtcOrZeroOffset(s)) {
    const asUtc = normalizeStoredTimestampToUtcIso(s, timezoneIana);
    const utcCalendarYmd = timestampToCalendarYmd(asUtc, timezoneIana);
    const prefix = extractDatePrefix(s);
    if (prefix && prefix !== utcCalendarYmd) {
      // Legacy IST wall digits with driver-added Z/+00:00
      const stripped = s.replace(UTC_OR_ZERO_OFFSET_RE, '');
      return normalizeStoredTimestampToUtcIso(stripped, timezoneIana);
    }
    return asUtc;
  }

  return normalizeStoredTimestampToUtcIso(s, timezoneIana);
}

/**
 * Resolve food CreatedAt into one instant + derived calendar day / local time.
 *
 * @param {string|Date} raw
 * @param {string} [timezoneIana=IANA_IST]
 * @returns {{ utcIso: string, calendarYmd: string, timeOfDay: string }}
 */
export function resolveFoodTimestamp(raw, timezoneIana = IANA_IST) {
  const utcIso = normalizeFoodCreatedAt(raw, timezoneIana);
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
