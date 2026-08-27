import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getUserId } from '../../../shared/services/userIdentity';
import {
  getLatestActivityLogId,
  getWellnessScoreSnapshot,
  markWellnessScoreProcessed,
  setWellnessScoreSnapshot,
  shouldRefreshWellnessScore,
  getActivityLogDebug,
} from '../../../shared/services/homeDashboardActivity';
import {
  fetchDailyWellnessScore,
  fetchWellnessScoreHistory,
} from '../services/wellnessScore.api';
import {
  getDailyWellnessScoreCached,
  setDailyWellnessScoreCached,
  subscribeDailyWellnessScoreSeed,
} from '../services/dailyWellnessScoreCache';
import {
  asHistoryDay,
  historyDaysForInstantPaint,
  isSingleDayRange,
  rangeKey,
  snapshotMatchesRange,
  selectHistoryDay,
} from '../domain/historyPaint';
import { shouldSkipWellnessScoreRefresh } from '../domain/skipWellnessScoreRefresh';

function resolvedHistoryUserId(user) {
  return user?.id || user?.UserId || user?.userId || null;
}

function instantPaintDays({ user, startDate, endDate, persistSnapshot = true }) {
  const userId = resolvedHistoryUserId(user);
  return historyDaysForInstantPaint({
    // Reports Nutrition (persistSnapshot=false) must not paint Home's
    // logged-in-user snapshot or daily cache when a downline is selected.
    snapshot: persistSnapshot ? getWellnessScoreSnapshot() : null,
    userId,
    startDate,
    endDate,
    dailyScore: (persistSnapshot && userId && isSingleDayRange(startDate, endDate))
      ? getDailyWellnessScoreCached(userId, endDate)
      : null,
  });
}

/**
 * Loads wellness score history for a date range and exposes the selected day.
 *
 * Uses the shared async activity log (`homeDashboardActivity`): first open
 * fetches normally; reopen with no newer activity restores the in-memory
 * snapshot without a loading spinner; food/weight/etc. updates force a reload.
 *
 * Today / Yesterday share Home's /daily request + cache so the sheet total
 * matches the carousel immediately (no extra /history round-trip).
 */
