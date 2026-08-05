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
} from '../../../shared/utils/datetimeUtils';

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
