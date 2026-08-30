/**
 * Marathon Day 0 weight comparison — orchestration (profile read path).
 */
import { todayInTimezone } from '../../../shared/lib/datetime/index.js';
import * as weightRepo from '../../weight/weight.repository.js';
import { getMarathonWeightComparisonDates } from './marathonCalendar.js';
import {
  buildMarathonWeightComparison,
  isValidMarathonWeightKg,
  roundMarathonWeightKg,
} from './marathonWeightComparison.js';

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
  currentMarathonDay0WeightOverride = null,
}) {
  const today = todayYmd || todayInTimezone(timezoneIana);
  const dates = getMarathonWeightComparisonDates(today);
  if (!dates) return null;

  const [previousRow, currentRow] = await Promise.all([
    weightRepo.findLatestWeightOnCalendarDay(userId, dates.previousDay10Ymd, timezoneIana),
    weightRepo.findLatestWeightOnCalendarDay(userId, dates.currentDay0Ymd, timezoneIana),
  ]);

  const previousWeight = previousRow?.Weight;
  if (!isValidMarathonWeightKg(previousWeight)) return null;

  const currentWeight = currentMarathonDay0WeightOverride ?? currentRow?.Weight;
  if (!isValidMarathonWeightKg(currentWeight)) {
    return {
      previousMarathonEndWeight: roundMarathonWeightKg(Number(previousWeight)),
      partial: true,
      previousDay10Ymd: dates.previousDay10Ymd,
      currentDay0Ymd: dates.currentDay0Ymd,
    };
  }

  return buildMarathonWeightComparison({
    previousMarathonEndWeight: previousWeight,
    currentMarathonDay0Weight: currentWeight,
    previousDay10Ymd: dates.previousDay10Ymd,
    currentDay0Ymd: dates.currentDay0Ymd,
  });
}
