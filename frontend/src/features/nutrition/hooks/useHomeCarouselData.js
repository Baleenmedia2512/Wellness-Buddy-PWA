/**
 * useHomeCarouselData — period totals + goals for the home carousel.
 *
 * Single day: daily achieved vs daily goal.
 * Multi-day: period total achieved vs period total goal (daily goal × days in range).
 *
 * Speed: all network work for a range runs in parallel; results are cached by
 * range so Today ↔ Yesterday / Last 10 Days switches are instant on revisit.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchDayAnalyses, fetchWatchBurnedCalories } from '../services/nutritionDashboard';
import { computeDailyStatsFromAnalyses, EMPTY_DAILY_STATS } from '../domain/dailyStatsRules';
import {
  aggregateWellnessPeriodScore,
  getCarouselPeriodContext,
  sumDailyStatsForPeriod,
} from '../domain/carouselPeriodProgress';
import { enumerateDatesYmd, resolveWellnessDateRange, ymdToLocalDate } from '../../wellness-score-sheet/domain/dateRange';
import { fetchDailyWellnessScore, fetchWellnessScoreHistory } from '../../wellness-score-sheet/services/wellnessScore.api';
import {
  getLatestActivityLogId,
  markHomeDashboardProcessed,
  markWellnessScoreProcessed,
  shouldRefreshHomeDashboard,
} from '../../../shared/services/homeDashboardActivity';

const EMPTY_NUTRITION = {
  dailyStats: EMPTY_DAILY_STATS,
  burnedCalories: 0,
  analyses: [],
  loggedDayCount: 0,
  dayCount: 1,
};

/** In-memory cache shared across remounts for the session. Key: `${userId}|${start}|${end}`. */
const rangeCache = new Map();

function cacheKey(userId, startDate, endDate) {
  return `${userId}|${startDate}|${endDate}`;
}

function readCache(userId, startDate, endDate) {
  return rangeCache.get(cacheKey(userId, startDate, endDate)) || null;
}

function writeCache(userId, startDate, endDate, payload) {
  rangeCache.set(cacheKey(userId, startDate, endDate), payload);
}

async function loadDayNutrition({ apiBaseUrl, userId, dayYmd }) {
  const [dayResult, burned] = await Promise.all([
    fetchDayAnalyses({ apiBaseUrl, userId, date: dayYmd }),
    fetchWatchBurnedCalories({ apiBaseUrl, userId, date: dayYmd }),
  ]);
  const stats = computeDailyStatsFromAnalyses(dayResult.list);
  return {
    dailyStats: stats,
    burnedCalories: burned,
    analyses: dayResult.list || [],
    loggedDayCount: stats.mealCount > 0 ? 1 : 0,
    dayCount: 1,
  };
}

async function loadRangeNutrition({ apiBaseUrl, userId, dates }) {
  // One parallel wave: every day's meals + burned calories together (not two sequential waves).
  const dayPayloads = await Promise.all(
    dates.map(async (ymd) => {
      const [dayResult, burned] = await Promise.all([
        fetchDayAnalyses({ apiBaseUrl, userId, date: ymd }),
        fetchWatchBurnedCalories({ apiBaseUrl, userId, date: ymd }),
      ]);
      return {
        list: dayResult.list || [],
        stats: computeDailyStatsFromAnalyses(dayResult.list),
        burned,
      };
    }),
  );

  const dailyStatsList = dayPayloads.map((d) => d.stats);
  const loggedDayCount = dailyStatsList.filter((stats) => (stats.mealCount ?? 0) > 0).length;

  return {
    dailyStats: sumDailyStatsForPeriod(dailyStatsList),
    burnedCalories: dayPayloads.reduce((sum, d) => sum + d.burned, 0),
    analyses: dayPayloads.flatMap((d) => d.list),
    loggedDayCount,
    dayCount: dates.length,
  };
}

async function loadWellness({ apiBaseUrl, userId, startDate, endDate, isMultiDay }) {
  if (!isMultiDay) {
    return fetchDailyWellnessScore({ userId, date: endDate, apiBaseUrl });
  }
  const wellnessResult = await fetchWellnessScoreHistory({
    userId,
    startDate,
    endDate,
    apiBaseUrl,
  });
  return aggregateWellnessPeriodScore(wellnessResult?.days || []);
}

