/**
 * useHomeCarouselData — period totals + goals for the home carousel.
 *
 * Single day: daily achieved vs daily goal.
 * Multi-day: period total achieved vs period total goal (daily goal × days in range).
 *
 * Speed: multi-day ranges use 2 batch APIs (meals + watch) instead of 2×N
 * per-day calls; results are cached so Today ↔ Last 10 Days is instant on revisit.
 * Meal rows for Top Contributing Foods load in the background after totals paint.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  fetchDayAnalyses,
  fetchWatchBurnedCalories,
  fetchRangeMealTotals,
  fetchRangeDayAnalyses,
  fetchWatchBurnedCaloriesRange,
} from '../services/nutritionDashboard';
import { computeDailyStatsFromAnalyses, EMPTY_DAILY_STATS } from '../domain/dailyStatsRules';
import {
  aggregateWellnessPeriodScore,
  getCarouselPeriodContext,
  sumDailyStatsForPeriod,
} from '../domain/carouselPeriodProgress';
import { enumerateDatesYmd, resolveWellnessDateRange, ymdToLocalDate } from '../../wellness-score-sheet/domain/dateRange';
import { scoreIsForDate } from '../../wellness-score-sheet/domain/historyPaint';
import { fetchDailyWellnessScore, fetchWellnessScoreHistory } from '../../wellness-score-sheet/services/wellnessScore.api';
import {
  getPinnedDailyWellnessScore,
  setDailyWellnessScoreCached,
  subscribeDailyWellnessScoreSeed,
} from '../../wellness-score-sheet/services/dailyWellnessScoreCache';
import {
  getLatestActivityLogId,
  getActivityLogDebug,
  markHomeDashboardProcessed,
  shouldRefreshHomeDashboard,
} from '../../../shared/services/homeDashboardActivity';
import { shouldSkipWellnessScoreRefresh } from '../../wellness-score-sheet/domain/skipWellnessScoreRefresh';
import {
  isCaptureFlowBusy,
  subscribeCaptureFlowBusy,
} from '../../../shared/services/captureFlowBusy';

const EMPTY_NUTRITION = {
  dailyStats: EMPTY_DAILY_STATS,
  burnedCalories: 0,
  analyses: [],
  mealDates: [],
  loggedDayCount: 0,
  dayCount: 1,
};

/** In-memory cache shared across remounts for the session. Key: `${userId}|${start}|${end}`. */
const rangeCache = new Map();

function cacheKey(userId, startDate, endDate) {
  return `${userId}|${startDate}|${endDate}`;
}

function wellnessForRange(score, range) {
  if (!score) return null;
  if (range.isMultiDay) return score;
  if (Number(score.dayCount) > 1) return null;
  if (score.date && !scoreIsForDate(score, range.endDate)) return null;
  return score;
}

function readCache(userId, startDate, endDate) {
  return rangeCache.get(cacheKey(userId, startDate, endDate)) || null;
}

function writeCache(userId, startDate, endDate, payload) {
  rangeCache.set(cacheKey(userId, startDate, endDate), payload);
}

/** Keep single-day carousel cache aligned with the sheet total. */
function patchRangeCacheWellness(userId, dateYmd, score) {
  if (userId == null || !dateYmd || !score) return;
  const key = cacheKey(userId, dateYmd, dateYmd);
  const existing = rangeCache.get(key);
  if (!existing) {
    rangeCache.set(key, { nutrition: EMPTY_NUTRITION, wellnessScore: score });
    return;
  }
  rangeCache.set(key, { ...existing, wellnessScore: score });
}

function dailyTotalsToStats(totals) {
  if (!totals || typeof totals !== 'object') return { ...EMPTY_DAILY_STATS };
  return {
    ...EMPTY_DAILY_STATS,
    ...totals,
    averageGlycemicIndex: totals.averageGlycemicIndex ?? null,
    mealCount: Number(totals.mealCount) || 0,
  };
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
    mealDates: stats.mealCount > 0 ? [dayYmd] : [],
    loggedDayCount: stats.mealCount > 0 ? 1 : 0,
    dayCount: 1,
  };
}

