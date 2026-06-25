/**
 * useCalorieTrend — multi-day calorie totals for the trend chart.
 *
 * Wraps fetchCalorieTrend(). Re-fetches whenever the user, selected date,
 * or trend window changes. Also exposes a brief mount/show animation toggle
 * for the trend card (showTrendCard goes false → true on data change).
 */
import { useState, useEffect, useCallback } from 'react';
import { fetchCalorieTrend } from '../services/nutritionDashboard';

export function useCalorieTrend({
  user,
  selectedDate,
  trendRangeDays,
  apiBaseUrl,
  resolveUserId,
  calorieTarget,
}) {
  const [calorieTrendData, setCalorieTrendData] = useState([]);
  const [trendLoading, setTrendLoading] = useState(false);
  const [showTrendCard, setShowTrendCard] = useState(false);

  const refetch = useCallback(
    async (days) => {
      if (!user) return;
      setTrendLoading(true);
      try {
        const userId = await resolveUserId();
        if (!userId) {
          setCalorieTrendData([]);
          return;
        }
        const data = await fetchCalorieTrend({
          apiBaseUrl,
          userId,
          selectedDate,
          days,
          calorieTarget,
        });
        setCalorieTrendData(data);
      } catch (err) {
        console.error('[useCalorieTrend] Failed to fetch calorie trend:', err);
        setCalorieTrendData([]);
      } finally {
        setTrendLoading(false);
      }
    },
    [user, resolveUserId, selectedDate, apiBaseUrl, calorieTarget],
  );

  useEffect(() => {
    if (!user) return;
    refetch(trendRangeDays);
  }, [user, selectedDate, trendRangeDays, refetch]);

  // Brief delay so the card animates in cleanly when data refreshes.
  useEffect(() => {
    setShowTrendCard(false);
    const timer = setTimeout(() => setShowTrendCard(true), 40);
    return () => clearTimeout(timer);
  }, [calorieTrendData, trendRangeDays]);

  return { calorieTrendData, trendLoading, showTrendCard };
}
