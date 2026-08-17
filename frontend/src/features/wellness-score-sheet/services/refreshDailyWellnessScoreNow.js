/**
 * Kick /daily immediately after a food/weight/education save so Home + sheet
 * paint from the seed without waiting on React refreshKey / startTransition.
 */
import {
  todayBusinessDate,
  DEFAULT_BUSINESS_TIMEZONE,
  resolveBusinessTimezone,
} from '../../../shared/utils/datetimeUtils';
import { fetchDailyWellnessScore } from './wellnessScore.api';
import { seedDailyWellnessScoreCache } from './dailyWellnessScoreCache';

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
