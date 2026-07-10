/**
 * Wellness Score — 34 individual parameters (admin-configurable max points each).
 *
 * scoringMode:
 *   binary       — on-time log → full; late/missed → 0
 *   progress     — moved toward goal → full; no progress → 0 (weight improvement)
 *   proportional — consumed / target × maxPoints (cap at max); used for protein, fiber, vitamins, minerals
 *   limit        — consumed / limit × maxPoints; exceeding limit → 0; used for calories, macros caps, sodium, sugar, cholesterol, GI
 */

export const SCORING_MODES = Object.freeze({
  BINARY: 'binary',
  PROGRESS: 'progress',
  PROPORTIONAL: 'proportional',
  LIMIT: 'limit',
});

export const PARAMETER_SECTIONS = Object.freeze([
  { id: 'logging', label: 'Activity / Logging' },
  { id: 'nutrition', label: 'Nutrition' },
  { id: 'progress', label: 'Progress' },
]);

/** @type {Array<{ key: string, label: string, section: string, scoringMode: string, dailyStatsKey?: string, defaultMaxPoints: number }>} */
export const WELLNESS_PARAMETERS = Object.freeze([
  { key: 'weight_post', label: 'Weight Post', section: 'logging', scoringMode: 'binary', defaultMaxPoints: 100 },
  { key: 'edu_post', label: 'Education Post', section: 'logging', scoringMode: 'binary', defaultMaxPoints: 100 },
  { key: 'breakfast_post', label: 'Breakfast Post', section: 'logging', scoringMode: 'binary', defaultMaxPoints: 100 },
  { key: 'lunch_post', label: 'Lunch Post', section: 'logging', scoringMode: 'binary', defaultMaxPoints: 100 },
  { key: 'dinner_post', label: 'Dinner Post', section: 'logging', scoringMode: 'binary', defaultMaxPoints: 100 },

  { key: 'calories', label: 'Calories', section: 'nutrition', scoringMode: 'limit', dailyStatsKey: 'totalCalories', defaultMaxPoints: 100 },
  { key: 'carbohydrates', label: 'Carbohydrates', section: 'nutrition', scoringMode: 'limit', dailyStatsKey: 'totalCarbs', defaultMaxPoints: 100 },
  { key: 'fat', label: 'Fat', section: 'nutrition', scoringMode: 'limit', dailyStatsKey: 'totalFat', defaultMaxPoints: 100 },
  { key: 'protein', label: 'Protein', section: 'nutrition', scoringMode: 'proportional', dailyStatsKey: 'totalProtein', defaultMaxPoints: 100 },
  { key: 'sodium', label: 'Sodium', section: 'nutrition', scoringMode: 'limit', dailyStatsKey: 'totalSodium', defaultMaxPoints: 100 },
  { key: 'cholesterol', label: 'Cholesterol', section: 'nutrition', scoringMode: 'limit', dailyStatsKey: 'totalCholesterol', defaultMaxPoints: 100 },
  { key: 'sugar', label: 'Sugar', section: 'nutrition', scoringMode: 'limit', dailyStatsKey: 'totalSugar', defaultMaxPoints: 100 },
  { key: 'fiber', label: 'Fiber', section: 'nutrition', scoringMode: 'proportional', dailyStatsKey: 'totalFiber', defaultMaxPoints: 100 },
  { key: 'gi', label: 'GI', section: 'nutrition', scoringMode: 'limit', dailyStatsKey: 'averageGlycemicIndex', defaultMaxPoints: 100 },

  { key: 'vitamin_a', label: 'Vitamin A', section: 'nutrition', scoringMode: 'proportional', dailyStatsKey: 'totalVitaminA', defaultMaxPoints: 100 },
  { key: 'vitamin_c', label: 'Vitamin C', section: 'nutrition', scoringMode: 'proportional', dailyStatsKey: 'totalVitaminC', defaultMaxPoints: 100 },
  { key: 'vitamin_d', label: 'Vitamin D', section: 'nutrition', scoringMode: 'proportional', dailyStatsKey: 'totalVitaminD', defaultMaxPoints: 100 },
  { key: 'vitamin_e', label: 'Vitamin E', section: 'nutrition', scoringMode: 'proportional', dailyStatsKey: 'totalVitaminE', defaultMaxPoints: 100 },
  { key: 'vitamin_k', label: 'Vitamin K', section: 'nutrition', scoringMode: 'proportional', dailyStatsKey: 'totalVitaminK', defaultMaxPoints: 100 },
  { key: 'vitamin_b1', label: 'Vitamin B1', section: 'nutrition', scoringMode: 'proportional', dailyStatsKey: 'totalVitaminB1', defaultMaxPoints: 100 },
  { key: 'vitamin_b2', label: 'Vitamin B2', section: 'nutrition', scoringMode: 'proportional', dailyStatsKey: 'totalVitaminB2', defaultMaxPoints: 100 },
  { key: 'vitamin_b3', label: 'Vitamin B3', section: 'nutrition', scoringMode: 'proportional', dailyStatsKey: 'totalVitaminB3', defaultMaxPoints: 100 },
  { key: 'vitamin_b6', label: 'Vitamin B6', section: 'nutrition', scoringMode: 'proportional', dailyStatsKey: 'totalVitaminB6', defaultMaxPoints: 100 },
  { key: 'vitamin_b9', label: 'Vitamin B9', section: 'nutrition', scoringMode: 'proportional', dailyStatsKey: 'totalVitaminB9', defaultMaxPoints: 100 },
  { key: 'vitamin_b12', label: 'Vitamin B12', section: 'nutrition', scoringMode: 'proportional', dailyStatsKey: 'totalVitaminB12', defaultMaxPoints: 100 },

  { key: 'calcium', label: 'Calcium', section: 'nutrition', scoringMode: 'proportional', dailyStatsKey: 'totalCalcium', defaultMaxPoints: 100 },
  { key: 'iron', label: 'Iron', section: 'nutrition', scoringMode: 'proportional', dailyStatsKey: 'totalIron', defaultMaxPoints: 100 },
  { key: 'magnesium', label: 'Magnesium', section: 'nutrition', scoringMode: 'proportional', dailyStatsKey: 'totalMagnesium', defaultMaxPoints: 100 },
  { key: 'potassium', label: 'Potassium', section: 'nutrition', scoringMode: 'proportional', dailyStatsKey: 'totalPotassium', defaultMaxPoints: 100 },
  { key: 'zinc', label: 'Zinc', section: 'nutrition', scoringMode: 'proportional', dailyStatsKey: 'totalZinc', defaultMaxPoints: 100 },
  { key: 'phosphorus', label: 'Phosphorus', section: 'nutrition', scoringMode: 'proportional', dailyStatsKey: 'totalPhosphorus', defaultMaxPoints: 100 },

  { key: 'weight_improvement', label: 'Weight Improvement', section: 'progress', scoringMode: 'progress', defaultMaxPoints: 100 },
  { key: 'water_qty', label: 'Water Quantity', section: 'progress', scoringMode: 'proportional', defaultMaxPoints: 100 },
  { key: 'physical_activity', label: 'Physical Activity', section: 'progress', scoringMode: 'proportional', defaultMaxPoints: 100 },
]);

export const DEFAULT_PARAMETER_CONFIG = Object.freeze(
  WELLNESS_PARAMETERS.map((p) => ({
    key: p.key,
    label: p.label,
    section: p.section,
    scoringMode: p.scoringMode,
    maxPoints: p.defaultMaxPoints,
    enabled: true,
  })),
);

export function getParameterDef(key) {
  return WELLNESS_PARAMETERS.find((p) => p.key === key) || null;
}

export function normalizeParameterConfig(raw) {
  const byKey = new Map();
  if (Array.isArray(raw)) {
    for (const row of raw) {
      if (row?.key) byKey.set(row.key, row);
    }
  }
  return DEFAULT_PARAMETER_CONFIG.map((def) => {
    const saved = byKey.get(def.key);
    return {
      key: def.key,
      label: def.label,
      section: def.section,
      scoringMode: def.scoringMode,
      maxPoints: Math.max(0, Number(saved?.maxPoints ?? def.maxPoints) || 0),
      enabled: saved?.enabled !== false,
    };
  });
}
