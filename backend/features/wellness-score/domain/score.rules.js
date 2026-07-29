import { isExemptedBeverageOnly } from '../../../utils/foodTypeDetection.js';
import { IANA_IST } from '../../../shared/lib/datetime/index.js';
import { isOnTime, isLate, filterFoodByMealWindow } from './window.helpers.js';
import { filterEducationLogsOnly } from './education-log.helpers.js';
import { WELLNESS_PARAMETERS } from './parameter-registry.js';
import { GI_HIGH_MIN } from './nutrition-targets.js';

function isGainGoalMode(goalMode) {
  return String(goalMode || 'loss').toLowerCase() === 'gain';
}

export function buildParameterScore({
  key,
  label,
  section,
  scoringMode,
  maxPoints,
  earnedPoints,
  calculationReason,
}) {
  const max = Math.max(0, Number(maxPoints) || 0);
  const earned = Math.min(max, Math.max(0, Number(earnedPoints) || 0));
  const percentage = max > 0 ? Math.round((earned / max) * 100) : 0;
  return {
    key,
    label,
    section,
    scoringMode,
    maxPoints: max,
    earnedPoints: earned,
    percentage,
    calculationReason,
  };
}

function roundEarned(ratio, maxPoints) {
  return Math.min(maxPoints, Math.max(0, Math.round(ratio * maxPoints)));
}

/** Display-safe nutrient amounts — strips IEEE-754 noise (e.g. 2.3200000000000003 → 2.32). */
function formatDisplayAmount(value, decimals = 2) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0';
  if (decimals <= 0) return String(Math.round(n));
  return String(parseFloat(n.toFixed(decimals)));
}

// ─── Shared primitives ───────────────────────────────────────────────────────

export function calculateBinaryLogScore({
  maxPoints,
  records = [],
  window,
  activityLabel,
  timezoneIana = IANA_IST,
  timestampKind = 'activity',
}) {
  if (!records.length) {
    return buildParameterScore({
      key: activityLabel,
      label: activityLabel,
      section: 'logging',
      scoringMode: 'binary',
      maxPoints,
      earnedPoints: 0,
      calculationReason: 'Not completed',
    });
  }
  const onTime = records.some((r) =>
    isOnTime(r.CreatedAt, window, timezoneIana, timestampKind));
  if (onTime) {
    return buildParameterScore({
      key: activityLabel,
      label: activityLabel,
      section: 'logging',
      scoringMode: 'binary',
      maxPoints,
      earnedPoints: maxPoints,
      calculationReason: 'Done within allowed time',
    });
  }
  const late = records.some((r) =>
    isLate(r.CreatedAt, window, timezoneIana, timestampKind));
  return buildParameterScore({
    key: activityLabel,
    label: activityLabel,
    section: 'logging',
    scoringMode: 'binary',
    maxPoints,
    earnedPoints: 0,
    calculationReason: late ? 'Late entry' : 'Not completed within window',
  });
}

export function calculateWaterQuantity({ maxPoints, consumedMl, requiredMl }) {
  const consumed = Math.max(0, Number(consumedMl) || 0);
  const required = Math.max(0, Number(requiredMl) || 0);
  const consumedLabel = formatDisplayAmount(consumed, 0);
  const requiredLabel = formatDisplayAmount(required, 0);
  if (required <= 0) {
    return buildParameterScore({
      key: 'water_qty',
      label: 'Water Quantity',
      section: 'progress',
      scoringMode: 'proportional',
      maxPoints,
      earnedPoints: 0,
      calculationReason: 'Water target unavailable',
    });
  }
  if (consumed >= required) {
    return buildParameterScore({
      key: 'water_qty',
      label: 'Water Quantity',
      section: 'progress',
      scoringMode: 'proportional',
      maxPoints,
      earnedPoints: maxPoints,
      calculationReason: `Target reached (${consumedLabel} / ${requiredLabel} ml)`,
    });
  }
  const earned = roundEarned(consumed / required, maxPoints);
  return buildParameterScore({
    key: 'water_qty',
    label: 'Water Quantity',
    section: 'progress',
    scoringMode: 'proportional',
    maxPoints,
    earnedPoints: earned,
    calculationReason: `${consumedLabel} / ${requiredLabel} ml`,
  });
}

