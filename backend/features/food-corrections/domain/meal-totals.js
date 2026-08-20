/**
 * Aggregate meal numeric columns into daily totals (home carousel / charts).
 * GI uses available-carb weighting — keep in sync with frontend dailyStatsRules.
 */
import { availableCarbohydrates } from '../mealGlycemicIndex.js';

const MICRO_TOTAL_FIELDS = [
  ['totalVitaminA', 'TotalVitaminA'], ['totalVitaminC', 'TotalVitaminC'],
  ['totalVitaminD', 'TotalVitaminD'], ['totalVitaminE', 'TotalVitaminE'],
  ['totalVitaminK', 'TotalVitaminK'], ['totalVitaminB1', 'TotalVitaminB1'],
  ['totalVitaminB2', 'TotalVitaminB2'], ['totalVitaminB3', 'TotalVitaminB3'],
  ['totalVitaminB6', 'TotalVitaminB6'], ['totalVitaminB9', 'TotalVitaminB9'],
  ['totalVitaminB12', 'TotalVitaminB12'], ['totalCalcium', 'TotalCalcium'],
  ['totalIron', 'TotalIron'], ['totalMagnesium', 'TotalMagnesium'],
  ['totalPotassium', 'TotalPotassium'], ['totalZinc', 'TotalZinc'],
  ['totalPhosphorus', 'TotalPhosphorus'],
];

const round2 = (n) => Math.round(n * 100) / 100;

export function emptyMealTotalsSeed() {
  return {
    totalCalories: 0, totalProtein: 0, totalCarbs: 0, totalFat: 0, totalFiber: 0,
    totalSugar: 0, totalSodium: 0, totalCholesterol: 0, mealCount: 0,
    averageGlycemicIndex: null,
    _giCarbProduct: 0,
    _giTotalCarbs: 0,
    ...MICRO_TOTAL_FIELDS.reduce((s, [k]) => { s[k] = 0; return s; }, {}),
  };
}

export function addMealRowToTotals(t, r) {
  const mealCarbs = Number(r.TotalCarbs) || 0;
  const mealFiber = Number(r.TotalFiber) || 0;
  const mealGi = Number(r.GlycemicIndex);
  const availableCarbs = availableCarbohydrates(mealCarbs, mealFiber);
  const includeGi = Number.isFinite(mealGi) && mealGi > 0 && availableCarbs > 0;

  const next = {
    totalCalories: t.totalCalories + (r.TotalCalories || 0),
    totalProtein: t.totalProtein + (r.TotalProtein || 0),
    totalCarbs: t.totalCarbs + mealCarbs,
    totalFat: t.totalFat + (r.TotalFat || 0),
    totalFiber: t.totalFiber + mealFiber,
    totalSugar: t.totalSugar + (r.TotalSugar || 0),
    totalSodium: t.totalSodium + (r.TotalSodium || 0),
    totalCholesterol: t.totalCholesterol + (r.TotalCholesterol || 0),
    mealCount: t.mealCount + 1,
    _giCarbProduct: t._giCarbProduct + (includeGi ? mealGi * availableCarbs : 0),
    _giTotalCarbs: t._giTotalCarbs + (includeGi ? availableCarbs : 0),
  };
  for (const [statKey, dbCol] of MICRO_TOTAL_FIELDS) {
    next[statKey] = (t[statKey] || 0) + (r[dbCol] || 0);
  }
  return next;
}

export function roundMealTotals(dailyTotals) {
  const giTotalCarbs = dailyTotals._giTotalCarbs || 0;
  const averageGlycemicIndex = giTotalCarbs > 0
    ? Math.round((dailyTotals._giCarbProduct || 0) / giTotalCarbs)
    : null;
  const {
    _giCarbProduct: _omitProduct,
    _giTotalCarbs: _omitCarbs,
    ...publicTotals
  } = dailyTotals;

  return {
    ...publicTotals,
    totalCalories: round2(dailyTotals.totalCalories),
    totalProtein: round2(dailyTotals.totalProtein),
    totalCarbs: round2(dailyTotals.totalCarbs),
    totalFat: round2(dailyTotals.totalFat),
    totalFiber: round2(dailyTotals.totalFiber),
    totalSugar: round2(dailyTotals.totalSugar),
    totalSodium: round2(dailyTotals.totalSodium),
    totalCholesterol: round2(dailyTotals.totalCholesterol),
    averageGlycemicIndex,
    ...MICRO_TOTAL_FIELDS.reduce((acc, [k]) => {
      acc[k] = round2(dailyTotals[k] || 0);
      return acc;
    }, {}),
  };
}
