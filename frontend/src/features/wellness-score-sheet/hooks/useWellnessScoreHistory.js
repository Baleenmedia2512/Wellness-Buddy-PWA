import { useCallback, useEffect, useMemo, useState } from 'react';
import { getUserId } from '../../../shared/services/userIdentity';
import { fetchWellnessScoreHistory } from '../services/wellnessScore.api';

/**
 * Loads wellness score history for a date range and exposes the selected day.
 */
export function useWellnessScoreHistory({
  user,
  apiBaseUrl,
  startDate,
  endDate,
  selectedDate,
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [historyDays, setHistoryDays] = useState([]);

  const reload = useCallback(async () => {
    if (!user || !startDate || !endDate) {
      setLoading(false);
      setHistoryDays([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const userId = user.id || (await getUserId(user));
      if (!userId) throw new Error('Unable to resolve user');
      const result = await fetchWellnessScoreHistory({
        userId,
        startDate,
        endDate,
        apiBaseUrl,
      });
      setHistoryDays(result?.days || []);
    } catch (err) {
      setError(err?.message || 'Failed to load wellness score');
      setHistoryDays([]);
    } finally {
      setLoading(false);
    }
  }, [user, apiBaseUrl, startDate, endDate]);

  useEffect(() => {
    setHistoryDays([]);
    setError(null);
  }, [startDate, endDate]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') reload();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [reload]);

  const selectedData = useMemo(() => {
    if (!historyDays.length) return null;
    const match = historyDays.find((d) => d.date === selectedDate);
    return match || historyDays[historyDays.length - 1];
  }, [historyDays, selectedDate]);

  return { loading, error, historyDays, data: selectedData, reload };
}
