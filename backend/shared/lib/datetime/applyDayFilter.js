/**
 * Repository query helpers — scope Supabase/PostgREST queries to calendar days.
 */
import { toUtcRange, toUtcRangeInclusive } from './datetime.js';

/**
 * Apply an inclusive day filter on `column` using UTC bounds derived from
 * `dateYmd` interpreted in `timezoneIana`.
 *
 * @param {object} query - Supabase query builder (must support `.gte` / `.lte`)
 * @param {string} column - Column name to filter
 * @param {string} dateYmd - Calendar date `YYYY-MM-DD`
 * @param {string} timezoneIana - IANA timezone for the calendar day
 * @returns {object} The same query builder with bounds applied
 */
export function applyDayFilter(query, column, dateYmd, timezoneIana) {
  const { startUtc, endUtc } = toUtcRange(dateYmd, timezoneIana);
  return query.gte(column, startUtc).lte(column, endUtc);
}

/**
 * Apply an inclusive calendar-date range filter on `column`.
 *
 * @param {object} query
 * @param {string} column
 * @param {string} startDate - `YYYY-MM-DD` (inclusive)
 * @param {string} endDate - `YYYY-MM-DD` (inclusive)
 * @param {string} timezoneIana
 * @returns {object}
 */
export function applyDateRangeFilter(query, column, startDate, endDate, timezoneIana) {
  const { startUtc, endUtc } = toUtcRangeInclusive(startDate, endDate, timezoneIana);
  return query.gte(column, startUtc).lte(column, endUtc);
}

/**
 * Include rows on or after the start of `dateYmd` in `timezoneIana`.
 *
 * @param {object} query
 * @param {string} column
 * @param {string} dateYmd
 * @param {string} timezoneIana
 * @returns {object}
 */
export function applySinceDayStartFilter(query, column, dateYmd, timezoneIana) {
  const { startUtc } = toUtcRange(dateYmd, timezoneIana);
  return query.gte(column, startUtc);
}

/**
 * Include rows strictly before the start of `dateYmd` in `timezoneIana`.
 *
 * @param {object} query
 * @param {string} column
 * @param {string} dateYmd
 * @param {string} timezoneIana
 * @returns {object}
 */
export function applyBeforeDayFilter(query, column, dateYmd, timezoneIana) {
  const { startUtc } = toUtcRange(dateYmd, timezoneIana);
  return query.lt(column, startUtc);
}