async function loadRangeNutrition({ apiBaseUrl, userId, startDate, endDate, dates }) {
  // Two range calls instead of 2×N per-day requests (Last 10 Days was ~20 HTTP).
  const [mealsResult, burnByDate] = await Promise.all([
    fetchRangeMealTotals({ apiBaseUrl, userId, startDate, endDate }),
    fetchWatchBurnedCaloriesRange({ apiBaseUrl, userId, startDate, endDate }),
  ]);

  const byDate = mealsResult.byDate || {};
  const dailyStatsList = dates.map((ymd) => dailyTotalsToStats(byDate[ymd]));
  const mealDates = dates.filter((ymd) => (byDate[ymd]?.mealCount ?? 0) > 0);
  const loggedDayCount = mealDates.length;
  const burnedCalories = dates.reduce(
    (sum, ymd) => sum + (Number(burnByDate?.[ymd]) || 0),
    0,
  );

  return {
    dailyStats: sumDailyStatsForPeriod(dailyStatsList),
    burnedCalories,
    // Totals paint first; meal rows load in background for Top Contributing Foods.
    analyses: [],
    mealDates,
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
  const [analysesLoading, setAnalysesLoading] = useState(false);
  const [nutrition, setNutrition] = useState(EMPTY_NUTRITION);
  const [wellnessScore, setWellnessScore] = useState(null);

  const requestIdRef = useRef(0);
  const lastUserIdRef = useRef(null);
  const resolvedUserIdRef = useRef(null);
  const loadDataRef = useRef(null);
  const rangeStamp = `${range.startDate}|${range.endDate}`;
  const rangeStampRef = useRef(rangeStamp);
  if (rangeStampRef.current !== rangeStamp) {
    rangeStampRef.current = rangeStamp;
    const uid = resolvedUserIdRef.current;
    const cached = uid ? readCache(uid, range.startDate, range.endDate) : null;
    if (cached) {
      setNutrition(cached.nutrition);
      setWellnessScore(wellnessForRange(cached.wellnessScore, range));
      setAnalysesLoading(
        range.isMultiDay
        && (cached.nutrition?.mealDates?.length || 0) > 0
        && !(cached.nutrition?.analyses?.length),
      );
    } else {
      setNutrition({ ...EMPTY_NUTRITION, dayCount: expectedDayCount });
      setWellnessScore(null);
      setAnalysesLoading(range.isMultiDay);
    }
  }

  const applyPayload = useCallback((payload) => {
    setNutrition(payload.nutrition);
    setWellnessScore(wellnessForRange(payload.wellnessScore, range));
  }, [range]);

  /** After multi-day totals paint, load meal rows for Top Contributing Foods. */
  const warmRangeAnalyses = useCallback(async ({
    requestId,
    userId,
    startDate,
    endDate,
    mealDates,
    wellnessScore: cachedWellness,
  }) => {
    if (!mealDates?.length) {
      setAnalysesLoading(false);
      return;
    }
    setAnalysesLoading(true);
    try {
      const { list } = await fetchRangeDayAnalyses({
        apiBaseUrl,
        userId,
        dates: mealDates,
      });
      if (requestId !== requestIdRef.current) return;

      setNutrition((prev) => {
        const nextNutrition = {
          ...prev,
          analyses: list,
          mealDates,
        };
        const existing = readCache(userId, startDate, endDate);
        writeCache(userId, startDate, endDate, {
          nutrition: nextNutrition,
          wellnessScore: existing?.wellnessScore ?? cachedWellness ?? null,
        });
        return nextNutrition;
      });
    } catch {
      // Breakdown warm is best-effort; rings already show correct totals.
    } finally {
      if (requestId === requestIdRef.current) setAnalysesLoading(false);
    }
  }, [apiBaseUrl]);

  const loadData = useCallback(async ({ force = false } = {}) => {
    if (!user) {
      setNutrition(EMPTY_NUTRITION);
      setWellnessScore(null);
      setAnalysesLoading(false);
      return;
    }

    const requestId = ++requestIdRef.current;
    const activityLogAtFetch = getLatestActivityLogId();
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
        setAnalysesLoading(false);
        return;
      }

      lastUserIdRef.current = userId;

      // Serve cache only when it is still fresh relative to the activity log.
      // If a newer activity exists, fall through and refetch — otherwise
      // Yesterday → Today can paint a stale Today payload forever.
      const cached = !force && !shouldRefreshHomeDashboard()
        ? readCache(userId, range.startDate, range.endDate)
        : null;
      if (cached) {
        applyPayload(cached);
        setLoading(false);
        markHomeDashboardProcessed(activityLogAtFetch);
        const needsWarm = range.isMultiDay
          && (cached.nutrition?.mealDates?.length || 0) > 0
          && !(cached.nutrition?.analyses?.length);
        if (needsWarm) {
          warmRangeAnalyses({
            requestId,
            userId,
            startDate: range.startDate,
            endDate: range.endDate,
            mealDates: cached.nutrition.mealDates,
            wellnessScore: cached.wellnessScore,
          });
        } else {
          setAnalysesLoading(false);
        }
        return;
      }

      // Uncached range: clear previous period numbers so we never flash wrong-day data.
      setNutrition(placeholderNutrition);
      setWellnessScore(null);
      setLoading(true);
      if (range.isMultiDay) setAnalysesLoading(true);

      const nutritionPromise = range.isMultiDay
        ? loadRangeNutrition({
          apiBaseUrl,
          userId,
          startDate: range.startDate,
          endDate: range.endDate,
          dates,
        }).catch(() => placeholderNutrition)
        : loadDayNutrition({ apiBaseUrl, userId, dayYmd: range.endDate }).catch(() => EMPTY_NUTRITION);

      const wellnessPromise = loadWellness({
        apiBaseUrl,
        userId,
        startDate: range.startDate,
        endDate: range.endDate,
        isMultiDay: range.isMultiDay,
      }).catch(() => null);

      // Nutrition + wellness in parallel (was sequential before).
      const [nextNutrition, nextWellnessRaw] = await Promise.all([nutritionPromise, wellnessPromise]);
      if (requestId !== requestIdRef.current) return;

      // Prefer sheet→Home pin for single-day so carousel matches the sheet total.
      let nextWellness = nextWellnessRaw;
      const pin = getPinnedDailyWellnessScore();
      if (
        !range.isMultiDay
        && pin
        && String(pin.userId) === String(userId)
        && String(pin.date) === String(range.endDate)
        && pin.activityLogId === getLatestActivityLogId()
      ) {
        nextWellness = pin.score;
      }

      const payload = { nutrition: nextNutrition, wellnessScore: nextWellness };

      // If food/AI finished while this request was in flight, a newer activity
      // log exists — paint what we have but do NOT mark Home processed or the
      // post-save refresh will be skipped and the main-page score stays stale.
      if (getLatestActivityLogId() !== activityLogAtFetch) {
        applyPayload(payload);
        queueMicrotask(() => {
          if (!shouldRefreshHomeDashboard() || isCaptureFlowBusy()) return;
          loadDataRef.current?.({ force: true });
        });
        return;
      }

      writeCache(userId, range.startDate, range.endDate, payload);
      applyPayload(payload);
      if (!range.isMultiDay && payload.wellnessScore) {
        setDailyWellnessScoreCached(userId, range.endDate, payload.wellnessScore);
      }
      markHomeDashboardProcessed(activityLogAtFetch);

      // Multi-day: rings already painted — load meal foods for contribution modal.
      if (range.isMultiDay) {
        warmRangeAnalyses({
          requestId,
          userId,
          startDate: range.startDate,
          endDate: range.endDate,
          mealDates: nextNutrition.mealDates,
          wellnessScore: nextWellness,
        });
      } else {
        setAnalysesLoading(false);
      }

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
            const wellness = wellnessForRange(wellnessWarm, yRange);
            writeCache(userId, yRange.startDate, yRange.endDate, {
              nutrition: nutritionWarm,
              wellnessScore: wellness,
            });
            if (wellness) setDailyWellnessScoreCached(userId, yRange.endDate, wellness);
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
    warmRangeAnalyses,
    today,
  ]);

  loadDataRef.current = loadData;

  // Range change: prefer cache (instant). Force refresh only when meals change.
  useEffect(() => {
    loadData({ force: false });
  }, [loadData]);

  // Sheet published today's (or yesterday's) score — keep Home carousel in sync.
  useEffect(() => {
    if (range.isMultiDay) return undefined;
    return subscribeDailyWellnessScoreSeed(({ userId, date: seedDate, score }) => {
      const uid = resolvedUserIdRef.current || lastUserIdRef.current;
      if (!uid || String(uid) !== String(userId)) return;
      if (String(seedDate) !== String(range.endDate)) return;
      patchRangeCacheWellness(uid, seedDate, score);
      setWellnessScore(score);
    });
  }, [range.isMultiDay, range.endDate]);

  const invalidateUserRangeCache = useCallback(() => {
    const userId = lastUserIdRef.current || resolvedUserIdRef.current;
    if (!userId) return;
    for (const key of [...rangeCache.keys()]) {
      if (key.startsWith(`${userId}|`)) rangeCache.delete(key);
    }
  }, []);

  /**
   * @param {{ force?: boolean }} [opts]
   * force=true: always refetch (nutritionRefreshKey bump is intentional).
   * force=false: only when activity watermark is dirty (busy-clear retry).
   */
  const refreshAfterActivity = useCallback((opts = {}) => {
    const { force = false } = opts;
    if (!force && !shouldRefreshHomeDashboard()) return;
    invalidateUserRangeCache();
    // Do not compete with POST /captures while Manual Log is opening — cache is
    // already dropped so the retry below (or next key bump) cannot serve stale.
    if (isCaptureFlowBusy()) return;
    loadData({ force: true });
  }, [invalidateUserRangeCache, loadData]);

  useEffect(() => {
    if (nutritionRefreshKey === 0) return;
    if (shouldSkipWellnessScoreRefresh(getActivityLogDebug().lastSource)) return;
    // Key bump always means a mutation completed — never skip via watermark.
    // (Watermark race with capture-ai-started used to swallow capture-food-saved.)
    refreshAfterActivity({ force: true });
  }, [nutritionRefreshKey]); // eslint-disable-line react-hooks/exhaustive-deps -- only on meal refresh

  // When capture upload finishes, retry any refresh skipped while busy.
  useEffect(() => {
    return subscribeCaptureFlowBusy((busy) => {
      if (busy) return;
      refreshAfterActivity({ force: false });
    });
  }, [refreshAfterActivity]);

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
    analysesLoading,
    dailyStats: nutrition.dailyStats,
    burnedCalories,
    wellnessScore: wellnessForRange(wellnessScore, range),
    wellnessLoading: loading,
    nutritionLoading: loading,
    periodContext,
    wellnessSubtitle,
  };
}
