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
  getMarathonCalendarState,
  resolveMarathonToday,
  MARATHON_TEST_DATE_STORAGE_KEY,
} from './domain/marathonCalendar';
import { appendMarathonWhatsAppNotice } from './domain/marathonShareCaption';
import {
  formatMarathonWeightWhatsAppNoticeLines,
  mergeMarathonWeightComparisonForShare,
} from './domain/marathonWeightComparison';
import { getMarathonWeightComparisonFromCache } from './marathonWeightComparisonCache';
import { getCachedProfile } from '../user/services/user.api';
import { refreshMarathonWeightComparisonCache } from '../weight/services/weight.api';

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
 * @param {unknown} user
 * @param {unknown} userId
 * @returns {string|null}
 */
function resolveShareUserId(user, userId) {
  if (userId != null && userId !== '') return String(userId);
  if (!user || typeof user !== 'object') return null;
  const id = user.id ?? user.userId ?? user.UserId;
  return id != null && id !== '' ? String(id) : null;
}

/**
 * Load marathon Day 0 comparison for share when cache is empty or partial.
 * Uses the same business date as the Day 0 caption (profile/device tz + test override).
 *
 * @param {object} [options]
 * @param {object|null} [options.user]
 * @param {string|number|null} [options.userId]
 * @param {unknown} [options.timezoneSource]
 * @param {unknown} [options.currentMarathonDay0Weight]
 * @param {object|null|undefined} [options.marathonWeightComparison]
 * @returns {Promise<object|null>}
 */
export async function ensureMarathonWeightComparisonForShare({
  user = null,
  userId = null,
  timezoneSource,
  currentMarathonDay0Weight,
  marathonWeightComparison,
} = {}) {
  let comparison = marathonWeightComparison ?? null;
  if (comparison == null) {
    comparison = getMarathonWeightComparisonFromCache()
      ?? resolveMarathonWeightComparisonFromProfileCache(user);
  }

  if (currentMarathonDay0Weight !== undefined) {
    const merged = mergeMarathonWeightComparisonForShare(
      comparison,
      currentMarathonDay0Weight,
    );
    if (formatMarathonWeightWhatsAppNoticeLines(merged).length > 0) {
      return merged;
    }
  } else if (formatMarathonWeightWhatsAppNoticeLines(comparison).length > 0) {
    return comparison;
  }

  const resolvedUserId = resolveShareUserId(user, userId);
  if (!resolvedUserId) return comparison;

  const tz = resolveMarathonTimezoneSource(timezoneSource ?? user);
  const liveToday = todayBusinessDate(tz, new Date());
  const stored = storage.get(MARATHON_TEST_DATE_STORAGE_KEY);
  const ymd = resolveMarathonToday(liveToday, stored);
  const state = getMarathonCalendarState(ymd);
  if (!state.inMarathon || state.marathonDay !== 0) {
    return comparison;
  }

  if (!comparison) {
    comparison = { partial: true };
  }

  try {
    const fetched = await refreshMarathonWeightComparisonCache(resolvedUserId, {
      todayYmd: ymd,
      currentDay0Weight: currentMarathonDay0Weight,
    });
    if (fetched) comparison = fetched;
  } catch {
    /* share must stay non-blocking */
  }

  if (currentMarathonDay0Weight !== undefined) {
    return mergeMarathonWeightComparisonForShare(comparison, currentMarathonDay0Weight)
      ?? { partial: true, previousMarathonEndWeight: null, currentMarathonDay0Weight: null };
  }
  return comparison ?? { partial: true };
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
  const ymd = resolveMarathonToday(live, stored);
  const state = getMarathonCalendarState(ymd);
  if (marathonWeightComparison == null && state.inMarathon && state.marathonDay === 0) {
    marathonWeightComparison = { partial: true };
  }

  if (currentMarathonDay0Weight !== undefined) {
    marathonWeightComparison = mergeMarathonWeightComparisonForShare(
      marathonWeightComparison,
      currentMarathonDay0Weight,
    ) ?? { partial: true, previousMarathonEndWeight: null, currentMarathonDay0Weight: null };
  }

  return appendMarathonWhatsAppNotice(
    caption,
    ymd,
    marathonWeightComparison,
  );
}
