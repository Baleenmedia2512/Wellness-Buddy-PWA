/**
 * UTC display + business-calendar helpers for the frontend.
 *
 * - Timestamps from the API are parsed and displayed in UTC.
 * - Calendar dates (YYYY-MM-DD sent to the API) use the user's business
 *   timezone (from profile, default Asia/Kolkata).
 * - This module does NOT compute UTC query ranges — the backend owns that.
 */

export const DEFAULT_BUSINESS_TIMEZONE = 'Asia/Kolkata';

/**
 * @param {unknown} source User object, timezone string, or null.
 * @returns {string} IANA timezone
 */
export function resolveBusinessTimezone(source) {
  if (!source) return DEFAULT_BUSINESS_TIMEZONE;
  if (typeof source === 'string' && source.trim()) return source.trim();
  if (typeof source === 'object') {
    return (
      source.timezone
      || source.timezoneIana
      || source.Timezone
      || DEFAULT_BUSINESS_TIMEZONE
    );
  }
  return DEFAULT_BUSINESS_TIMEZONE;
}

/**
 * Parse an API timestamp as a UTC instant.
 * @param {unknown} value
 * @returns {Date|null}
 */
export function parseUtcTimestamp(value) {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : new Date(value.getTime());
  }
  if (typeof value !== 'string') return null;

  let normalized = value.trim().replace(' ', 'T');
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    normalized = `${normalized}T00:00:00Z`;
  } else if (!normalized.endsWith('Z') && !/[+-]\d{2}:\d{2}$/.test(normalized)) {
    normalized = `${normalized}Z`;
  }

  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

const UTC_DISPLAY = { timeZone: 'UTC' };

/** @param {unknown} ts @param {Intl.DateTimeFormatOptions} [options] */
export function formatUtcDate(ts, options = {}) {
  const date = parseUtcTimestamp(ts);
  if (!date) return '';
  return date.toLocaleDateString('en-US', {
    ...UTC_DISPLAY,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...options,
  });
}

/** @param {unknown} ts @param {Intl.DateTimeFormatOptions} [options] */
export function formatUtcTime(ts, options = {}) {
  const date = parseUtcTimestamp(ts);
  if (!date) return '';
  const { timeZone, ...rest } = options;
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    ...(timeZone ? { timeZone } : UTC_DISPLAY),
    ...rest,
  });
}

/**
 * Format a stored API timestamp in the owner's business timezone.
 * @param {unknown} ts
 * @param {string} [timezoneIana]
 * @param {Intl.DateTimeFormatOptions} [options]
 */
export function formatBusinessTime(ts, timezoneIana = DEFAULT_BUSINESS_TIMEZONE, options = {}) {
  const date = parseUtcTimestamp(ts);
  if (!date) return '';
  return date.toLocaleTimeString('en-US', {
    timeZone: timezoneIana,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    ...options,
  });
}

/** @param {unknown} ts */
export function formatUtcDateTime(ts, dateOptions = {}, timeOptions = {}) {
  const dateStr = formatUtcDate(ts, dateOptions);
  const timeStr = formatUtcTime(ts, timeOptions);
  if (!dateStr) return '';
  return timeStr ? `${dateStr} at ${timeStr}` : dateStr;
}

/** @param {unknown} ts */
export function getUtcTimestampMs(ts) {
  const date = parseUtcTimestamp(ts);
  return date ? date.getTime() : 0;
}

/** @param {unknown} ts */
export function getUtcHour(ts) {
  const date = parseUtcTimestamp(ts);
  return date ? date.getUTCHours() : Number.NaN;
}

/**
 * Hour (0–23) in the business timezone — for meal-window classification only.
 * @param {unknown} ts
 * @param {string} [timezoneIana]
 */
export function getBusinessHour(ts, timezoneIana = DEFAULT_BUSINESS_TIMEZONE) {
  const date = parseUtcTimestamp(ts);
  if (!date) return Number.NaN;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezoneIana,
    hour: 'numeric',
    hour12: false,
  }).formatToParts(date);
  const hourPart = parts.find((part) => part.type === 'hour');
  return hourPart ? Number.parseInt(hourPart.value, 10) : Number.NaN;
}

/**
 * Today's calendar date (YYYY-MM-DD) in the business timezone.
 * @param {string} [timezoneIana]
 * @param {Date} [now]
 */
export function todayBusinessDate(timezoneIana = DEFAULT_BUSINESS_TIMEZONE, now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezoneIana,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/**
 * Map a timestamp to its business-calendar YYYY-MM-DD.
 * @param {unknown} ts
 * @param {string} [timezoneIana]
 */
export function timestampToBusinessYmd(ts, timezoneIana = DEFAULT_BUSINESS_TIMEZONE) {
  const date = parseUtcTimestamp(ts);
  if (!date) return '';
  return todayBusinessDate(timezoneIana, date);
}

/**
 * Normalise a Date or YYYY-MM-DD string to business-calendar YMD.
 * @param {Date|string|null|undefined} date
 * @param {string} [timezoneIana]
 */
export function dateToBusinessYmd(date, timezoneIana = DEFAULT_BUSINESS_TIMEZONE) {
  if (typeof date === 'string') {
    return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
  }
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  return todayBusinessDate(timezoneIana, date);
}

/** @param {Date|string|null|undefined} date @param {string} [timezoneIana] */
export function formatBusinessDateString(date, timezoneIana = DEFAULT_BUSINESS_TIMEZONE) {
  return dateToBusinessYmd(date, timezoneIana) || '';
}

/**
 * Format a Date picked in the device calendar as YYYY-MM-DD using its
 * local year/month/day (no UTC shift). Use only for UI calendar widgets.
 * @param {Date} date
 */
export function formatCalendarPickerDate(date) {
  if (!date || !(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** @param {unknown} a @param {unknown} b */
export function compareUtcTimestampsDesc(a, b) {
  return getUtcTimestampMs(b) - getUtcTimestampMs(a);
}

/** @param {unknown} a @param {unknown} b */
export function compareUtcTimestampsAsc(a, b) {
  return getUtcTimestampMs(a) - getUtcTimestampMs(b);
}

/** @param {unknown} tsA @param {unknown} tsB @param {string} [timezoneIana] */
export function isSameBusinessDay(tsA, tsB, timezoneIana = DEFAULT_BUSINESS_TIMEZONE) {
  const a = timestampToBusinessYmd(tsA, timezoneIana);
  const b = timestampToBusinessYmd(tsB, timezoneIana);
  return Boolean(a && b && a === b);
}

/** @param {unknown} ts @param {string} [timezoneIana] */
export function isBusinessToday(ts, timezoneIana = DEFAULT_BUSINESS_TIMEZONE) {
  return timestampToBusinessYmd(ts, timezoneIana) === todayBusinessDate(timezoneIana);
}

/** @param {unknown} ts @param {string} [timezoneIana] */
export function isBusinessYesterday(ts, timezoneIana = DEFAULT_BUSINESS_TIMEZONE) {
  const today = todayBusinessDate(timezoneIana);
  const [y, m, d] = today.split('-').map(Number);
  const yesterdayAnchor = new Date(Date.UTC(y, m - 1, d - 1));
  const yesterday = todayBusinessDate(timezoneIana, yesterdayAnchor);
  return timestampToBusinessYmd(ts, timezoneIana) === yesterday;
}

/** @param {unknown} ts */
export function getRelativeTimeUtc(ts) {
  const date = parseUtcTimestamp(ts);
  if (!date) return '';

  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return formatUtcDate(ts);
}
