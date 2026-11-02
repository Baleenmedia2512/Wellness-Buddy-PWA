/**
 * Look up whether this user already posted a Herbalife Shake in the last hour.
 * Fail-open: callers treat a lookup error as "no recent shake".
 */
import { getApiBaseUrl } from '../../../config/api.config';
import {
  DEFAULT_BUSINESS_TIMEZONE,
  todayBusinessDate,
  timestampToBusinessYmd,
} from '../../../shared/utils/datetimeUtils';
import {
  HERBALIFE_SHAKE_REPOST_WINDOW_MS,
  latestHerbalifeShakeWithinWindow,
} from '../domain/herbalifeShakeRepost.rules.js';

async function fetchMealsForDate(userId, date) {
  const url = `${getApiBaseUrl()}/api/food-corrections/stats?userId=${encodeURIComponent(userId)}&date=${encodeURIComponent(date)}&detailed=true&_t=${Date.now()}`;
  const res = await fetch(url, {
    headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
    cache: 'no-store',
  });
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data?.data) ? data.data : [];
}

/**
 * @param {{ userId: string|number, now?: Date, timezoneIana?: string }} input
 * @returns {Promise<{ loggedAt: Date, id: string|number|null }|null>}
 */
export async function findRecentHerbalifeShakePost({
  userId,
  now = new Date(),
  timezoneIana = DEFAULT_BUSINESS_TIMEZONE,
}) {
  const today = todayBusinessDate(timezoneIana, now);
  const windowStart = new Date(now.getTime() - HERBALIFE_SHAKE_REPOST_WINDOW_MS);
  const startYmd = timestampToBusinessYmd(windowStart, timezoneIana);
  const dates = startYmd && startYmd !== today ? [today, startYmd] : [today];
  const batches = await Promise.all(dates.map((date) => fetchMealsForDate(userId, date)));
  return latestHerbalifeShakeWithinWindow(batches.flat(), now);
}
