/**
 * useDayAnalyses — owns nutrition analyses + daily stats for a selected date.
 *
 * Responsibilities:
 *  - fetch meal analyses for a given date (with cache-busting + DEMO_USER fallback)
 *  - derive daily totals (calories/protein/carbs/fat/fiber/mealCount)
 *  - expose imperative refresh + delta application (for optimistic mutations)
 *  - auto-refresh on user/date change
 *
 * Extracted from NutritionDashboard.js. Behavior preserved exactly.
 */
import { useState, useEffect, useCallback } from 'react';
import { parseAnalysisData } from '../services/nutritionDashboard';
import * as Session from '../../../shared/services/sessionStorage';

const EMPTY_STATS = {
  totalCalories: 0,
  totalProtein: 0,
  totalCarbs: 0,
  totalFat: 0,
  totalFiber: 0,
  totalSugar: 0,
  totalSodium: 0,
  totalCholesterol: 0,
  mealCount: 0,
};

export function useDayAnalyses({ user, selectedDate, apiBaseUrl, resolveUserId }) {
  const [analyses, setAnalyses] = useState([]);
  const [dailyStats, setDailyStats] = useState(EMPTY_STATS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchDayAnalyses = useCallback(
    async (date) => {
      setLoading(true);
      setError(null);

      const calculateDailyStats = (dayAnalyses) => {
        const stats = dayAnalyses.reduce(
          (acc, analysis) => {
            if (analysis.isUndoPlaceholder) return acc;
            const foodData = parseAnalysisData(analysis.AnalysisData);
            const n = foodData.nutrition || {};
            const calories = n.calories || analysis.TotalCalories || 0;
            const protein = n.protein || analysis.TotalProtein || 0;
            const carbs = n.carbs || analysis.TotalCarbs || 0;
            const fat = n.fat || analysis.TotalFat || 0;
            const fiber = n.fiber || analysis.TotalFiber || 0;
            const sugar = n.sugar ?? analysis.TotalSugar ?? 0;
            const sodium = n.sodium ?? analysis.TotalSodium ?? 0;
            const cholesterol = n.cholesterol ?? analysis.TotalCholesterol ?? 0;
            return {
              totalCalories: acc.totalCalories + calories,
              totalProtein: acc.totalProtein + protein,
              totalCarbs: acc.totalCarbs + carbs,
              totalFat: acc.totalFat + fat,
              totalFiber: acc.totalFiber + fiber,
              totalSugar: acc.totalSugar + sugar,
              totalSodium: acc.totalSodium + sodium,
              totalCholesterol: acc.totalCholesterol + cholesterol,
              mealCount: acc.mealCount + 1,
            };
          },
          { ...EMPTY_STATS },
        );
        setDailyStats(stats);
      };

      try {
        const actualUserId = await resolveUserId();
        if (!actualUserId) {
          setError('Unable to determine user account. Please try logging in again.');
          return;
        }

        // ✅ TIMEZONE FIX: Use local date formatting instead of toISOString()
        const dateString =
          date.getFullYear() +
          '-' +
          String(date.getMonth() + 1).padStart(2, '0') +
          '-' +
          String(date.getDate()).padStart(2, '0');
        const cacheBuster = Date.now();
        const response = await fetch(
          `${apiBaseUrl}/api/food-corrections/stats?userId=${actualUserId}&date=${dateString}&detailed=true&_t=${cacheBuster}`,
          {
            cache: 'no-store',
            headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
          },
        );
        const data = await response.json();

        if (data.success) {
          let list = data.data || [];

          // 🔒 Demo account — merge localStorage meals for the selected date
          if (actualUserId === 'DEMO_USER') {
            try {
              const demoMeals = JSON.parse(Session.getDemoMealsRaw() || '[]');
              const dayMeals = demoMeals.filter((m) => m.dateKey === dateString);
              list = [...list, ...dayMeals];
            } catch (e) { /* ignore */ }
          }

          setAnalyses(list);
          calculateDailyStats(list);
        } else {
          setError('Failed to load nutrition data');
        }
      } catch (err) {
        setError('Failed to load nutrition data. Please check your connection.');
      } finally {
        setLoading(false);
      }
    },
    [apiBaseUrl, resolveUserId],
  );

  // Auto-refresh when user or date changes (preserves original timing).
  useEffect(() => {
    if (user) fetchDayAnalyses(selectedDate);
  }, [user, selectedDate, fetchDayAnalyses]);

  // Apply optimistic deltas to daily totals (used by mutations).
  const applyDailyDelta = useCallback(
    ({ calories = 0, protein = 0, carbs = 0, fat = 0, fiber = 0, sugar = 0, sodium = 0, cholesterol = 0, mealCountDelta = 0 }) => {
      setDailyStats((prev) => ({
        totalCalories: Math.max(0, prev.totalCalories + calories),
        totalProtein: Math.max(0, prev.totalProtein + protein),
        totalCarbs: Math.max(0, prev.totalCarbs + carbs),
        totalFat: Math.max(0, prev.totalFat + fat),
        totalFiber: Math.max(0, prev.totalFiber + fiber),
        totalSugar: Math.max(0, prev.totalSugar + sugar),
        totalSodium: Math.max(0, prev.totalSodium + sodium),
        totalCholesterol: Math.max(0, prev.totalCholesterol + cholesterol),
        mealCount: Math.max(0, prev.mealCount + mealCountDelta),
      }));
    },
    [],
  );

  return {
    analyses,
    setAnalyses,
    dailyStats,
    setDailyStats,
    loading,
    error,
    setError,
    fetchDayAnalyses,
    applyDailyDelta,
  };
}