export function calculateTargetNutrient({
  key,
  label,
  maxPoints,
  consumed,
  target,
  unit = '',
  decimals = 2,
}) {
  const actual = Math.max(0, Number(consumed) || 0);
  const tgt = Number(target);
  const actualLabel = formatDisplayAmount(actual, decimals);
  const targetLabel = formatDisplayAmount(tgt, decimals);
  if (!Number.isFinite(tgt) || tgt <= 0) {
    return buildParameterScore({
      key,
      label,
      section: 'nutrition',
      scoringMode: 'proportional',
      maxPoints,
      earnedPoints: 0,
      calculationReason: 'Target unavailable',
    });
  }
  if (actual >= tgt) {
    return buildParameterScore({
      key,
      label,
      section: 'nutrition',
      scoringMode: 'proportional',
      maxPoints,
      earnedPoints: maxPoints,
      calculationReason: `Target reached (${actualLabel}${unit} / ${targetLabel}${unit})`,
    });
  }
  const earned = roundEarned(actual / tgt, maxPoints);
  return buildParameterScore({
    key,
    label,
    section: 'nutrition',
    scoringMode: 'proportional',
    maxPoints,
    earnedPoints: earned,
    calculationReason: `${actualLabel}${unit} / ${targetLabel}${unit}`,
  });
}

export function calculateLimitNutrient({
  key,
  label,
  maxPoints,
  consumed,
  limit,
  unit = '',
  lowerIsBetter = false,
  goalMode,
  decimals = 2,
}) {
  const actual = Math.max(0, Number(consumed) || 0);
  const lim = Number(limit);
  const actualLabel = formatDisplayAmount(actual, decimals);
  const limitLabel = formatDisplayAmount(lim, decimals);
  if (!Number.isFinite(lim) || lim <= 0) {
    return buildParameterScore({
      key,
      label,
      section: 'nutrition',
      scoringMode: 'limit',
      maxPoints,
      earnedPoints: 0,
      calculationReason: 'Limit unavailable',
    });
  }
  if (lowerIsBetter) {
    if (actual <= 0) {
      return buildParameterScore({
        key,
        label,
        section: 'nutrition',
        scoringMode: 'limit',
        maxPoints,
        earnedPoints: 0,
        calculationReason: 'No GI data logged',
      });
    }
    if (actual > lim) {
      return buildParameterScore({
        key,
        label,
        section: 'nutrition',
        scoringMode: 'limit',
        maxPoints,
        earnedPoints: 0,
        calculationReason: `Above limit (${actualLabel}${unit} > ${limitLabel}${unit})`,
      });
    }
    return buildParameterScore({
      key,
      label,
      section: 'nutrition',
      scoringMode: 'limit',
      maxPoints,
      earnedPoints: maxPoints,
      calculationReason: `Within limit (${actualLabel}${unit} ≤ ${limitLabel}${unit})`,
    });
  }

  // Weight loss: binary — full points while within limit; exceeding limit = 0.
  if (!isGainGoalMode(goalMode)) {
    if (actual > lim) {
      return buildParameterScore({
        key,
        label,
        section: 'nutrition',
        scoringMode: 'limit',
        maxPoints,
        earnedPoints: 0,
        calculationReason: `Above limit (${actualLabel}${unit} > ${limitLabel}${unit})`,
      });
    }
    return buildParameterScore({
      key,
      label,
      section: 'nutrition',
      scoringMode: 'limit',
      maxPoints,
      earnedPoints: maxPoints,
      calculationReason: actual <= 0
        ? `Within limit (0${unit} ≤ ${limitLabel}${unit})`
        : `Within limit (${actualLabel}${unit} ≤ ${limitLabel}${unit})`,
    });
  }

  // Weight gain: proportional up to limit; exceeding limit = 0.
  if (actual > lim) {
    return buildParameterScore({
      key,
      label,
      section: 'nutrition',
      scoringMode: 'limit',
      maxPoints,
      earnedPoints: 0,
      calculationReason: `Above limit (${actualLabel}${unit} > ${limitLabel}${unit})`,
    });
  }
  if (actual <= 0) {
    return buildParameterScore({
      key,
      label,
      section: 'nutrition',
      scoringMode: 'limit',
      maxPoints,
      earnedPoints: 0,
      calculationReason: `0${unit} / ${limitLabel}${unit}`,
    });
  }
  const earned = roundEarned(actual / lim, maxPoints);
  return buildParameterScore({
    key,
    label,
    section: 'nutrition',
    scoringMode: 'limit',
    maxPoints,
    earnedPoints: earned,
    calculationReason: `${actualLabel}${unit} / ${limitLabel}${unit}`,
  });
}