export function useWellnessScoreHistory({
  user,
  apiBaseUrl,
  startDate,
  endDate,
  selectedDate,
  nutritionRefreshKey = 0,
  persistSnapshot = true,
}) {
  const paintedOnMount = instantPaintDays({ user, startDate, endDate, persistSnapshot });
  const [loading, setLoading] = useState(paintedOnMount.length === 0);
  const [error, setError] = useState(null);
  const [historyDays, setHistoryDays] = useState(paintedOnMount);
  const requestIdRef = useRef(0);
  const historyDaysRef = useRef(paintedOnMount);

  const applyDays = useCallback((days) => {
    historyDaysRef.current = days;
    setHistoryDays(days);
  }, []);

  const reload = useCallback(async ({ force = false } = {}) => {
    if (!user || !startDate || !endDate) {
      setLoading(false);
      applyDays([]);
      return;
    }

    const snapshot = persistSnapshot ? getWellnessScoreSnapshot() : null;
    const knownUserId = resolvedHistoryUserId(user)
      || (persistSnapshot ? snapshot?.userId : null)
      || null;
    const singleDay = isSingleDayRange(startDate, endDate);
    const cachedDaily = (persistSnapshot && knownUserId && singleDay)
      ? getDailyWellnessScoreCached(knownUserId, endDate)
      : null;

    if (
      persistSnapshot
      && !force
      && !shouldRefreshWellnessScore()
      && snapshotMatchesRange({
        snapshot,
        userId: knownUserId,
        startDate,
        endDate,
      })
    ) {
      applyDays(snapshot.days);
      setError(null);
      setLoading(false);
      return;
    }

    // Home activity-log freshness is for the logged-in user only.
    // Reports Nutrition (persistSnapshot=false) must always fetch the
    // selected member so a coach's cached Today score is never reused.
    if (
      persistSnapshot
      && !force
      && cachedDaily
      && !shouldRefreshWellnessScore()
    ) {
      applyDays([asHistoryDay(cachedDaily, endDate)]);
      setError(null);
      setLoading(false);
      return;
    }

    const painted = persistSnapshot
      ? historyDaysForInstantPaint({
        snapshot,
        userId: knownUserId,
        startDate,
        endDate,
        dailyScore: cachedDaily,
      })
      : [];
    if (painted.length) {
      applyDays(painted);
      setLoading(false);
    } else {
      setLoading(true);
    }
    setError(null);

    const requestId = ++requestIdRef.current;
    const activityLogAtFetch = getLatestActivityLogId();
    try {
      const userId = resolvedHistoryUserId(user) || (await getUserId(user));
      if (!userId) throw new Error('Unable to resolve user');
      if (requestId !== requestIdRef.current) return;

      let days;
      if (singleDay) {
        const score = await fetchDailyWellnessScore({ userId, date: endDate, apiBaseUrl });
        const day = asHistoryDay(score, endDate);
        days = day ? [day] : [];
        if (day && persistSnapshot) setDailyWellnessScoreCached(userId, endDate, day);
      } else {
        const result = await fetchWellnessScoreHistory({
          userId,
          startDate,
          endDate,
          apiBaseUrl,
        });
        days = result?.days || [];
      }

      if (requestId !== requestIdRef.current) return;

      applyDays(days);
      if (persistSnapshot) {
        setWellnessScoreSnapshot({
          userId,
          rangeKey: rangeKey(startDate, endDate),
          startDate,
          endDate,
          days,
          activityLogId: activityLogAtFetch,
        });
        if (getLatestActivityLogId() === activityLogAtFetch) {
          markWellnessScoreProcessed(activityLogAtFetch);
        }
      }
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      setError(err?.message || 'Failed to load wellness score');
      if (!historyDaysRef.current.length) applyDays([]);
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [user, apiBaseUrl, startDate, endDate, applyDays, persistSnapshot]);

  useEffect(() => {
    const painted = instantPaintDays({ user, startDate, endDate, persistSnapshot });
    if (painted.length) {
      applyDays(painted);
      setError(null);
      return;
    }
    const current = historyDaysRef.current;
    const currentUserId = current[0]?.userId;
    const viewingUserId = resolvedHistoryUserId(user);
    const sameUser = viewingUserId != null && currentUserId != null
      && String(currentUserId) === String(viewingUserId);
    if (
      current.length
      && sameUser
      && isSingleDayRange(startDate, endDate)
      && current[0]?.date === endDate
    ) {
      return;
    }
    applyDays([]);
    setError(null);
  }, [startDate, endDate, user?.id, user?.userId, applyDays, persistSnapshot]);

  useEffect(() => {
    const snapshot = persistSnapshot ? getWellnessScoreSnapshot() : null;
    const rangeChanged = !persistSnapshot || !snapshotMatchesRange({
      snapshot,
      userId: user?.id,
      startDate,
      endDate,
    });
    const needsRefresh = shouldRefreshWellnessScore();
    const hasFreshDaily = Boolean(
      persistSnapshot
      && isSingleDayRange(startDate, endDate)
      && getDailyWellnessScoreCached(user?.id, endDate)
      && !needsRefresh,
    );
    // Home already painted Today via /daily — don't force a second compute
    // just because the sheet snapshot is empty on first open.
    reload({ force: (rangeChanged && !hasFreshDaily) || needsRefresh });
  }, [reload, user?.id, user?.userId, startDate, endDate, persistSnapshot]);

  useEffect(() => {
    if (!persistSnapshot) return undefined;
    return subscribeDailyWellnessScoreSeed(({ userId, date: seedDate, score }) => {
      const viewingUserId = resolvedHistoryUserId(user);
      if (!viewingUserId || String(viewingUserId) !== String(userId)) return;
      if (!isSingleDayRange(startDate, endDate)) return;
      if (String(seedDate) !== String(endDate)) return;
      const day = asHistoryDay(score, endDate);
      if (!day) return;
      const current = historyDaysRef.current[0];
      if (
        current
        && String(current.date) === String(day.date)
        && Number(current.totalEarned) === Number(day.totalEarned)
        && Number(current.totalPossible) === Number(day.totalPossible)
      ) {
        return;
      }
      applyDays([day]);
      setError(null);
      setLoading(false);
    });
  }, [user, startDate, endDate, applyDays, persistSnapshot]);

  const activityRefreshMounted = useRef(false);
  useEffect(() => {
    if (!activityRefreshMounted.current) {
      activityRefreshMounted.current = true;
      return;
    }
    if (nutritionRefreshKey === 0) return;
    if (shouldSkipWellnessScoreRefresh(getActivityLogDebug().lastSource)) return;
    reload({ force: true });
  }, [nutritionRefreshKey, reload]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      if (shouldRefreshWellnessScore()) {
        reload({ force: true });
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [reload]);

  const selectedData = useMemo(
    () => selectHistoryDay(historyDays, selectedDate),
    [historyDays, selectedDate],
  );

  return { loading, error, historyDays, data: selectedData, reload: () => reload({ force: true }) };
}
