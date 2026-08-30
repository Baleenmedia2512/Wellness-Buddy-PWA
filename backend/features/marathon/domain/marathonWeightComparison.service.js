/**
 * Marathon Day 0 weight comparison — orchestration (profile read path).
 */
import { todayInTimezone } from '../../../shared/lib/datetime/index.js';
import * as weightRepo from '../../weight/weight.repository.js';
import { getMarathonWeightComparisonDates } from './marathonCalendar.js';
import { buildMarathonWeightComparison } from './marathonWeightComparison.js';

/**
 * @param {object} params
 * @param {number|string} params.userId
 * @param {string} params.timezoneIana
 * @param {string} [params.todayYmd] YYYY-MM-DD override (tests)
 * @returns {Promise<object|null>}
 */
export async function resolveMarathonWeightComparison({
  userId,
  timezoneIana,
  todayYmd = null,
}) {
  const today = todayYmd || todayInTimezone(timezoneIana);
  const dates = getMarathonWeightComparisonDates(today);
  if (!dates) return null;

  const [previousRow, currentRow] = await Promise.all([
    weightRepo.findLatestWeightOnCalendarDay(userId, dates.previousDay10Ymd, timezoneIana),
    weightRepo.findLatestWeightOnCalendarDay(userId, dates.currentDay0Ymd, timezoneIana),
  ]);

  if (!previousRow?.Weight || !currentRow?.Weight) return null;

  return buildMarathonWeightComparison({
    previousMarathonEndWeight: previousRow.Weight,
    currentMarathonDay0Weight: currentRow.Weight,
    previousDay10Ymd: dates.previousDay10Ymd,
    currentDay0Ymd: dates.currentDay0Ymd,
  });
}
