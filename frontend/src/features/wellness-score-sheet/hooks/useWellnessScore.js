import { useCallback, useEffect, useState } from 'react';
import { getUserId } from '../../../shared/services/userIdentity';
import { fetchDailyWellnessScore } from '../services/wellnessScore.api';

/**
 * Loads daily wellness score from the backend API.
 */
export function useWellnessScore({ user, apiBaseUrl, date }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  const reload = useCallback(async () => {
    if (!user) {
      setLoading(false);
      setData(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const userId = user.id || (await getUserId(user));
      if (!userId) throw new Error('Unable to resolve user');
      const score = await fetchDailyWellnessScore({ userId, date, apiBaseUrl });
      setData(score);
    } catch (err) {
      setError(err?.message || 'Failed to load wellness score');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [user, apiBaseUrl, date]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { loading, error, data, reload };
}
