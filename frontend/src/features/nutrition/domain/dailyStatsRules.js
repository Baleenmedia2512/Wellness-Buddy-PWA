import { parseAnalysisData } from '../services/nutritionDashboard';
import { ALL_MICRONUTRIENTS } from './micronutrientRules';

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

if (process.env.NODE_ENV !== 'production' && MICRO_FIELDS.length !== ALL_MICRONUTRIENTS.length) {
  // eslint-disable-next-line no-console
  console.warn('[dailyStatsRules] MICRO_FIELDS out of sync with ALL_MICRONUTRIENTS');
}

const EMPTY_MICRO_STATS = MICRO_FIELDS.reduce((acc, f) => { acc[f.key] = 0; return acc; }, {});

export const EMPTY_DAILY_STATS = {
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

/**
 * Derive daily nutrition totals from meal analysis rows (same logic as useDayAnalyses).
 */
export function computeDailyStatsFromAnalyses(dayAnalyses) {
  const stats = (dayAnalyses || []).reduce(
    (acc, analysis) => {
      if (analysis.isUndoPlaceholder) return acc;
      const foodData = parseAnalysisData(analysis.AnalysisData);
      const n = foodData.nutrition || {};
      const calories = n.calories || analysis.TotalCalories || 0;
      const protein = n.protein || analysis.TotalProtein || 0;
      const carbs = n.carbs || analysis.TotalCarbs || 0;
      const fat = n.fat || analysis.TotalFat || 0;
      const fiber = n.fiber || analysis.TotalFiber || 0;
      const sugar = analysis.TotalSugar != null ? analysis.TotalSugar : (n.sugar ?? 0);
      const sodium = analysis.TotalSodium != null ? analysis.TotalSodium : (n.sodium ?? 0);
      const cholesterol = analysis.TotalCholesterol != null ? analysis.TotalCholesterol : (n.cholesterol ?? 0);
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
            let giCarbs = 0; let totalFoodCarbs = 0;
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
        _giCarbProduct: acc._giCarbProduct + (mealGI != null && mealCarbs > 0 ? mealGI * mealCarbs : 0),
        _giTotalCarbs: acc._giTotalCarbs + (mealGI != null && mealCarbs > 0 ? mealCarbs : 0),
        mealCount: acc.mealCount + 1,
        ...MICRO_FIELDS.reduce((m, f) => {
          const dbVal = analysis[f.dbCol];
          const jsonVal = n[f.aiKey];
          const val = dbVal != null ? dbVal : (jsonVal ?? 0);
          m[f.key] = (acc[f.key] || 0) + (Number(val) || 0);
          return m;
        }, {}),
      };
    },
    { ...EMPTY_DAILY_STATS, _giCarbProduct: 0, _giTotalCarbs: 0 },
  );

  const averageGlycemicIndex = stats._giTotalCarbs > 0
    ? Math.round(stats._giCarbProduct / stats._giTotalCarbs)
    : null;

  return {
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
  };
}