export function useHomeCarouselData({
  user,
  apiBaseUrl,
  resolveUserId,
  nutritionRefreshKey = 0,
  watchBurnedCalories = 0,
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

  const expectedDayCount = useMemo(
    () => enumerateDatesYmd(range.startDate, range.endDate).length,
    [range.startDate, range.endDate],
  );

  const [loading, setLoading] = useState(false);
  const [nutrition, setNutrition] = useState(EMPTY_NUTRITION);
  const [wellnessScore, setWellnessScore] = useState(null);

  const requestIdRef = useRef(0);
  const lastUserIdRef = useRef(null);
  const resolvedUserIdRef = useRef(null);

  const applyPayload = useCallback((payload) => {
    setNutrition(payload.nutrition);
    setWellnessScore(payload.wellnessScore);
  }, []);

  const loadData = useCallback(async ({ force = false } = {}) => {
    if (!user) {
      setNutrition(EMPTY_NUTRITION);
      setWellnessScore(null);
      return;
    }

    const requestId = ++requestIdRef.current;
    const dates = enumerateDatesYmd(range.startDate, range.endDate);
    const placeholderNutrition = { ...EMPTY_NUTRITION, dayCount: dates.length };

    try {
      // Resolve userId once and reuse — avoids an extra await on every range tap.
      let userId = resolvedUserIdRef.current;
      if (!userId) {
        setLoading(true);
        userId = await resolveUserId();
        if (requestId !== requestIdRef.current) return;
        if (userId) resolvedUserIdRef.current = userId;
      }

      if (!userId) {
        setNutrition(EMPTY_NUTRITION);
        setWellnessScore(null);
        return;
      }

      lastUserIdRef.current = userId;

      const cached = !force ? readCache(userId, range.startDate, range.endDate) : null;
      if (cached) {
        applyPayload(cached);
        setLoading(false);
        const activityLogId = getLatestActivityLogId();
        markHomeDashboardProcessed(activityLogId);
        markWellnessScoreProcessed(activityLogId);
        return;
      }

      // Uncached range: clear previous period numbers so we never flash wrong-day data.
      setNutrition(placeholderNutrition);
      setWellnessScore(null);
      setLoading(true);

      const nutritionPromise = range.isMultiDay
        ? loadRangeNutrition({ apiBaseUrl, userId, dates }).catch(() => placeholderNutrition)
        : loadDayNutrition({ apiBaseUrl, userId, dayYmd: range.endDate }).catch(() => EMPTY_NUTRITION);

      const wellnessPromise = loadWellness({
        apiBaseUrl,
        userId,
        startDate: range.startDate,
        endDate: range.endDate,
        isMultiDay: range.isMultiDay,
      }).catch(() => null);

      // Nutrition + wellness in parallel (was sequential before).
      const [nextNutrition, nextWellness] = await Promise.all([nutritionPromise, wellnessPromise]);
      if (requestId !== requestIdRef.current) return;

      const payload = { nutrition: nextNutrition, wellnessScore: nextWellness };
      writeCache(userId, range.startDate, range.endDate, payload);
      applyPayload(payload);
      const activityLogId = getLatestActivityLogId();
      markHomeDashboardProcessed(activityLogId);
      markWellnessScoreProcessed(activityLogId);

      // Warm Yesterday after Today so the common switch is cache-hit instant.
      if (!range.isMultiDay && range.endDate === today) {
        const yRange = resolveWellnessDateRange({ preset: 'yesterday', today });
        if (!readCache(userId, yRange.startDate, yRange.endDate)) {
          Promise.all([
            loadDayNutrition({ apiBaseUrl, userId, dayYmd: yRange.endDate }),
            loadWellness({
              apiBaseUrl,
              userId,
              startDate: yRange.startDate,
              endDate: yRange.endDate,
              isMultiDay: false,
            }).catch(() => null),
          ]).then(([nutritionWarm, wellnessWarm]) => {
            writeCache(userId, yRange.startDate, yRange.endDate, {
              nutrition: nutritionWarm,
              wellnessScore: wellnessWarm,
            });
          }).catch(() => { /* prefetch is best-effort */ });
        }
      }
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [
    user,
    range.startDate,
    range.endDate,
    range.isMultiDay,
    apiBaseUrl,
    resolveUserId,
    applyPayload,
    today,
  ]);

  // Range change: prefer cache (instant). Force refresh only when meals change.
  useEffect(() => {
    loadData({ force: false });
  }, [loadData]);

  useEffect(() => {
    if (nutritionRefreshKey === 0) return;
    // Tab switch alone bumps nothing useful — only refetch after real activity.
    if (!shouldRefreshHomeDashboard()) return;
    const userId = lastUserIdRef.current || resolvedUserIdRef.current;
    if (userId) {
      // Drop cached ranges so the next load (and siblings) see fresh meals.
      for (const key of [...rangeCache.keys()]) {
        if (key.startsWith(`${userId}|`)) rangeCache.delete(key);
      }
    }
    loadData({ force: true });
  }, [nutritionRefreshKey]); // eslint-disable-line react-hooks/exhaustive-deps -- only on meal refresh

  const periodContext = useMemo(
    () => getCarouselPeriodContext({
      preset: dateRange,
      isMultiDay: range.isMultiDay,
      dayCount: expectedDayCount,
      loggedDayCount: loading ? 0 : nutrition.loggedDayCount,
      startDate: range.startDate,
      endDate: range.endDate,
      today,
    }),
    [
      dateRange,
      range.isMultiDay,
      range.startDate,
      range.endDate,
      expectedDayCount,
      loading,
      nutrition.loggedDayCount,
      today,
    ],
  );

  const wellnessSubtitle = useMemo(() => {
    if (periodContext.isMultiDay) return `${periodContext.achievedLabel} vs ${periodContext.goalLabel}`;
    if (dateRange === 'yesterday') return "Yesterday's track";
    return "Today's track";
  }, [periodContext, dateRange]);

  // Optimistic watch burn from a just-uploaded screenshot (before DB round-trip).
  const burnedCalories = useMemo(() => {
    if (!watchBurnedCalories || watchBurnedCalories <= 0) return nutrition.burnedCalories;
    if (range.isMultiDay || range.endDate !== today) return nutrition.burnedCalories;
    return Math.max(nutrition.burnedCalories, watchBurnedCalories);
  }, [
    nutrition.burnedCalories,
    watchBurnedCalories,
    range.endDate,
    range.isMultiDay,
    today,
  ]);

  return {
    isMultiDay: periodContext.isMultiDay,
    rangeKey: range.isMultiDay ? `${range.startDate}_${range.endDate}` : range.endDate,
    selectedDate,
    analyses: nutrition.analyses,
    dailyStats: nutrition.dailyStats,
    burnedCalories,
    wellnessScore,
    wellnessLoading: loading,
    nutritionLoading: loading,
    periodContext,
    wellnessSubtitle,
  };
}