// ─── Logging parameters ──────────────────────────────────────────────────────

export function calculateWeightPost({
  maxPoints, weightRecords, window, timezoneIana = IANA_IST,
}) {
  const base = calculateBinaryLogScore({
    maxPoints,
    records: weightRecords,
    window,
    activityLabel: 'Weight Post',
    timezoneIana,
    timestampKind: 'activity',
  });
  return { ...base, key: 'weight_post', label: 'Weight Post' };
}

export function calculateEducationPost({
  maxPoints, educationLogs, window, timezoneIana = IANA_IST,
}) {
  const logs = filterEducationLogsOnly(educationLogs);
  const base = calculateBinaryLogScore({
    maxPoints,
    records: logs,
    window,
    activityLabel: 'Education Post',
    timezoneIana,
    timestampKind: 'activity',
  });
  return { ...base, key: 'edu_post', label: 'Education Post' };
}

function solidFoodRecords(foodRecords) {
  return (foodRecords || []).filter((r) => !isExemptedBeverageOnly(r.AnalysisData));
}

export function calculateBreakfastPost({
  maxPoints, foodRecords, window, timezoneIana = IANA_IST,
}) {
  const meals = filterFoodByMealWindow(solidFoodRecords(foodRecords), window, timezoneIana);
  const base = calculateBinaryLogScore({
    maxPoints,
    records: meals,
    window,
    activityLabel: 'Breakfast Post',
    timezoneIana,
    timestampKind: 'food',
  });
  return { ...base, key: 'breakfast_post', label: 'Breakfast Post' };
}

export function calculateLunchPost({
  maxPoints, foodRecords, window, timezoneIana = IANA_IST,
}) {
  const meals = filterFoodByMealWindow(solidFoodRecords(foodRecords), window, timezoneIana);
  const base = calculateBinaryLogScore({
    maxPoints,
    records: meals,
    window,
    activityLabel: 'Lunch Post',
    timezoneIana,
    timestampKind: 'food',
  });
  return { ...base, key: 'lunch_post', label: 'Lunch Post' };
}

export function calculateDinnerPost({
  maxPoints, foodRecords, window, timezoneIana = IANA_IST,
}) {
  const meals = filterFoodByMealWindow(solidFoodRecords(foodRecords), window, timezoneIana);
  const base = calculateBinaryLogScore({
    maxPoints,
    records: meals,
    window,
    activityLabel: 'Dinner Post',
    timezoneIana,
    timestampKind: 'food',
  });
  return { ...base, key: 'dinner_post', label: 'Dinner Post' };
}

export function calculateWater({ maxPoints, consumedMl, requiredMl }) {
  return calculateWaterQuantity({ maxPoints, consumedMl, requiredMl });
}

// ─── Nutrition parameters ────────────────────────────────────────────────────

export function calculateCalories({ maxPoints, consumed, limit, goalMode }) {
  return calculateLimitNutrient({
    key: 'calories',
    label: 'Calories',
    maxPoints,
    consumed,
    limit,
    unit: ' kcal',
    goalMode,
  });
}

export function calculateCarbohydrates({ maxPoints, consumed, limit, goalMode }) {
  return calculateLimitNutrient({
    key: 'carbohydrates',
    label: 'Carbohydrates',
    maxPoints,
    consumed,
    limit,
    unit: 'g',
    goalMode,
  });
}

export function calculateFat({ maxPoints, consumed, limit, goalMode }) {
  return calculateLimitNutrient({
    key: 'fat',
    label: 'Fat',
    maxPoints,
    consumed,
    limit,
    unit: 'g',
    goalMode,
  });
}

export function calculateProtein({ maxPoints, consumed, target }) {
  return calculateTargetNutrient({
    key: 'protein',
    label: 'Protein',
    maxPoints,
    consumed,
    target,
    unit: 'g',
  });
}

export function calculateSodium({ maxPoints, consumed, limit, goalMode }) {
  return calculateLimitNutrient({
    key: 'sodium',
    label: 'Sodium',
    maxPoints,
    consumed,
    limit,
    unit: 'mg',
    goalMode,
  });
}

