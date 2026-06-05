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
import { ALL_MICRONUTRIENTS } from '../domain/micronutrientRules';

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

export function useDayAnalyses({ user, selectedDate, apiBaseUrl, resolveUserId, nutritionRefreshKey = 0 }) {
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
            // GI is meal-level — read from DB column first; fallback to AnalysisData JSON
            const mealCarbs = n.carbs || analysis.TotalCarbs || 0;
            let mealGI = analysis.GlycemicIndex ?? null;
            if (mealGI == null) {
              try {
                const parsed = typeof analysis.AnalysisData === 'string'
                  ? JSON.parse(analysis.AnalysisData) : analysis.AnalysisData;
                if (parsed?.total?.glycemic_index != null) {
                  mealGI = parsed.total.glycemic_index;
                } else if (parsed?.nutrition?.glycemic_index != null) {
                  mealGI = parsed.nutrition.glycemic_index;
                } else if (parsed?.foods?.length > 0) {
                  let giCarbs = 0, totalFoodCarbs = 0;
                  for (const f of parsed.foods) {
                    const fgi = f.nutrition?.glycemic_index ?? null;
                    const fc = f.nutrition?.carbs || 0;
                    if (fgi != null && fc > 0) { giCarbs += fgi * fc; totalFoodCarbs += fc; }
                  }
                  mealGI = totalFoodCarbs > 0 ? Math.round(giCarbs / totalFoodCarbs) : null;
                }
              } catch { /* ignore */ }
            }
            return {
              totalCalories: acc.totalCalories + calories,
              totalProtein: acc.totalProtein + protein,
              totalCarbs: acc.totalCarbs + carbs,
              totalFat: acc.totalFat + fat,
              totalFiber: acc.totalFiber + fiber,
              totalSugar: acc.totalSugar + sugar,
              totalSodium: acc.totalSodium + sodium,
              totalCholesterol: acc.totalCholesterol + cholesterol,
              // Accumulate numerator and denominator for carb-weighted daily GI
              _giCarbProduct: acc._giCarbProduct + (mealGI != null && mealCarbs > 0 ? mealGI * mealCarbs : 0),
              _giTotalCarbs: acc._giTotalCarbs + (mealGI != null && mealCarbs > 0 ? mealCarbs : 0),
              mealCount: acc.mealCount + 1,
              // Micronutrients: prefer AnalysisData JSON (snake_case), fall back to DB column.
              ...MICRO_FIELDS.reduce((m, f) => {
                const raw = n[f.aiKey] ?? analysis[f.dbCol] ?? 0;
                m[f.key] = (acc[f.key] || 0) + (Number(raw) || 0);
                return m;
              }, {}),
            };
          },
          { ...EMPTY_STATS, _giCarbProduct: 0, _giTotalCarbs: 0 },
        );
        const averageGlycemicIndex = stats._giTotalCarbs > 0
          ? Math.round(stats._giCarbProduct / stats._giTotalCarbs)
          : null;
        setDailyStats({
          totalCalories: stats.totalCalories,
          totalProtein: stats.totalProtein,
          totalCarbs: stats.totalCarbs,
          totalFat: stats.totalFat,
          totalFiber: stats.totalFiber,
          totalSugar: stats.totalSugar,
          totalSodium: stats.totalSodium,
          totalCholesterol: stats.totalCholesterol,
          averageGlycemicIndex,
          mealCount: stats.mealCount,
          ...MICRO_FIELDS.reduce((m, f) => { m[f.key] = stats[f.key] || 0; return m; }, {}),
        });
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
