/**
 * Resolve the IANA timezone for diary calendar-date API calls.
 * Must match backend getUserTimezoneIana(ownerUserId).
 */
import {
  DEFAULT_BUSINESS_TIMEZONE,
  resolveBusinessTimezone,
} from '../../../shared/utils/datetimeUtils';
import { getDeviceTimezoneIana } from '../../../shared/utils/deviceTimezone';

/**
 * @param {object|null|undefined} user Owner/subject user (profile may include timezone).
 * @returns {string} IANA timezone
 */
export function resolveDiaryTimezone(user) {
  if (user && typeof user === 'object' && (user.timezone || user.timezoneIana)) {
    return resolveBusinessTimezone(user);
  }
  return getDeviceTimezoneIana() ?? DEFAULT_BUSINESS_TIMEZONE;
}
