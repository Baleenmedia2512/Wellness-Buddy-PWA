import { useCallback, useEffect, useMemo, useState } from 'react';
import { getUserId } from '../../../shared/services/userIdentity';
import {
  getLatestActivityLogId,
  getWellnessScoreSnapshot,
  markWellnessScoreProcessed,
  setWellnessScoreSnapshot,
  shouldRefreshWellnessScore,
} from '../../../shared/services/homeDashboardActivity';
import { fetchWellnessScoreHistory } from '../services/wellnessScore.api';

function rangeKey(startDate, endDate) {
  return `${startDate || ''}__${endDate || ''}`;
}

function snapshotMatches({ snapshot, userId, startDate, endDate }) {
  if (!snapshot || !Array.isArray(snapshot.days)) return false;
  if (userId != null && snapshot.userId != null && String(snapshot.userId) !== String(userId)) {
    return false;
  }
  return snapshot.rangeKey === rangeKey(startDate, endDate);
}

/**
 * Loads wellness score history for a date range and exposes the selected day.
 *
 * Uses the shared async activity log (`homeDashboardActivity`): first open
 * fetches normally; reopen with no newer activity restores the in-memory
 * snapshot without a loading spinner; food/weight/etc. updates force a reload.
 */
export function useWellnessScoreHistory({
  user,
  apiBaseUrl,
  startDate,
  endDate,
  selectedDate,
  nutritionRefreshKey = 0,
}) {
  const cached = getWellnessScoreSnapshot();
  const canUseCacheOnMount = Boolean(
    cached
    && !shouldRefreshWellnessScore()
    && snapshotMatches({
      snapshot: cached,
      userId: user?.id,
      startDate,
      endDate,
    }),
  );

  const [loading, setLoading] = useState(!canUseCacheOnMount);
  const [error, setError] = useState(null);
  const [historyDays, setHistoryDays] = useState(() => (
    canUseCacheOnMount ? cached.days : []
  ));

  const reload = useCallback(async ({ force = false } = {}) => {
    if (!user || !startDate || !endDate) {
      setLoading(false);
      setHistoryDays([]);
      return;
    }

    const snapshot = getWellnessScoreSnapshot();
    const knownUserId = user.id || snapshot?.userId || null;

    // Async activity log gate: skip network + spinner when nothing changed
    // and we already have a snapshot for this user + date range.
    if (
      !force
      && !shouldRefreshWellnessScore()
      && snapshotMatches({
        snapshot,
        userId: knownUserId,
        startDate,
        endDate,
      })
    ) {
      setHistoryDays(snapshot.days);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    const activityLogAtFetch = getLatestActivityLogId();
    try {
      const userId = user.id || (await getUserId(user));
      if (!userId) throw new Error('Unable to resolve user');
      const result = await fetchWellnessScoreHistory({
        userId,
        startDate,
        endDate,
        apiBaseUrl,
      });
      const days = result?.days || [];
      setHistoryDays(days);
      setWellnessScoreSnapshot({
        userId,
        rangeKey: rangeKey(startDate, endDate),
        startDate,
        endDate,
        days,
        activityLogId: activityLogAtFetch,
      });
      markWellnessScoreProcessed(activityLogAtFetch);
    } catch (err) {
      setError(err?.message || 'Failed to load wellness score');
      setHistoryDays([]);
    } finally {
      setLoading(false);
    }
  }, [user, apiBaseUrl, startDate, endDate]);

  useEffect(() => {
    // Keep painted data while switching ranges only if refresh is required;
    // otherwise clear so we do not flash the wrong range briefly.
    if (shouldRefreshWellnessScore()) {
      setHistoryDays([]);
      setError(null);
      return;
    }
    const snapshot = getWellnessScoreSnapshot();
    if (!snapshotMatches({
      snapshot,
      userId: user?.id || snapshot?.userId,
      startDate,
      endDate,
    })) {
      setHistoryDays([]);
      setError(null);
    }
  }, [startDate, endDate, user?.id]);

  useEffect(() => {
    // Force when the requested window differs from the in-memory snapshot
    // (Yesterday → Today) or when newer activity exists. Same-window reopen
    // with a matching snapshot stays a soft reload.
    const snapshot = getWellnessScoreSnapshot();
    const rangeChanged = !snapshotMatches({
      snapshot,
      userId: user?.id,
      startDate,
      endDate,
    });
    reload({ force: rangeChanged || shouldRefreshWellnessScore() });
  }, [reload, user?.id, startDate, endDate]);

  useEffect(() => {
    if (nutritionRefreshKey === 0) return;
    if (!shouldRefreshWellnessScore()) return;
    reload({ force: true });
  }, [nutritionRefreshKey, reload]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      // Only refetch when a newer async activity log exists.
      if (shouldRefreshWellnessScore()) {
        reload({ force: true });
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [reload]);

  const selectedData = useMemo(() => {
    if (!historyDays.length || !selectedDate) return null;
    // Strict match only — never show Yesterday's row while Today is selected.
    return historyDays.find((d) => d.date === selectedDate) || null;
  }, [historyDays, selectedDate]);

  return { loading, error, historyDays, data: selectedData, reload: () => reload({ force: true }) };
}
