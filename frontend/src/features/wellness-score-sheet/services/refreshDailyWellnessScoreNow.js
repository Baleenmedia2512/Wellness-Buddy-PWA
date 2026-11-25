/**
 * Kick /daily immediately after a food/weight/education save so Home + sheet
 * paint from the seed without waiting on React refreshKey / startTransition.
 */
import {
  todayBusinessDate,
  DEFAULT_BUSINESS_TIMEZONE,
  resolveBusinessTimezone,
} from '../../../shared/utils/datetimeUtils';
import { getDeviceTimezoneIana } from '../../../shared/utils/deviceTimezone';
import { isFlagEnabled } from '../../../config/featureFlags';
import { readNumericDbUserId } from '../../../shared/services/numericDbUserId';
import { fetchDailyWellnessScore } from './wellnessScore.api';
import {
  getDailyWellnessScoreCached,
  seedDailyWellnessScoreCache,
} from './dailyWellnessScoreCache';

export { shouldSkipWellnessScoreRefresh } from '../domain/skipWellnessScoreRefresh';

export async function refreshDailyWellnessScoreNow({ userId, date, apiBaseUrl }) {
  if (userId == null || !date) return null;
  try {
    const score = await fetchDailyWellnessScore({ userId, date, apiBaseUrl });
    if (score) seedDailyWellnessScoreCache(userId, date, score);
    return score;
  } catch {
    return null;
  }
}

/**
 * Fire-and-forget today's score refresh after a diary mutation.
 * @returns {Promise<object|null>}
 */
export function refreshDailyWellnessScoreAfterSave({ user, userId, apiBaseUrl }) {
  const id = userId || user?.id || user?.UserId || user?.userId;
  if (id == null) return Promise.resolve(null);
  const timezoneIana = resolveBusinessTimezone(user) || DEFAULT_BUSINESS_TIMEZONE;
  return refreshDailyWellnessScoreNow({
    userId: id,
    date: todayBusinessDate(timezoneIana),
    apiBaseUrl,
  });
}

/**
 * Fresh today's score for WhatsApp captions (avoids stale Home cache).
 * Falls back to cache when the network fetch fails.
 *
 * @param {object} [options]
 * @param {object|null} [options.user]
 * @param {string|number|null} [options.userId]
 * @param {string} [options.apiBaseUrl]
 * @param {unknown} [options.timezoneSource]
 * @returns {Promise<object|null>}
 */
export async function ensureDailyWellnessScoreForShare({
  user = null,
  userId = null,
  apiBaseUrl = process.env.REACT_APP_API_BASE_URL,
  timezoneSource = null,
} = {}) {
  if (!isFlagEnabled('ff.wellness-score-sheet')) return null;

  const id = readNumericDbUserId(
    userId != null && userId !== '' ? { id: userId } : user,
  );
  const tzSource = timezoneSource ?? user;
  const timezoneIana = typeof tzSource === 'string' && tzSource.trim()
    ? tzSource.trim()
    : (resolveBusinessTimezone(tzSource) || getDeviceTimezoneIana() || DEFAULT_BUSINESS_TIMEZONE);
  const date = todayBusinessDate(timezoneIana);

  if (id == null) {
    return getDailyWellnessScoreCached(null, date);
  }

  const fresh = await refreshDailyWellnessScoreNow({
    userId: id,
    date,
    apiBaseUrl,
  });
  return fresh || getDailyWellnessScoreCached(id, date);
}
