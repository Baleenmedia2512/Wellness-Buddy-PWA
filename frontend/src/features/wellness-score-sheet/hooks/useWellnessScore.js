import { useCallback, useEffect, useRef, useState } from 'react';
import { getUserId } from '../../../shared/services/userIdentity';
import {
  getLatestActivityLogId,
  markWellnessScoreProcessed,
  shouldRefreshWellnessScore,
} from '../../../shared/services/homeDashboardActivity';
import { fetchDailyWellnessScore } from '../services/wellnessScore.api';

/** Session cache for daily score — survives Home remounts without a network hit. */
const dailyScoreCache = new Map();

function dailyKey(userId, date) {
  return `${userId || ''}|${date || ''}`;
}

/**
 * Loads daily wellness score from the backend API.
 *
 * Refetch rules (matches Home activity log):
 * - First load / date change → fetch
 * - `nutritionRefreshKey` bump after AI analysis / manual log / meal save → fetch
 * - Tab switch / app resume with no new activity → keep cached score (no API call)
 */
export function useWellnessScore({ user, apiBaseUrl, date, nutritionRefreshKey = 0 }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const userIdRef = useRef(null);

  const reload = useCallback(async ({ background = false, force = false } = {}) => {
    if (!user) {
      setLoading(false);
      setData(null);
      return;
    }

    try {
      const userId = user.id || userIdRef.current || (await getUserId(user));
      if (!userId) throw new Error('Unable to resolve user');
      userIdRef.current = userId;

      const key = dailyKey(userId, date);
      const cached = dailyScoreCache.get(key);

      // Skip network when nothing dashboard-affecting happened since last fetch.
      if (!force && cached && !shouldRefreshWellnessScore()) {
        setData(cached);
        setError(null);
        setLoading(false);
        return;
      }

      // Paint seeded/cached score immediately on forced refresh (sheet → Home sync)
      // so Home does not keep an older total while /daily is in flight.
      if (force && cached) {
        setData(cached);
      }

      if (!background) setLoading(true);
      setError(null);

      const activityLogAtFetch = getLatestActivityLogId();
      const score = await fetchDailyWellnessScore({ userId, date, apiBaseUrl });
      dailyScoreCache.set(key, score);
      setData(score);

      // Only mark processed if nothing newer landed mid-fetch (food-save race).
      if (getLatestActivityLogId() === activityLogAtFetch) {
        markWellnessScoreProcessed(activityLogAtFetch);
      }
    } catch (err) {
      setError(err?.message || 'Failed to load wellness score');
      if (!background) setData(null);
    } finally {
      if (!background) setLoading(false);
    }
  }, [user, apiBaseUrl, date]);

  // Drop yesterday's payload as soon as the IST date rolls over.
  useEffect(() => {
    setData(null);
    setError(null);
  }, [date]);

  useEffect(() => {
    reload({ force: shouldRefreshWellnessScore() });
  }, [reload]);

  // Food/weight/camera / manual log bump nutritionRefreshKey via NutritionRefreshContext.
  const activityRefreshMounted = useRef(false);
  useEffect(() => {
    if (!activityRefreshMounted.current) {
      activityRefreshMounted.current = true;
      return;
    }
    // Drop session cache before refetch so we never paint a pre-save total
    // while /daily is in flight (invalidate is otherwise unused on save paths).
    invalidateDailyWellnessScoreCache();
    // Always refetch on key bump — do not gate on shouldRefreshWellnessScore().
    // The sheet may have already marked wellness processed while Home was stale.
    reload({ background: true, force: true });
  }, [nutritionRefreshKey, reload]);

  // Foreground resume — only refetch when a newer async activity log exists.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      if (!shouldRefreshWellnessScore()) return;
      reload({ background: true, force: true });
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [reload]);

  return { loading, error, data, reload: () => reload({ force: true }) };
}

/** Seed / replace the session daily-score cache (e.g. sync from score sheet → Home). */
export function seedDailyWellnessScoreCache(userId, date, score) {
  if (userId == null || !date || !score) return;
  dailyScoreCache.set(dailyKey(userId, date), score);
}

export function invalidateDailyWellnessScoreCache(userId, date) {
  if (userId == null || !date) {
    dailyScoreCache.clear();
    return;
  }
  dailyScoreCache.delete(dailyKey(userId, date));
}
