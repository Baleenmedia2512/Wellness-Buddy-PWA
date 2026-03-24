/**
 * Time Report Helper Functions
 * ⚠️  INDEPENDENT MODULE — does NOT import from or modify disciplineHelpers.js
 *
 * Provides utilities for the /api/activity/time-report endpoint:
 *   parseDateRangeIST, formatDateIST, convertISTToLocalDate,
 *   extractTimeHHMM, extractLocalDateString, getActivityStatus,
 *   groupRecordsByDate, pickEarliestRecordPerActivity,
 *   buildDateList, computeAverageTime
 */

/**
 * Parse a date-range string to { start, end } Date objects.
 * "Today" is always computed in IST (UTC+5:30) so server timezone differences
 * do not affect which day is considered current.
 *
 * @param {"today"|"yesterday"|"last7days"|"last30days"|"custom"} range
 * @param {string} [customStart]  YYYY-MM-DD  (required when range === "custom")
 * @param {string} [customEnd]    YYYY-MM-DD  (required when range === "custom")
 * @returns {{ start: Date, end: Date }}
 */
export function parseDateRangeIST(range, customStart, customEnd) {
  const now = new Date();
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // UTC+5:30
  const istNow = new Date(now.getTime() + IST_OFFSET_MS);

  const year  = istNow.getUTCFullYear();
  const month = istNow.getUTCMonth();
  const day   = istNow.getUTCDate();

  // Midnight IST expressed as UTC midnight + the IST-equivalent date parts
  const today = new Date(Date.UTC(year, month, day));

  switch (range) {
    case 'today':
      return { start: today, end: today };

    case 'yesterday': {
      const d = new Date(today);
      d.setUTCDate(d.getUTCDate() - 1);
      return { start: d, end: d };
    }

    case 'last7days': {
      const d = new Date(today);
      d.setUTCDate(d.getUTCDate() - 6);
      return { start: d, end: today };
    }

    case 'last30days': {
      const d = new Date(today);
      d.setUTCDate(d.getUTCDate() - 29);
      return { start: d, end: today };
    }

    case 'custom':
      return {
        start: new Date(customStart),
        end:   new Date(customEnd),
      };

    default: {
      const d = new Date(today);
      d.setUTCDate(d.getUTCDate() - 6);
      return { start: d, end: today };
    }
  }
}

/**
 * Format a Date object to a YYYY-MM-DD string using its UTC date parts.
 * (Works correctly because parseDateRangeIST stores IST dates as UTC midnight.)
 *
 * @param {Date} date
 * @returns {string}
 */