export function calculateCholesterol({ maxPoints, consumed, limit, goalMode }) {
  return calculateLimitNutrient({
    key: 'cholesterol',
    label: 'Cholesterol',
    maxPoints,
    consumed,
    limit,
    unit: 'mg',
    goalMode,
  });
}

export function calculateSugar({ maxPoints, consumed, limit, goalMode }) {
  return calculateLimitNutrient({
    key: 'sugar',
    label: 'Sugar',
    maxPoints,
    consumed,
    limit,
    unit: 'g',
    goalMode,
  });
}

export function calculateFiber({ maxPoints, consumed, target }) {
  return calculateTargetNutrient({
    key: 'fiber',
    label: 'Fiber',
    maxPoints,
    consumed,
    target,
    unit: 'g',
  });
}

export function calculateGi({ maxPoints, consumed, limit, goalMode }) {
  const gi = Number(consumed);

  if (isGainGoalMode(goalMode)) {
    return calculateLimitNutrient({
      key: 'gi',
      label: 'GI',
      maxPoints,
      consumed,
      limit,
      unit: '',
      lowerIsBetter: true,
      goalMode,
    });
  }

  if (!Number.isFinite(gi) || gi <= 0) {
    return buildParameterScore({
      key: 'gi',
      label: 'GI',
      section: 'nutrition',
      scoringMode: 'limit',
      maxPoints,
      earnedPoints: 0,
      calculationReason: 'No GI data logged',
    });
  }

  if (gi >= GI_HIGH_MIN) {
    return buildParameterScore({
      key: 'gi',
      label: 'GI',
      section: 'nutrition',
      scoringMode: 'limit',
      maxPoints,
      earnedPoints: 0,
      calculationReason: `High GI (${gi})`,
    });
  }

  return buildParameterScore({
    key: 'gi',
    label: 'GI',
    section: 'nutrition',
    scoringMode: 'limit',
    maxPoints,
    earnedPoints: maxPoints,
    calculationReason: `Low/medium GI (${gi})`,
  });
}

export function calculateVitaminA({ maxPoints, consumed, target }) {
  return calculateTargetNutrient({ key: 'vitamin_a', label: 'Vitamin A', maxPoints, consumed, target, unit: 'mcg' });
}
export function calculateVitaminC({ maxPoints, consumed, target }) {
  return calculateTargetNutrient({ key: 'vitamin_c', label: 'Vitamin C', maxPoints, consumed, target, unit: 'mg' });
}
export function calculateVitaminD({ maxPoints, consumed, target }) {
  return calculateTargetNutrient({ key: 'vitamin_d', label: 'Vitamin D', maxPoints, consumed, target, unit: 'mcg' });
}
export function calculateVitaminE({ maxPoints, consumed, target }) {
  return calculateTargetNutrient({
    key: 'vitamin_e',
    label: 'Vitamin E',
    maxPoints,
    consumed,
    target,
    unit: 'mg',
    decimals: 1,
  });
}
export function calculateVitaminK({ maxPoints, consumed, target }) {
  return calculateTargetNutrient({ key: 'vitamin_k', label: 'Vitamin K', maxPoints, consumed, target, unit: 'mcg' });
}
export function calculateVitaminB1({ maxPoints, consumed, target }) {
  return calculateTargetNutrient({ key: 'vitamin_b1', label: 'Vitamin B1', maxPoints, consumed, target, unit: 'mg' });
}
export function calculateVitaminB2({ maxPoints, consumed, target }) {
  return calculateTargetNutrient({ key: 'vitamin_b2', label: 'Vitamin B2', maxPoints, consumed, target, unit: 'mg' });
}
export function calculateVitaminB3({ maxPoints, consumed, target }) {
  return calculateTargetNutrient({ key: 'vitamin_b3', label: 'Vitamin B3', maxPoints, consumed, target, unit: 'mg' });
}
export function calculateVitaminB6({ maxPoints, consumed, target }) {
  return calculateTargetNutrient({ key: 'vitamin_b6', label: 'Vitamin B6', maxPoints, consumed, target, unit: 'mg' });
}
export function calculateVitaminB9({ maxPoints, consumed, target }) {
  return calculateTargetNutrient({ key: 'vitamin_b9', label: 'Vitamin B9', maxPoints, consumed, target, unit: 'mcg' });
}
export function calculateVitaminB12({ maxPoints, consumed, target }) {
  return calculateTargetNutrient({ key: 'vitamin_b12', label: 'Vitamin B12', maxPoints, consumed, target, unit: 'mcg' });
}
export function calculateCalcium({ maxPoints, consumed, target }) {
  return calculateTargetNutrient({ key: 'calcium', label: 'Calcium', maxPoints, consumed, target, unit: 'mg' });
}
export function calculateIron({ maxPoints, consumed, target }) {
  return calculateTargetNutrient({ key: 'iron', label: 'Iron', maxPoints, consumed, target, unit: 'mg' });
}
export function calculateMagnesium({ maxPoints, consumed, target }) {
  return calculateTargetNutrient({ key: 'magnesium', label: 'Magnesium', maxPoints, consumed, target, unit: 'mg' });
}
export function calculatePotassium({ maxPoints, consumed, target }) {
  return calculateTargetNutrient({ key: 'potassium', label: 'Potassium', maxPoints, consumed, target, unit: 'mg' });
}
export function calculateZinc({ maxPoints, consumed, target }) {
  return calculateTargetNutrient({ key: 'zinc', label: 'Zinc', maxPoints, consumed, target, unit: 'mg' });
}
export function calculatePhosphorus({ maxPoints, consumed, target }) {
  return calculateTargetNutrient({ key: 'phosphorus', label: 'Phosphorus', maxPoints, consumed, target, unit: 'mg' });
}

