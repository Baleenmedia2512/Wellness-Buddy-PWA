/**
 * Resolve the IANA timezone for diary calendar-date API calls.
 * Must match backend getUserTimezoneIana(ownerUserId).
 *
 * Never fall back to the viewer's device timezone — that breaks coach views
 * of members in another zone. Prefer profile TZ, then Asia/Kolkata default.
 */
import {
  DEFAULT_BUSINESS_TIMEZONE,
  resolveBusinessTimezone,
  dateToBusinessYmd,
  formatCalendarPickerDate,
} from '../../../shared/utils/datetimeUtils.js';

/**
 * @param {object|null|undefined} user Owner/subject user (profile may include timezone).
 * @returns {string} IANA timezone
 */
export function resolveDiaryTimezone(user) {
  if (user && typeof user === 'object' && (user.timezone || user.timezoneIana)) {
    return resolveBusinessTimezone(user);
  }
  return DEFAULT_BUSINESS_TIMEZONE;
}

/**
 * Calendar date for GET /api/diary/list.
 *
 * Calendar widgets build Dates at the viewer's local midnight. Re-reading
 * that instant in the owner's zone (Qatar / USA vs India) would shift the
 * requested day backwards. Use the picker Y/M/D as the date that was tapped.
 *
 * @param {Date|string|null|undefined} date
 * @param {string} [timezoneIana]
 * @returns {string|null}
 */
export function toYmd(date, timezoneIana = DEFAULT_BUSINESS_TIMEZONE) {
  if (typeof date === 'string') {
    return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
  }
  if (date instanceof Date && !Number.isNaN(date.getTime())) {
    return formatCalendarPickerDate(date);
  }
  return dateToBusinessYmd(date, timezoneIana);
}
