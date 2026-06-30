// useNutritionStats — owns the calorie target (BMR), burned calories, and
// derived progress / burn-to-balance values. All memoized.
import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  fetchUserBmr,
  fetchWatchBurnedCalories,
  DEFAULT_CALORIE_TARGET,
} from '../services/nutritionDashboard';

export function useNutritionStats({
  user, apiBaseUrl, selectedDate, bmrUpdateKey = 0,
  watchBurnedCalories = 0, dailyStats, resolveUserId,
}) {
  const [calorieTarget, setCalorieTarget] = useState(DEFAULT_CALORIE_TARGET);
  const [dbWatchBurned, setDbWatchBurned] = useState(0);
  const [burnedLoading, setBurnedLoading] = useState(false);

  // Step counter is disabled — all "burned" comes from the watch source.
  const stepsBurned = 0;
  const watchBurned = Math.max(dbWatchBurned, watchBurnedCalories);
  const burnedCalories = stepsBurned + watchBurned;

  // Re-fetch BMR on user change, on bmrUpdateKey bump, and when the tab regains visibility.
  useEffect(() => {
    if (!user?.email) return undefined;
    const load = async () => {
      const bmr = await fetchUserBmr({ apiBaseUrl, email: user.email });
      setCalorieTarget(bmr);
    };
    load();
    const onVisible = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [user?.email, apiBaseUrl, bmrUpdateKey]);

  // Refresh watch-burned calories when date changes or after a fresh upload.
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setBurnedLoading(true);
      const userId = await resolveUserId();
      const cal = await fetchWatchBurnedCalories({ apiBaseUrl, userId, date: selectedDate });
      setDbWatchBurned(cal);
      setBurnedLoading(false);
    };
    load();
  }, [user, apiBaseUrl, selectedDate, resolveUserId, watchBurnedCalories]);

  const consumedCalories = dailyStats?.totalCalories || 0;
  // Net Calories = Food Calories - Smartwatch Burned Calories (step counter disabled).
  // Canonical formula: Net = Food - Exercise - Smartwatch Burned.
  const netCalories = Math.max(0, consumedCalories - burnedCalories);

  const caloriesProgressPercent = useMemo(
    () => Math.min(100, (netCalories / Math.max(calorieTarget, 1)) * 100),
    [netCalories, calorieTarget],
  );

  const caloriesDelta = netCalories - calorieTarget;

  const calorieStatus = useMemo(() => {
    if (Math.abs(caloriesDelta) <= 100) {
      return { label: 'On Track', className: 'bg-emerald-50 text-emerald-700', hint: 'Great balance for today' };
    }
    if (caloriesDelta > 100) {
      return { label: 'Above Target', className: 'bg-rose-50 text-rose-700', hint: `${Math.abs(caloriesDelta)} kcal above target` };
    }
    return { label: 'Below Target', className: 'bg-amber-50 text-amber-700', hint: `${Math.abs(caloriesDelta)} kcal below target` };
  }, [caloriesDelta]);

  // Burn-to-Balance: uses RAW food overage so the section shows how much of
  // the food-vs-target gap has been covered by exercise.
  const rawExcess     = Math.max(0, consumedCalories - calorieTarget);
  const isOverTarget  = rawExcess > 0;
  const extraCalories = rawExcess;
  const burnProgress  = extraCalories > 0
    ? Math.min(100, Math.round((burnedCalories / extraCalories) * 100))
    : 0;
  const isBalanced = isOverTarget && burnedCalories >= extraCalories;

  const refreshWatchBurned = useCallback(async () => {
    const userId = await resolveUserId();
    const cal = await fetchWatchBurnedCalories({ apiBaseUrl, userId, date: selectedDate });
    setDbWatchBurned(cal);
  }, [apiBaseUrl, resolveUserId, selectedDate]);

  return {
    calorieTarget,
    consumedCalories,   // raw food calories (for informational display)
    netCalories,        // net = food - exercise; use for progress/status
    caloriesProgressPercent,
    caloriesDelta,
    calorieStatus,
    burnedCalories,
    stepsBurned,
    watchBurned,
    burnedLoading,
    isOverTarget,
    extraCalories,
    burnProgress,
    isBalanced,
    refreshWatchBurned,
  };
}
