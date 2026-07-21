/**
 * IST business-date range helpers for wellness score history.
 */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const MAX_HISTORY_DAYS = 31;

export function isValidScoreDate(date) {
  return DATE_RE.test(String(date || ''));
}

function parseYmd(dateStr) {
  const [y, m, d] = String(dateStr).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function formatYmdUtc(date) {
  return date.toISOString().slice(0, 10);
}

export function addDaysYmd(dateStr, deltaDays) {
  const d = parseYmd(dateStr);
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return formatYmdUtc(d);
}

/**
 * Inclusive list of YYYY-MM-DD strings from start to end (IST calendar dates).
 */
export function enumerateScoreDates(startDate, endDate) {
  if (!isValidScoreDate(startDate) || !isValidScoreDate(endDate)) {
    throw new Error('Invalid date range');
  }
  if (startDate > endDate) {
    throw new Error('startDate must be on or before endDate');
  }

  const dates = [];
  let cursor = startDate;
  while (cursor <= endDate) {
    dates.push(cursor);
    if (cursor === endDate) break;
    cursor = addDaysYmd(cursor, 1);
    if (dates.length > MAX_HISTORY_DAYS) {
      throw new Error(`Date range cannot exceed ${MAX_HISTORY_DAYS} days`);
    }
  }
  return dates;
}