// ─── Progress parameters ───────────────────────────────────────────────────────

export function calculateWeightImprovement({
  maxPoints,
  currentWeight,
  previousWeight,
  goalMode,
}) {
  const cur = Number(currentWeight);
  const prev = Number(previousWeight);
  if (!Number.isFinite(cur) || !Number.isFinite(prev) || prev <= 0) {
    return buildParameterScore({
      key: 'weight_improvement',
      label: 'Weight Improvement',
      section: 'progress',
      scoringMode: 'progress',
      maxPoints,
      earnedPoints: 0,
      calculationReason: 'Previous weight unavailable',
    });
  }
  const mode = String(goalMode || 'loss').toLowerCase();
  let progressed = false;
  if (mode === 'gain') {
    progressed = cur > prev;
  } else {
    progressed = cur < prev;
  }
  return buildParameterScore({
    key: 'weight_improvement',
    label: 'Weight Improvement',
    section: 'progress',
    scoringMode: 'progress',
    maxPoints,
    earnedPoints: progressed ? maxPoints : 0,
    calculationReason: progressed
      ? `Progress toward ${mode} goal (${prev} → ${cur} kg)`
      : `No progress toward ${mode} goal (${prev} → ${cur} kg)`,
  });
}

export function calculatePhysicalActivity({ maxPoints, exerciseCalories, bmr }) {
  const burned = Math.max(0, Number(exerciseCalories) || 0);
  const bmrVal = Number(bmr);
  if (!Number.isFinite(bmrVal) || bmrVal <= 0) {
    return buildParameterScore({
      key: 'physical_activity',
      label: 'Physical Activity',
      section: 'progress',
      scoringMode: 'proportional',
      maxPoints,
      earnedPoints: 0,
      calculationReason: 'BMR unavailable',
    });
  }
  const target = bmrVal * 0.3;
  if (burned >= target) {
    return buildParameterScore({
      key: 'physical_activity',
      label: 'Physical Activity',
      section: 'progress',
      scoringMode: 'proportional',
      maxPoints,
      earnedPoints: maxPoints,
      calculationReason: `Target reached (${Math.round(burned)} / ${Math.round(target)} kcal)`,
    });
  }
  const earned = roundEarned(burned / target, maxPoints);
  return buildParameterScore({
    key: 'physical_activity',
    label: 'Physical Activity',
    section: 'progress',
    scoringMode: 'proportional',
    maxPoints,
    earnedPoints: earned,
    calculationReason: `${Math.round(burned)} / ${Math.round(target)} kcal (30% BMR)`,
  });
}

// ─── Aggregate daily totals from food records ────────────────────────────────

