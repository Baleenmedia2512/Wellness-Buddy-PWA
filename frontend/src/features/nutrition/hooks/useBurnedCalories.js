/**
 * useBurnedCalories — Burn-to-Balance: today's calories burned via watch + steps.
 *
 * Step counter is currently disabled, so stepsBurned is always 0. Watch-burned
 * value is fetched from the DB; if the parent just uploaded a watch screenshot
 * (passed via watchBurnedCalories prop), we use the higher of the two values
 * so the UI reflects the upload before the DB round-trip completes.
 */
import { useState, useEffect, useCallback } from 'react';
import { fetchWatchBurnedCalories } from '../services/nutritionDashboard';

export function useBurnedCalories({
  user,
  selectedDate,
  apiBaseUrl,
  resolveUserId,
  watchBurnedCalories = 0,
}) {
  const [dbWatchBurned, setDbWatchBurned] = useState(0);

  // Step counter disabled — kept as constant so consumers can read it.
  const stepsBurned = 0;

  const watchBurned = Math.max(dbWatchBurned, watchBurnedCalories);
  const burnedCalories = stepsBurned + watchBurned;

  const refetch = useCallback(async () => {
    if (!user) return;
    const userId = await resolveUserId();
    const value = await fetchWatchBurnedCalories({
      apiBaseUrl,
      userId,
      date: selectedDate,
    });
    setDbWatchBurned(value);
  }, [user, apiBaseUrl, resolveUserId, selectedDate]);

  useEffect(() => {
    if (user) refetch();
  }, [user, selectedDate, refetch, watchBurnedCalories]);

  return { burnedCalories, watchBurned, stepsBurned };
}
