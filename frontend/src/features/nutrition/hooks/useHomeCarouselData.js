/**
 * useHomeCarouselData — period totals + goals for the home carousel.
 *
 * Single day: daily achieved vs daily goal.
 * Multi-day: period total achieved vs period total goal (daily goal × days in range).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchDayAnalyses, fetchWatchBurnedCalories } from '../services/nutritionDashboard';
import { computeDailyStatsFromAnalyses, EMPTY_DAILY_STATS } from '../domain/dailyStatsRules';
import {
  aggregateWellnessPeriodScore,
  getCarouselPeriodContext,
  sumDailyStatsForPeriod,
} from '../domain/carouselPeriodProgress';
import { enumerateDatesYmd, resolveWellnessDateRange, ymdToLocalDate } from '../../wellness-score-sheet/domain/dateRange';
import { fetchDailyWellnessScore, fetchWellnessScoreHistory } from '../../wellness-score-sheet/services/wellnessScore.api';

async function loadRangeNutrition({ apiBaseUrl, userId, dates }) {
  const dayResults = await Promise.all(
    dates.map((ymd) => fetchDayAnalyses({ apiBaseUrl, userId, date: ymd })),
  );

  const dailyStatsList = dayResults.map((result) => computeDailyStatsFromAnalyses(result.list));
  const loggedDayCount = dailyStatsList.filter((stats) => (stats.mealCount ?? 0) > 0).length;

  const burnedValues = await Promise.all(
    dates.map((ymd) => fetchWatchBurnedCalories({ apiBaseUrl, userId, date: ymd })),
  );

  return {
    dailyStats: sumDailyStatsForPeriod(dailyStatsList),
    burnedCalories: burnedValues.reduce((sum, v) => sum + v, 0),
    analyses: dayResults.flatMap((result) => result.list || []),
    loggedDayCount,
    dayCount: dates.length,
  };
}

export function useHomeCarouselData({
  user,
  apiBaseUrl,
  resolveUserId,
  nutritionRefreshKey = 0,
  dateRange = 'today',
  customStartDate = null,
  customEndDate = null,
  today,
}) {
  const range = useMemo(
    () => resolveWellnessDateRange({
      preset: dateRange,
      customStartDate,
      customEndDate,
      today,
    }),
    [dateRange, customStartDate, customEndDate, today],
  );

  const selectedDate = useMemo(
    () => ymdToLocalDate(range.endDate),
    [range.endDate],
  );

  const [loading, setLoading] = useState(false);
  const [nutrition, setNutrition] = useState({
    dailyStats: EMPTY_DAILY_STATS,
    burnedCalories: 0,
    analyses: [],
    loggedDayCount: 0,
    dayCount: 1,
  });
  const [wellnessScore, setWellnessScore] = useState(null);

  const loadData = useCallback(async () => {
    if (!user) {
      setNutrition({
        dailyStats: EMPTY_DAILY_STATS,
        burnedCalories: 0,
        analyses: [],
        loggedDayCount: 0,
        dayCount: 1,
      });
      setWellnessScore(null);
      return;
    }

    setLoading(true);
    try {
      const userId = await resolveUserId();
      if (!userId) {
        setNutrition({
          dailyStats: EMPTY_DAILY_STATS,
          burnedCalories: 0,
          analyses: [],
          loggedDayCount: 0,
          dayCount: 1,
        });
        setWellnessScore(null);
        return;
      }

      const dates = enumerateDatesYmd(range.startDate, range.endDate);

      if (!range.isMultiDay) {
        const dayYmd = range.endDate;
        let nextNutrition = {
          dailyStats: EMPTY_DAILY_STATS,
          burnedCalories: 0,
          analyses: [],
          loggedDayCount: 0,
          dayCount: 1,
        };

        try {
          const [dayResult, burned] = await Promise.all([
            fetchDayAnalyses({ apiBaseUrl, userId, date: dayYmd }),
            fetchWatchBurnedCalories({ apiBaseUrl, userId, date: dayYmd }),
          ]);
          const stats = computeDailyStatsFromAnalyses(dayResult.list);
          nextNutrition = {
            dailyStats: stats,
            burnedCalories: burned,
            analyses: dayResult.list || [],
            loggedDayCount: stats.mealCount > 0 ? 1 : 0,
            dayCount: 1,
          };
        } catch {
          // keep empty nutrition
        }

        setNutrition(nextNutrition);

        try {
          const wellness = await fetchDailyWellnessScore({ userId, date: dayYmd, apiBaseUrl });
          setWellnessScore(wellness);
        } catch {
          setWellnessScore(null);
        }
        return;
      }

      let nextNutrition = {
        dailyStats: EMPTY_DAILY_STATS,
        burnedCalories: 0,
        analyses: [],
        loggedDayCount: 0,
        dayCount: dates.length,
      };

      try {
        nextNutrition = await loadRangeNutrition({ apiBaseUrl, userId, dates });
      } catch {
        // keep empty nutrition
      }

      setNutrition(nextNutrition);

      try {
        const wellnessResult = await fetchWellnessScoreHistory({
          userId,
          startDate: range.startDate,
          endDate: range.endDate,
          apiBaseUrl,
        });
        setWellnessScore(aggregateWellnessPeriodScore(wellnessResult?.days || []));
      } catch {
        setWellnessScore(null);
      }
    } finally {
      setLoading(false);
    }
  }, [
    user,
    range.startDate,
    range.endDate,
    range.isMultiDay,
    apiBaseUrl,
    resolveUserId,
  ]);

  useEffect(() => {
    loadData();
  }, [loadData, nutritionRefreshKey]);

  const periodContext = useMemo(
    () => getCarouselPeriodContext({
      preset: dateRange,
      isMultiDay: range.isMultiDay,
      dayCount: nutrition.dayCount,
      loggedDayCount: nutrition.loggedDayCount,
      startDate: range.startDate,
      endDate: range.endDate,
      today,
    }),
    [
      dateRange,
      range.isMultiDay,
      range.startDate,
      range.endDate,
      nutrition.dayCount,
      nutrition.loggedDayCount,
      today,
    ],
  );

  const wellnessSubtitle = useMemo(() => {
    if (periodContext.isMultiDay) return `${periodContext.achievedLabel} vs ${periodContext.goalLabel}`;
    if (dateRange === 'yesterday') return "Yesterday's track";
    return "Today's track";
  }, [periodContext, dateRange]);

  return {
    isMultiDay: periodContext.isMultiDay,
    rangeKey: range.isMultiDay ? `${range.startDate}_${range.endDate}` : range.endDate,
    selectedDate,
    analyses: nutrition.analyses,
    dailyStats: nutrition.dailyStats,
    burnedCalories: nutrition.burnedCalories,
    wellnessScore,
    wellnessLoading: loading,
    nutritionLoading: loading,
    periodContext,
    wellnessSubtitle,
  };
}