const FOOD_NUM_FIELDS = [
  'TotalCalories',
  'TotalCarbs',
  'TotalFat',
  'TotalProtein',
  'TotalSodium',
  'TotalCholesterol',
  'TotalSugar',
  'TotalFiber',
  'TotalVitaminA',
  'TotalVitaminC',
  'TotalVitaminD',
  'TotalVitaminE',
  'TotalVitaminK',
  'TotalVitaminB1',
  'TotalVitaminB2',
  'TotalVitaminB3',
  'TotalVitaminB6',
  'TotalVitaminB9',
  'TotalVitaminB12',
  'TotalCalcium',
  'TotalIron',
  'TotalMagnesium',
  'TotalPotassium',
  'TotalZinc',
  'TotalPhosphorus',
];

const FIELD_TO_STATS_KEY = {
  TotalCalories: 'totalCalories',
  TotalCarbs: 'totalCarbs',
  TotalFat: 'totalFat',
  TotalProtein: 'totalProtein',
  TotalSodium: 'totalSodium',
  TotalCholesterol: 'totalCholesterol',
  TotalSugar: 'totalSugar',
  TotalFiber: 'totalFiber',
  TotalVitaminA: 'totalVitaminA',
  TotalVitaminC: 'totalVitaminC',
  TotalVitaminD: 'totalVitaminD',
  TotalVitaminE: 'totalVitaminE',
  TotalVitaminK: 'totalVitaminK',
  TotalVitaminB1: 'totalVitaminB1',
  TotalVitaminB2: 'totalVitaminB2',
  TotalVitaminB3: 'totalVitaminB3',
  TotalVitaminB6: 'totalVitaminB6',
  TotalVitaminB9: 'totalVitaminB9',
  TotalVitaminB12: 'totalVitaminB12',
  TotalCalcium: 'totalCalcium',
  TotalIron: 'totalIron',
  TotalMagnesium: 'totalMagnesium',
  TotalPotassium: 'totalPotassium',
  TotalZinc: 'totalZinc',
  TotalPhosphorus: 'totalPhosphorus',
};

export function aggregateDailyFoodStats(foodRecords = []) {
  const stats = Object.fromEntries(
    Object.values(FIELD_TO_STATS_KEY).map((k) => [k, 0]),
  );
  stats.averageGlycemicIndex = null;

  const giValues = [];
  for (const row of foodRecords) {
    if (isExemptedBeverageOnly(row.AnalysisData)) continue;
    for (const field of FOOD_NUM_FIELDS) {
      const key = FIELD_TO_STATS_KEY[field];
      stats[key] += Number(row[field]) || 0;
    }
    const gi = Number(row.GlycemicIndex);
    if (Number.isFinite(gi) && gi > 0) giValues.push(gi);
  }

  if (giValues.length) {
    stats.averageGlycemicIndex = Math.round(
      giValues.reduce((s, v) => s + v, 0) / giValues.length,
    );
  }

  return stats;
}

