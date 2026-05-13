// useNutritionMeals — owns the day's meal list + daily totals.
// Network calls live in services/nutritionDashboard. Undo logic lives in useNutritionUndo.
import { useState, useEffect, useCallback } from 'react';
import {
  fetchDayAnalyses,
  resolveDashboardUserId,
  parseAnalysisData,
} from '../services/nutritionDashboard';

const EMPTY_STATS = {
  totalCalories: 0, totalProtein: 0, totalCarbs: 0, totalFat: 0, totalFiber: 0, mealCount: 0,
};

const sumDaily = (list) =>
  list.reduce((acc, a) => {
    if (a.isUndoPlaceholder) return acc;
    const n = parseAnalysisData(a.AnalysisData).nutrition || {};
    return {
      totalCalories: acc.totalCalories + (n.calories || a.TotalCalories || 0),
      totalProtein:  acc.totalProtein  + (n.protein  || a.TotalProtein  || 0),
      totalCarbs:    acc.totalCarbs    + (n.carbs    || a.TotalCarbs    || 0),
      totalFat:      acc.totalFat      + (n.fat      || a.TotalFat      || 0),
      totalFiber:    acc.totalFiber    + (n.fiber    || a.TotalFiber    || 0),
      mealCount:     acc.mealCount + 1,
    };
  }, EMPTY_STATS);

export function useNutritionMeals({ user, apiBaseUrl, selectedDate }) {
  const [analyses, setAnalyses]     = useState([]);
  const [dailyStats, setDailyStats] = useState(EMPTY_STATS);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState(null);

  const resolveUserId = useCallback(
    () => resolveDashboardUserId(user, apiBaseUrl),
    [user, apiBaseUrl],
  );

  const refresh = useCallback(async (date) => {
    setLoading(true); setError(null);
    const userId = await resolveUserId();
    if (!userId) {
      setError('Unable to determine user account. Please try logging in again.');
      setLoading(false); return;
    }
    const { success, list } = await fetchDayAnalyses({ apiBaseUrl, userId, date });
    if (success) { setAnalyses(list); setDailyStats(sumDaily(list)); }
    else setError('Failed to load nutrition data. Please check your connection.');
    setLoading(false);
  }, [apiBaseUrl, resolveUserId]);

  useEffect(() => { if (user) refresh(selectedDate); }, [user, selectedDate, refresh]);

  const applyDailyDelta = useCallback((d) => {
    setDailyStats((prev) => ({
      totalCalories: Math.max(0, prev.totalCalories + (d.calories || 0)),
      totalProtein:  Math.max(0, prev.totalProtein  + (d.protein  || 0)),
      totalCarbs:    Math.max(0, prev.totalCarbs    + (d.carbs    || 0)),
      totalFat:      Math.max(0, prev.totalFat      + (d.fat      || 0)),
      totalFiber:    Math.max(0, prev.totalFiber    + (d.fiber    || 0)),
      mealCount:     Math.max(0, prev.mealCount + (d.mealCountDelta || 0)),
    }));
  }, []);

  return {
    analyses, setAnalyses,
    dailyStats, setDailyStats,
    loading, error, setError,
    refresh, applyDailyDelta, resolveUserId,
  };
}