export function formatDateIST(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Convert an IST timestamp string to a user-local Date object.
 *
 * The database stores timestamps WITHOUT timezone info but in IST (UTC+5:30).
 * userTimezoneOffset follows the JavaScript convention:
 *   positive value = west of UTC  (e.g. EST → +300)
 *   negative value = east of UTC  (e.g. IST → -330)
 *
 * Internally we:
 *   1. Parse the IST string as-if it were UTC (append 'Z').
 *   2. Subtract 330 minutes to recover the true UTC instant.
 *   3. Apply the user's offset to shift to their local wall-clock time.
 *
 * The resulting Date's UTC fields (getUTCHours, etc.) hold the local time.
 *
 * @param {string|null} istTimestamp  e.g. "2026-03-19 06:10:00"
 * @param {number}      userTimezoneOffset  minutes (JS convention)
 * @returns {Date|null}
 */
export function convertISTToLocalDate(istTimestamp, userTimezoneOffset) {
  if (!istTimestamp) return null;
  try {
    const clean = String(istTimestamp).replace(' ', 'T');
    const parsedAsUTC = new Date(clean + 'Z');
    if (isNaN(parsedAsUTC.getTime())) return null;

    const IST_OFFSET_MS = 330 * 60 * 1000; // IST = UTC+5:30
    const actualUTC = new Date(parsedAsUTC.getTime() - IST_OFFSET_MS);
    return new Date(actualUTC.getTime() - (userTimezoneOffset * 60 * 1000));
  } catch {
    return null;
  }
}

/**
 * Extract an "HH:mm" string from a locally-offset Date object
 * (one returned by convertISTToLocalDate).
 *
 * @param {Date|null} localDate
 * @returns {string|null}  e.g. "06:10"
 */
export function extractTimeHHMM(localDate) {
  if (!localDate) return null;
  const h = String(localDate.getUTCHours()).padStart(2, '0');
  const m = String(localDate.getUTCMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

/**
 * Extract a "YYYY-MM-DD" string from a locally-offset Date object.
 *
 * @param {Date|null} localDate
 * @returns {string|null}
 */
export function extractLocalDateString(localDate) {
  if (!localDate) return null;
  const y = localDate.getUTCFullYear();
  const m = String(localDate.getUTCMonth() + 1).padStart(2, '0');
  const d = String(localDate.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Determine status for one activity entry relative to its time window.
 *
 * @param {string|null}                       timeHHMM  e.g. "07:45" or null
 * @param {{ start: string, end: string }|null} window  "HH:mm:ss" strings from DB
 * @returns {"on-time"|"late"|"missed"}
 */
export function getActivityStatus(timeHHMM, window) {
  if (!timeHHMM) return 'missed';
  if (!window?.start || !window?.end) return 'on-time'; // no window configured

  const t = timeHHMM + ':00'; // "HH:mm" → "HH:mm:ss" for lexicographic comparison
  if (t >= window.start && t <= window.end) return 'on-time';
  if (t > window.end) return 'late';
  // t < window.start: recorded before the window opened — treat as late
  return 'late';
}

/**
 * Group an array of DB records by their user-local date (YYYY-MM-DD).
 * Enriches every record with a `_localDate` property (a Date whose UTC
 * fields hold the local wall-clock time).
 *
 * @param {Array<Object>} records          Must include `CreatedAt` (IST string)
 * @param {number}        userTimezoneOffset (minutes, JS convention)
 * @returns {Map<string, Array<Object>>}  "YYYY-MM-DD" → enriched record[]
 */
export function groupRecordsByDate(records, userTimezoneOffset) {
  const map = new Map();
  for (const record of records) {
    const localDate = convertISTToLocalDate(record.CreatedAt, userTimezoneOffset);
    const dateKey   = extractLocalDateString(localDate);
    if (!dateKey) continue;
    if (!map.has(dateKey)) map.set(dateKey, []);
    map.get(dateKey).push({ ...record, _localDate: localDate });
  }
  return map;
}

/**
 * For a single day's records, pick the best representative entry for
 * one activity's time window and return its status.
 *
 * Algorithm (in priority order):
 *   1. Earliest record whose local time falls WITHIN [window.start, window.end] → "on-time"
 *   2. Earliest record whose local time is AFTER window.end → "late"
 *   3. Records before window.start are ignored (belong to an earlier activity).
 *   4. No qualifying record → "missed"
 *
 * Records must already be enriched with `_localDate` (see groupRecordsByDate).
 *
 * @param {Array<Object>}                    dayRecords  enriched with `_localDate`
 * @param {{ start: string, end: string }|null} window  "HH:mm:ss" strings
 * @returns {{ timeHHMM: string|null, status: "on-time"|"late"|"missed" }}
 */
export function pickEarliestRecordPerActivity(dayRecords, window) {
  if (!dayRecords || dayRecords.length === 0) {
    return { timeHHMM: null, status: 'missed' };
  }

  // Sort ascending by IST timestamp (ISO-like strings sort correctly)
  const sorted = [...dayRecords].sort((a, b) =>
    String(a.CreatedAt || '').localeCompare(String(b.CreatedAt || ''))
  );

  if (window?.start && window?.end) {
    // Priority 1: earliest within the window → on-time
    const withinWindow = sorted.find((r) => {
      const t = extractTimeHHMM(r._localDate);
      if (!t) return false;
      const ts = t + ':00';
      return ts >= window.start && ts <= window.end;
    });
    if (withinWindow) {
      return { timeHHMM: extractTimeHHMM(withinWindow._localDate), status: 'on-time' };
    }

    // Priority 2: earliest after window end → late
    const afterWindow = sorted.find((r) => {
      const t = extractTimeHHMM(r._localDate);
      if (!t) return false;
      return (t + ':00') > window.end;
    });
    if (afterWindow) {
      return { timeHHMM: extractTimeHHMM(afterWindow._localDate), status: 'late' };
    }

    // All records are before window.start (e.g. only a breakfast log exists
    // when assessing dinner) → treat as missed for this activity
    return { timeHHMM: null, status: 'missed' };
  }

  // No window configured → return the earliest record as on-time
  const earliest = sorted[0];
  return { timeHHMM: extractTimeHHMM(earliest._localDate), status: 'on-time' };
}

/**
 * Build an ordered array of YYYY-MM-DD strings (inclusive) for a date range.
 *
 * @param {Date} startDate
 * @param {Date} endDate
 * @returns {string[]}
 */
export function buildDateList(startDate, endDate) {
  const dates = [];
  const cur = new Date(startDate);
  while (cur <= endDate) {
    dates.push(formatDateIST(cur));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return dates;
}

/**
 * Compute the average of multiple "HH:mm" time strings.
 * Returns null when the input array has no valid entries.
 *
 * @param {string[]} times  e.g. ["06:10", "07:30", "06:50"]
 * @returns {string|null}   e.g. "06:50"
 */
export function computeAverageTime(times) {
  const valid = times.filter(Boolean);
  if (valid.length === 0) return null;

  const totalMinutes = valid.reduce((sum, t) => {
    const [h, m] = t.split(':').map(Number);
    return sum + h * 60 + m;
  }, 0);

  const avg = Math.round(totalMinutes / valid.length);
  const hh  = String(Math.floor(avg / 60)).padStart(2, '0');
  const mm  = String(avg % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}