const CALCULATOR_BY_KEY = {
  weight_post: (cfg, ctx) =>
    calculateWeightPost({
      maxPoints: cfg.maxPoints,
      weightRecords: ctx.weightRecords,
      window: ctx.timeWindows.weight,
      timezoneIana: ctx.timezoneIana,
    }),
  edu_post: (cfg, ctx) =>
    calculateEducationPost({
      maxPoints: cfg.maxPoints,
      educationLogs: ctx.educationLogs,
      window: ctx.timeWindows.education,
      timezoneIana: ctx.timezoneIana,
    }),
  breakfast_post: (cfg, ctx) =>
    calculateBreakfastPost({
      maxPoints: cfg.maxPoints,
      foodRecords: ctx.foodRecords,
      window: ctx.timeWindows.breakfast,
      timezoneIana: ctx.timezoneIana,
    }),
  lunch_post: (cfg, ctx) =>
    calculateLunchPost({
      maxPoints: cfg.maxPoints,
      foodRecords: ctx.foodRecords,
      window: ctx.timeWindows.lunch,
      timezoneIana: ctx.timezoneIana,
    }),
  dinner_post: (cfg, ctx) =>
    calculateDinnerPost({
      maxPoints: cfg.maxPoints,
      foodRecords: ctx.foodRecords,
      window: ctx.timeWindows.dinner,
      timezoneIana: ctx.timezoneIana,
    }),
  water_qty: (cfg, ctx) =>
    calculateWater({ maxPoints: cfg.maxPoints, consumedMl: ctx.waterConsumedMl, requiredMl: ctx.waterRequiredMl }),
  calories: (cfg, ctx) =>
    calculateCalories({
      maxPoints: cfg.maxPoints,
      consumed: ctx.dailyStats.totalCalories,
      limit: ctx.nutritionTargets.totalCalories,
      goalMode: ctx.goalMode,
    }),
  carbohydrates: (cfg, ctx) =>
    calculateCarbohydrates({
      maxPoints: cfg.maxPoints,
      consumed: ctx.dailyStats.totalCarbs,
      limit: ctx.nutritionTargets.totalCarbs,
      goalMode: ctx.goalMode,
    }),
  fat: (cfg, ctx) =>
    calculateFat({
      maxPoints: cfg.maxPoints,
      consumed: ctx.dailyStats.totalFat,
      limit: ctx.nutritionTargets.totalFat,
      goalMode: ctx.goalMode,
    }),
  protein: (cfg, ctx) =>
    calculateProtein({ maxPoints: cfg.maxPoints, consumed: ctx.dailyStats.totalProtein, target: ctx.nutritionTargets.totalProtein }),
  sodium: (cfg, ctx) =>
    calculateSodium({
      maxPoints: cfg.maxPoints,
      consumed: ctx.dailyStats.totalSodium,
      limit: ctx.nutritionTargets.totalSodium,
      goalMode: ctx.goalMode,
    }),
  cholesterol: (cfg, ctx) =>
    calculateCholesterol({
      maxPoints: cfg.maxPoints,
      consumed: ctx.dailyStats.totalCholesterol,
      limit: ctx.nutritionTargets.totalCholesterol,
      goalMode: ctx.goalMode,
    }),
  sugar: (cfg, ctx) =>
    calculateSugar({
      maxPoints: cfg.maxPoints,
      consumed: ctx.dailyStats.totalSugar,
      limit: ctx.nutritionTargets.totalSugar,
      goalMode: ctx.goalMode,
    }),
  fiber: (cfg, ctx) =>
    calculateFiber({ maxPoints: cfg.maxPoints, consumed: ctx.dailyStats.totalFiber, target: ctx.nutritionTargets.totalFiber }),
  gi: (cfg, ctx) => {
    const gi = ctx.dailyStats.averageGlycemicIndex;
    if (gi == null) {
      return buildParameterScore({
        key: 'gi',
        label: 'GI',
        section: 'nutrition',
        scoringMode: 'limit',
        maxPoints: cfg.maxPoints,
        earnedPoints: 0,
        calculationReason: 'No GI data logged',
      });
    }
    return calculateGi({
      maxPoints: cfg.maxPoints,
      consumed: gi,
      limit: ctx.nutritionTargets.averageGlycemicIndex,
      goalMode: ctx.goalMode,
    });
  },
  vitamin_a: (cfg, ctx) =>
    calculateVitaminA({ maxPoints: cfg.maxPoints, consumed: ctx.dailyStats.totalVitaminA, target: ctx.nutritionTargets.totalVitaminA }),
  vitamin_c: (cfg, ctx) =>
    calculateVitaminC({ maxPoints: cfg.maxPoints, consumed: ctx.dailyStats.totalVitaminC, target: ctx.nutritionTargets.totalVitaminC }),
  vitamin_d: (cfg, ctx) =>
    calculateVitaminD({ maxPoints: cfg.maxPoints, consumed: ctx.dailyStats.totalVitaminD, target: ctx.nutritionTargets.totalVitaminD }),
  vitamin_e: (cfg, ctx) =>
    calculateVitaminE({ maxPoints: cfg.maxPoints, consumed: ctx.dailyStats.totalVitaminE, target: ctx.nutritionTargets.totalVitaminE }),
  vitamin_k: (cfg, ctx) =>
    calculateVitaminK({ maxPoints: cfg.maxPoints, consumed: ctx.dailyStats.totalVitaminK, target: ctx.nutritionTargets.totalVitaminK }),
  vitamin_b1: (cfg, ctx) =>
    calculateVitaminB1({ maxPoints: cfg.maxPoints, consumed: ctx.dailyStats.totalVitaminB1, target: ctx.nutritionTargets.totalVitaminB1 }),
  vitamin_b2: (cfg, ctx) =>
    calculateVitaminB2({ maxPoints: cfg.maxPoints, consumed: ctx.dailyStats.totalVitaminB2, target: ctx.nutritionTargets.totalVitaminB2 }),
  vitamin_b3: (cfg, ctx) =>
    calculateVitaminB3({ maxPoints: cfg.maxPoints, consumed: ctx.dailyStats.totalVitaminB3, target: ctx.nutritionTargets.totalVitaminB3 }),
  vitamin_b6: (cfg, ctx) =>
    calculateVitaminB6({ maxPoints: cfg.maxPoints, consumed: ctx.dailyStats.totalVitaminB6, target: ctx.nutritionTargets.totalVitaminB6 }),
  vitamin_b9: (cfg, ctx) =>
    calculateVitaminB9({ maxPoints: cfg.maxPoints, consumed: ctx.dailyStats.totalVitaminB9, target: ctx.nutritionTargets.totalVitaminB9 }),
  vitamin_b12: (cfg, ctx) =>
    calculateVitaminB12({ maxPoints: cfg.maxPoints, consumed: ctx.dailyStats.totalVitaminB12, target: ctx.nutritionTargets.totalVitaminB12 }),
  calcium: (cfg, ctx) =>
    calculateCalcium({ maxPoints: cfg.maxPoints, consumed: ctx.dailyStats.totalCalcium, target: ctx.nutritionTargets.totalCalcium }),
  iron: (cfg, ctx) =>
    calculateIron({ maxPoints: cfg.maxPoints, consumed: ctx.dailyStats.totalIron, target: ctx.nutritionTargets.totalIron }),
  magnesium: (cfg, ctx) =>
    calculateMagnesium({ maxPoints: cfg.maxPoints, consumed: ctx.dailyStats.totalMagnesium, target: ctx.nutritionTargets.totalMagnesium }),
  potassium: (cfg, ctx) =>
    calculatePotassium({ maxPoints: cfg.maxPoints, consumed: ctx.dailyStats.totalPotassium, target: ctx.nutritionTargets.totalPotassium }),
  zinc: (cfg, ctx) =>
    calculateZinc({ maxPoints: cfg.maxPoints, consumed: ctx.dailyStats.totalZinc, target: ctx.nutritionTargets.totalZinc }),
  phosphorus: (cfg, ctx) =>
    calculatePhosphorus({ maxPoints: cfg.maxPoints, consumed: ctx.dailyStats.totalPhosphorus, target: ctx.nutritionTargets.totalPhosphorus }),
  weight_improvement: (cfg, ctx) =>
    calculateWeightImprovement({
      maxPoints: cfg.maxPoints,
      currentWeight: ctx.currentWeight,
      previousWeight: ctx.previousWeight,
      goalMode: ctx.goalMode,
    }),
  physical_activity: (cfg, ctx) =>
    calculatePhysicalActivity({ maxPoints: cfg.maxPoints, exerciseCalories: ctx.exerciseCalories, bmr: ctx.bmr }),
};

