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
import { computeDailyStatsFromAnalyses, EMPTY_DAILY_STATS } from '../domain/dailyStatsRules';
import * as Session from '../../../shared/services/sessionStorage';

export function useDayAnalyses({ user, selectedDate, apiBaseUrl, resolveUserId, nutritionRefreshKey = 0 }) {
  const [analyses, setAnalyses] = useState([]);
  const [dailyStats, setDailyStats] = useState(EMPTY_DAILY_STATS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchDayAnalyses = useCallback(
    async (date) => {
      setLoading(true);
      setError(null);

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

        // Stage 18 — useDayAnalyses fetch started
        const _trD = window.__captureTrace;
        if (_trD) {
          console.log(
            `[CAPTURE-TRACE-${_trD.id}] Stage 18 | useDayAnalyses fetch started\n` +
            `  ts=${Date.now()}  (+${Date.now() - _trD.t0}ms from T0)\n` +
            `  captureId=${_trD.captureId ?? 'null'}\n` +
            `  traceId=${_trD.traceId ?? 'none'}\n` +
            `  userId=${actualUserId}\n` +
            `  date=${dateString}\n` +
            `  savePromiseRef=${_trD.savePromiseRef}\n` +
            `  cacheBuster=${cacheBuster}`,
          );
        }

        const response = await fetch(
          `${apiBaseUrl}/api/food-corrections/stats?userId=${actualUserId}&date=${dateString}&detailed=true&_t=${cacheBuster}`,
          {
            cache: 'no-store',
            headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
          },
        );
        const data = await response.json();

        // Stage 19 — useDayAnalyses fetch completed
        if (_trD) {
          console.log(
            `[CAPTURE-TRACE-${_trD.id}] Stage 19 | useDayAnalyses fetch completed\n` +
            `  ts=${Date.now()}  (+${Date.now() - _trD.t0}ms from T0)\n` +
            `  captureId=${_trD.captureId ?? 'null'}\n` +
            `  httpStatus=${response.status}\n` +
            `  dataSuccess=${data.success}\n` +
            `  rowsReturned=${data.data?.length ?? 'n/a'}`,
          );
        }

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
          setDailyStats(computeDailyStatsFromAnalyses(list));

          // Stage 20 — final meal count returned
          if (_trD) {
            console.log(
              `[CAPTURE-TRACE-${_trD.id}] Stage 20 | final meal count after setAnalyses\n` +
              `  ts=${Date.now()}  (+${Date.now() - _trD.t0}ms from T0)\n` +
              `  captureId=${_trD.captureId ?? 'null'}\n` +
              `  mealCount=${list.length}\n` +
              `  mealIds=${list.map(m => m.ID ?? m.id).join(',') || 'none'}\n` +
              `  defect=${list.length === 0 ? 'YES — empty result' : 'no'}`,
            );
          }
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

  // Auto-refresh when user, date, or nutritionRefreshKey changes.
  useEffect(() => {
    if (user) fetchDayAnalyses(selectedDate);
  }, [user, selectedDate, fetchDayAnalyses, nutritionRefreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

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
