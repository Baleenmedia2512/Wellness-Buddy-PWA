/**
 * Marathon weight progress — orchestration (profile + share read path).
 */
import { todayInTimezone } from '../../../shared/lib/datetime/index.js';
import * as weightRepo from '../../weight/weight.repository.js';
import {
  getMarathonCalendarState,
  getMarathonGapComparisonDates,
  getMarathonWeightComparisonDates,
  listMarathonDayYmds,
} from './marathonCalendar.js';
import {
  buildMarathonGapProgress,
  buildMarathonRunningProgress,
  isValidMarathonWeightKg,
} from './marathonWeightComparison.js';

/**
 * @param {object} params
 * @param {number|string} params.userId
 * @param {string} params.timezoneIana
 * @param {string} [params.todayYmd] YYYY-MM-DD override (tests)
 * @param {number|null} [params.currentWeightOverride] share-time weight override
 * @returns {Promise<object|null>}
 */
export async function resolveMarathonWeightProgress({
  userId,
  timezoneIana,
  todayYmd = null,
  currentWeightOverride = null,
}) {
  const today = todayYmd || todayInTimezone(timezoneIana);
  const state = getMarathonCalendarState(today);
  const runningDates = getMarathonWeightComparisonDates(today);

  if (runningDates && state.inMarathon && state.marathonDay != null) {
    const dayYmds = listMarathonDayYmds(runningDates.currentDay0Ymd);
    const [previousRow, ...rows] = await Promise.all([
      weightRepo.findLatestWeightOnOrBeforeCalendarDay(
        userId,
        runningDates.previousDay10Ymd,
        timezoneIana,
      ),
      ...dayYmds.map((ymd) => weightRepo.findLatestWeightOnCalendarDay(userId, ymd, timezoneIana)),
    ]);

    /** @type {Record<number, unknown>} */
    const weightsByDay = {};
    rows.forEach((row, day) => {
      weightsByDay[day] = row?.Weight ?? null;
    });

    if (currentWeightOverride != null && isValidMarathonWeightKg(currentWeightOverride)) {
      weightsByDay[state.marathonDay] = currentWeightOverride;
    }

    return buildMarathonRunningProgress({
      currentDay0Ymd: runningDates.currentDay0Ymd,
      marathonNumber: runningDates.marathonNumber,
      currentMarathonDay: state.marathonDay,
      dayYmds,
      weightsByDay,
      previousMarathonEndWeight: previousRow?.Weight ?? null,
      previousDay10Ymd: runningDates.previousDay10Ymd,
    });
  }

  const gapDates = getMarathonGapComparisonDates(today);
  if (!gapDates) return null;

  const [previousRow, latestRow] = await Promise.all([
    weightRepo.findLatestWeightOnOrBeforeCalendarDay(userId, gapDates.previousDay10Ymd, timezoneIana),
    weightRepo.findPreviousEntry(userId),
  ]);

  const previousWeight = previousRow?.Weight ?? null;
  const currentWeight = currentWeightOverride ?? latestRow?.Weight ?? null;

  return buildMarathonGapProgress({
    previousMarathonEndWeight: previousWeight,
    currentWeight,
    previousDay10Ymd: gapDates.previousDay10Ymd,
    upcomingDay0Ymd: gapDates.upcomingDay0Ymd,
    upcomingMarathonNumber: gapDates.upcomingMarathonNumber,
  });
}

/**
 * Backward-compatible alias used by profile and marathon-comparison API.
 * @param {object} params
 * @returns {Promise<object|null>}
 */
export async function resolveMarathonWeightComparison({
  userId,
  timezoneIana,
  todayYmd = null,
  currentMarathonDay0WeightOverride = null,
}) {
  return resolveMarathonWeightProgress({
    userId,
    timezoneIana,
    todayYmd,
    currentWeightOverride: currentMarathonDay0WeightOverride,
  });
}
