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
import { ALL_MICRONUTRIENTS } from '../domain/micronutrientRules';
import {
  shouldRefreshHomeDashboard,
  markHomeDashboardProcessed,
  getLatestActivityLogId,
  getHomeDashboardSnapshot,
  setHomeDashboardSnapshot,
} from '../../../shared/services/homeDashboardActivity';
import { parseAnalysisData } from '../services/nutritionDashboard/analysisHelpers';

// camelCase dailyStats key ↔ snake_case AI key ↔ PascalCase DB column.
// Source of truth list lives in micronutrientRules.js; this table only adds
// the AI/DB key mapping (per-meal record fields).
const MICRO_FIELDS = [
  { key: 'totalVitaminA',   aiKey: 'vitamin_a',   dbCol: 'TotalVitaminA' },
  { key: 'totalVitaminC',   aiKey: 'vitamin_c',   dbCol: 'TotalVitaminC' },
  { key: 'totalVitaminD',   aiKey: 'vitamin_d',   dbCol: 'TotalVitaminD' },
  { key: 'totalVitaminE',   aiKey: 'vitamin_e',   dbCol: 'TotalVitaminE' },
  { key: 'totalVitaminK',   aiKey: 'vitamin_k',   dbCol: 'TotalVitaminK' },
  { key: 'totalVitaminB1',  aiKey: 'vitamin_b1',  dbCol: 'TotalVitaminB1' },
  { key: 'totalVitaminB2',  aiKey: 'vitamin_b2',  dbCol: 'TotalVitaminB2' },
  { key: 'totalVitaminB3',  aiKey: 'vitamin_b3',  dbCol: 'TotalVitaminB3' },
  { key: 'totalVitaminB6',  aiKey: 'vitamin_b6',  dbCol: 'TotalVitaminB6' },
  { key: 'totalVitaminB9',  aiKey: 'vitamin_b9',  dbCol: 'TotalVitaminB9' },
  { key: 'totalVitaminB12', aiKey: 'vitamin_b12', dbCol: 'TotalVitaminB12' },
  { key: 'totalCalcium',    aiKey: 'calcium',     dbCol: 'TotalCalcium' },
  { key: 'totalIron',       aiKey: 'iron',        dbCol: 'TotalIron' },
  { key: 'totalMagnesium',  aiKey: 'magnesium',   dbCol: 'TotalMagnesium' },
  { key: 'totalPotassium',  aiKey: 'potassium',   dbCol: 'TotalPotassium' },
  { key: 'totalZinc',       aiKey: 'zinc',        dbCol: 'TotalZinc' },
  { key: 'totalPhosphorus', aiKey: 'phosphorus',  dbCol: 'TotalPhosphorus' },
];

// Defensive sanity check — bumps test failures fast if the two lists diverge.
if (process.env.NODE_ENV !== 'production' && MICRO_FIELDS.length !== ALL_MICRONUTRIENTS.length) {
  // eslint-disable-next-line no-console
  console.warn('[useDayAnalyses] MICRO_FIELDS out of sync with ALL_MICRONUTRIENTS');
}

const EMPTY_MICRO_STATS = MICRO_FIELDS.reduce((acc, f) => { acc[f.key] = 0; return acc; }, {});

const EMPTY_STATS = {
  totalCalories: 0,
  totalProtein: 0,
  totalCarbs: 0,
  totalFat: 0,
  totalFiber: 0,
  totalSugar: 0,
  totalSodium: 0,
  totalCholesterol: 0,
  averageGlycemicIndex: null,
  mealCount: 0,
  ...EMPTY_MICRO_STATS,
};

function dateKey(date) {
  return (
    date.getFullYear() +
    '-' +
    String(date.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(date.getDate()).padStart(2, '0')
  );
}

export function useDayAnalyses({
  user,
  selectedDate,
  apiBaseUrl,
  resolveUserId,
  nutritionRefreshKey = 0,
  /** Home-only: skip refetch when no newer activity log exists (see homeDashboardActivity). */
  enableActivityLogGate = false,
  /** When false, skip auto-fetch (timeline modal-host mount). */
  enabled = true,
}) {
  // Restore last Home snapshot instantly when remounting with no new activity log.
  const cachedSnapshot = enableActivityLogGate ? getHomeDashboardSnapshot() : null;
  const [analyses, setAnalyses] = useState(() => cachedSnapshot?.analyses ?? []);
  const [dailyStats, setDailyStats] = useState(() => cachedSnapshot?.dailyStats ?? EMPTY_DAILY_STATS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchDayAnalyses = useCallback(
    async (date, { force = false } = {}) => {
      // Refresh decision (Home): skip network when no newer async activity log
      // exists and we already have a snapshot for this calendar day.
      if (enableActivityLogGate && !force) {
        const snapshot = getHomeDashboardSnapshot();
        const key = dateKey(date);
        const email = user?.email || '';
        if (
          !shouldRefreshHomeDashboard() &&
          snapshot &&
          snapshot.dateKey === key &&
          snapshot.userEmail === email &&
          Array.isArray(snapshot.analyses)
        ) {
          setAnalyses(snapshot.analyses);
          setDailyStats(snapshot.dailyStats || EMPTY_STATS);
          setLoading(false);
          setError(null);
          return;
        }
      }

      setLoading(true);
      setError(null);

      const calculateDailyStats = (dayAnalyses) => {
        // Domain owns meal/day GI (available-carb weighted). Keep local wrapper for callers.
        const nextStats = computeDailyStatsFromAnalyses(dayAnalyses);
        setDailyStats(nextStats);
        return nextStats;
      };

      try {
        const actualUserId = await resolveUserId();
        if (!actualUserId) {
          setError('Unable to determine user account. Please try logging in again.');
          return;
        }

        // ✅ TIMEZONE FIX: Use local date formatting instead of toISOString()
        const dateString = dateKey(date);
        const cacheBuster = Date.now();
        const activityLogAtFetch = getLatestActivityLogId();

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
          const nextStats = setDailyStats(computeDailyStatsFromAnalyses(list));

          // Home activity-log gate: persist snapshot so remount without a
          // newer async activity can skip the API and skip the spinner.
          if (enableActivityLogGate) {
            setHomeDashboardSnapshot({
              userId: actualUserId,
              dateKey: dateString,
              analyses: list,
              dailyStats: nextStats,
              activityLogId: activityLogAtFetch,
            });
            markHomeDashboardProcessed(activityLogAtFetch);
          }

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
    [apiBaseUrl, resolveUserId, enableActivityLogGate],
  );

  // Auto-refresh when user, date, or nutritionRefreshKey (activity log) changes.
  // Diary / NutritionDashboard always force-fetch; Home uses the activity gate.
  // Timeline modal-host mounts pass enabled=false until first open.
  useEffect(() => {
    if (!user || !enabled) return;
    fetchDayAnalyses(selectedDate, {
      force: enableActivityLogGate ? shouldRefreshHomeDashboard() : true,
    });
  }, [user, selectedDate, fetchDayAnalyses, nutritionRefreshKey, enableActivityLogGate, enabled]); // eslint-disable-line react-hooks/exhaustive-deps

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