/**
 * Aggregate all 34 parameter scores into total wellness score.
 */
export function calculateWellnessScore({
  parameterConfig,
  educationLogs,
  weightRecords,
  foodRecords,
  waterConsumedMl,
  waterRequiredMl,
  timeWindows,
  dailyStats,
  nutritionTargets,
  currentWeight,
  previousWeight,
  goalMode,
  exerciseCalories,
  bmr,
  timezoneIana = IANA_IST,
}) {
  const ctx = {
    educationLogs,
    weightRecords,
    foodRecords,
    waterConsumedMl,
    waterRequiredMl,
    timeWindows,
    dailyStats,
    nutritionTargets,
    currentWeight,
    previousWeight,
    goalMode,
    exerciseCalories,
    bmr,
    timezoneIana,
  };

  const parameters = [];
  let totalEarned = 0;
  let totalPossible = 0;

  for (const cfg of parameterConfig) {
    if (!cfg.enabled) continue;
    const calc = CALCULATOR_BY_KEY[cfg.key];
    if (!calc) continue;
    const score = calc(cfg, ctx);
    parameters.push(score);
    totalEarned += score.earnedPoints;
    totalPossible += score.maxPoints;
  }

  const percentage = totalPossible > 0 ? Math.round((totalEarned / totalPossible) * 100) : 0;

  return {
    parameters,
    totalEarned,
    totalPossible,
    percentage,
  };
}

/** @deprecated Use calculateWellnessScore */
export function calculateOverallWellnessScore() {
  throw new Error('calculateOverallWellnessScore is removed; use calculateWellnessScore');
}

export { WELLNESS_PARAMETERS };
