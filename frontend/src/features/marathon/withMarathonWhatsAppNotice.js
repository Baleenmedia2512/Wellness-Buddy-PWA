/**
 * Live-date wrapper around appendMarathonWhatsAppNotice.
 * Uses the same timezone as the Home banner (profile, else device).
 * Honours `marathon.testDate` when no explicit YYYY-MM-DD is passed.
 */
import {
  todayBusinessDate,
  resolveBusinessTimezone,
} from '../../shared/utils/datetimeUtils';
import { getDeviceTimezoneIana } from '../../shared/utils/deviceTimezone';
import storage from '../../shared/lib/storage';
import {
  resolveMarathonToday,
  MARATHON_TEST_DATE_STORAGE_KEY,
} from './domain/marathonCalendar';
import { appendMarathonWhatsAppNotice } from './domain/marathonShareCaption';
import { mergeMarathonWeightComparisonForShare } from './domain/marathonWeightComparison';
import { getMarathonWeightComparisonFromCache } from './marathonWeightComparisonCache';
import { getCachedProfile } from '../user/services/user.api';

/**
 * Profile IANA when set; otherwise the device timezone (same as DetoxDayReminder).
 * @param {unknown} timezoneSource User object, IANA string, or null
 * @returns {string}
 */
export function resolveMarathonTimezoneSource(timezoneSource) {
  if (typeof timezoneSource === 'string' && timezoneSource.trim()) {
    return timezoneSource.trim();
  }
  if (
    timezoneSource
    && typeof timezoneSource === 'object'
    && (timezoneSource.timezone || timezoneSource.timezoneIana || timezoneSource.Timezone)
  ) {
    return resolveBusinessTimezone(timezoneSource);
  }
  return resolveBusinessTimezone(getDeviceTimezoneIana());
}

/**
 * @param {unknown} user
 * @returns {object|null}
 */
function resolveMarathonWeightComparisonFromProfileCache(user) {
  if (!user || typeof user !== 'object') return null;
  const email = user.email || user.Email;
  if (!email) return null;
  const profile = getCachedProfile(email);
  return profile?.data?.marathonWeightComparison ?? null;
}

/**
 * @param {unknown} caption
 * @param {string|{ ymd?: string, user?: object, timezoneSource?: unknown, timezoneIana?: string, now?: Date, marathonWeightComparison?: object|null, currentMarathonDay0Weight?: unknown }} [ymdOrOptions]
 * @returns {string}
 */
export function withMarathonWhatsAppNotice(caption, ymdOrOptions) {
  let ymdOverride = null;
  let timezoneSource;
  let now;
  let marathonWeightComparison = null;
  let currentMarathonDay0Weight;
  let user;

  if (typeof ymdOrOptions === 'string') {
    ymdOverride = ymdOrOptions;
  } else if (ymdOrOptions && typeof ymdOrOptions === 'object') {
    ymdOverride = ymdOrOptions.ymd || ymdOrOptions.ymdOverride || null;
    timezoneSource = ymdOrOptions.timezoneSource
      ?? ymdOrOptions.timezoneIana
      ?? ymdOrOptions.user;
    now = ymdOrOptions.now;
    user = ymdOrOptions.user;
    if (ymdOrOptions.marathonWeightComparison !== undefined) {
      marathonWeightComparison = ymdOrOptions.marathonWeightComparison;
    }
    if (ymdOrOptions.currentMarathonDay0Weight !== undefined) {
      currentMarathonDay0Weight = ymdOrOptions.currentMarathonDay0Weight;
    }
  }

  if (marathonWeightComparison === null) {
    marathonWeightComparison = getMarathonWeightComparisonFromCache()
      ?? resolveMarathonWeightComparisonFromProfileCache(user);
  }

  if (currentMarathonDay0Weight !== undefined) {
    marathonWeightComparison = mergeMarathonWeightComparisonForShare(
      marathonWeightComparison,
      currentMarathonDay0Weight,
    );
  }

  const tz = resolveMarathonTimezoneSource(timezoneSource);
  const live = ymdOverride || todayBusinessDate(
    tz,
    now instanceof Date ? now : new Date(),
  );
  const stored = ymdOverride ? null : storage.get(MARATHON_TEST_DATE_STORAGE_KEY);
  return appendMarathonWhatsAppNotice(
    caption,
    resolveMarathonToday(live, stored),
    marathonWeightComparison,
  );
}
