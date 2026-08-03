import { useCallback, useEffect, useRef, useState } from 'react';
import { getUserId } from '../../../shared/services/userIdentity';
import { fetchDailyWellnessScore } from '../services/wellnessScore.api';

/**
 * Loads daily wellness score from the backend API.
 * Clears stale data when `date` changes and refetches on app resume.
 * When `nutritionRefreshKey` bumps (food/weight/camera saves), refetches in the
 * background so the home carousel score stays in sync with nutrition cards.
 */
export function useWellnessScore({ user, apiBaseUrl, date, nutritionRefreshKey = 0 }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  const reload = useCallback(async ({ background = false } = {}) => {
    if (!user) {
      setLoading(false);
      setData(null);
      return;
    }
    if (!background) setLoading(true);
    setError(null);
    try {
      const userId = user.id || (await getUserId(user));
      if (!userId) throw new Error('Unable to resolve user');
      const score = await fetchDailyWellnessScore({ userId, date, apiBaseUrl });
      setData(score);
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
    reload();
  }, [reload]);

  // Food/weight/camera saves bump nutritionRefreshKey via NutritionRefreshContext.
  const activityRefreshMounted = useRef(false);
  useEffect(() => {
    if (!activityRefreshMounted.current) {
      activityRefreshMounted.current = true;
      return;
    }
    reload({ background: true });
  }, [nutritionRefreshKey, reload]);

  // Foreground resume — pick up new IST day without requiring a full reload.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') reload();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [reload]);

  return { loading, error, data, reload };
}
