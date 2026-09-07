/**
 * Build contribution rows for a wellness score parameter (mirrors nutrition
 * macros FoodBreakdownModal: name + amount + % of day total).
 */

import { PARAMETER_TIME_WINDOW_KEYS, formatClockTime } from './parameterIcons';

const WINDOW_BUFFER_SECONDS = 59;

/** Wellness param key → per-food nutrition field + optional meal-level DB column. */
export const NUTRIENT_CONTRIBUTION_MAP = Object.freeze({
  calories: { nutritionKeys: ['calories'], unit: 'kcal', dbCol: 'TotalCalories', decimals: 0 },
  carbohydrates: { nutritionKeys: ['carbs'], unit: 'g', dbCol: 'TotalCarbs', decimals: 0 },
  fat: { nutritionKeys: ['fat'], unit: 'g', dbCol: 'TotalFat', decimals: 0 },
  protein: { nutritionKeys: ['protein'], unit: 'g', dbCol: 'TotalProtein', decimals: 0 },
  sodium: { nutritionKeys: ['sodium'], unit: 'mg', dbCol: 'TotalSodium', decimals: 0 },
  cholesterol: { nutritionKeys: ['cholesterol'], unit: 'mg', dbCol: 'TotalCholesterol', decimals: 0 },
  sugar: { nutritionKeys: ['sugar'], unit: 'g', dbCol: 'TotalSugar', decimals: 0 },
  fiber: { nutritionKeys: ['fiber'], unit: 'g', dbCol: 'TotalFiber', decimals: 0 },
  vitamin_a: { nutritionKeys: ['vitamin_a', 'vitaminA'], unit: 'µg', dbCol: 'TotalVitaminA', decimals: 0 },
  vitamin_c: { nutritionKeys: ['vitamin_c', 'vitaminC'], unit: 'mg', dbCol: 'TotalVitaminC', decimals: 0 },
  vitamin_d: { nutritionKeys: ['vitamin_d', 'vitaminD'], unit: 'µg', dbCol: 'TotalVitaminD', decimals: 1 },
  vitamin_e: { nutritionKeys: ['vitamin_e', 'vitaminE'], unit: 'mg', dbCol: 'TotalVitaminE', decimals: 1 },
  vitamin_k: { nutritionKeys: ['vitamin_k', 'vitaminK'], unit: 'µg', dbCol: 'TotalVitaminK', decimals: 0 },
  vitamin_b1: { nutritionKeys: ['vitamin_b1', 'vitaminB1', 'thiamin'], unit: 'mg', dbCol: 'TotalVitaminB1', decimals: 2 },
  vitamin_b2: { nutritionKeys: ['vitamin_b2', 'vitaminB2', 'riboflavin'], unit: 'mg', dbCol: 'TotalVitaminB2', decimals: 2 },
  vitamin_b3: { nutritionKeys: ['vitamin_b3', 'vitaminB3', 'niacin'], unit: 'mg', dbCol: 'TotalVitaminB3', decimals: 1 },
  vitamin_b6: { nutritionKeys: ['vitamin_b6', 'vitaminB6'], unit: 'mg', dbCol: 'TotalVitaminB6', decimals: 2 },
  vitamin_b9: { nutritionKeys: ['vitamin_b9', 'vitaminB9', 'folate'], unit: 'µg', dbCol: 'TotalVitaminB9', decimals: 0 },
  vitamin_b12: { nutritionKeys: ['vitamin_b12', 'vitaminB12'], unit: 'µg', dbCol: 'TotalVitaminB12', decimals: 2 },
  calcium: { nutritionKeys: ['calcium'], unit: 'mg', dbCol: 'TotalCalcium', decimals: 0 },
  iron: { nutritionKeys: ['iron'], unit: 'mg', dbCol: 'TotalIron', decimals: 1 },
  magnesium: { nutritionKeys: ['magnesium'], unit: 'mg', dbCol: 'TotalMagnesium', decimals: 0 },
  potassium: { nutritionKeys: ['potassium'], unit: 'mg', dbCol: 'TotalPotassium', decimals: 0 },
  zinc: { nutritionKeys: ['zinc'], unit: 'mg', dbCol: 'TotalZinc', decimals: 1 },
  phosphorus: { nutritionKeys: ['phosphorus'], unit: 'mg', dbCol: 'TotalPhosphorus', decimals: 0 },
});

const MEAL_POST_KEYS = new Set(['breakfast_post', 'lunch_post', 'dinner_post']);

function parseAnalysisData(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function addBufferToTime(timeStr) {
  if (!timeStr) return timeStr;
  const [h, m, s] = String(timeStr).split(':').map(Number);
  const totalSecs = h * 3600 + m * 60 + (s || 0) + WINDOW_BUFFER_SECONDS;
  const nh = Math.floor(totalSecs / 3600) % 24;
  const nm = Math.floor((totalSecs % 3600) / 60);
  const ns = totalSecs % 60;
  return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}:${String(ns).padStart(2, '0')}`;
}

function extractClock(createdAt) {
  const match = String(createdAt || '').match(/(\d{2}:\d{2}:\d{2})/);
  return match ? match[1] : null;
}

function mealDisplayName(analysis) {
  const data = parseAnalysisData(analysis.AnalysisData);
  const foods = data.foods || [];
  if (foods.length) {
    return foods
      .map((f) => f.name || f.foodName)
      .filter(Boolean)
      .slice(0, 3)
      .join(', ') || 'Meal';
  }
  return 'Meal';
}

function readNutritionAmount(nutrition, keys) {
  for (const key of keys) {
    const v = Number(nutrition?.[key]);
    if (Number.isFinite(v) && v > 0) return v;
  }
  return 0;
}

/** True when the amount would display as 0 with the modal's decimal places. */
export function roundsToZeroDisplay(amount, decimals = 0) {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) return true;
  if (decimals > 0) return Number(n.toFixed(decimals)) === 0;
  return Math.round(n) === 0;
}

/**
 * @returns {{ foodName: string, amount: number, percentage: number }[]}
 */
export function extractNutrientContributions(meals, paramKey) {
  const cfg = NUTRIENT_CONTRIBUTION_MAP[paramKey];
  if (!cfg) return { breakdown: [], total: 0, unit: '', decimals: 0 };

  const foods = [];

  for (const analysis of meals || []) {
    if (analysis?.isUndoPlaceholder) continue;
    const data = parseAnalysisData(analysis.AnalysisData);
    const foodList = data.foods || [];
    const mealFoods = [];

    for (const food of foodList) {
      const amount = readNutritionAmount(food.nutrition || {}, cfg.nutritionKeys);
      if (!roundsToZeroDisplay(amount, cfg.decimals)) {
        mealFoods.push({ foodName: food.name || food.foodName || 'Unknown food', amount });
      }
    }

    if (mealFoods.length > 0) {
      mealFoods.forEach((f) => foods.push(f));
    } else if (cfg.dbCol) {
      const mealTotal = Number(analysis[cfg.dbCol]) || 0;
      if (!roundsToZeroDisplay(mealTotal, cfg.decimals)) {
        foods.push({ foodName: mealDisplayName(analysis), amount: mealTotal });
      }
    }
  }

  const total = foods.reduce((sum, f) => sum + f.amount, 0);
  const breakdown = foods
    .sort((a, b) => b.amount - a.amount)
    .map((f) => ({
      ...f,
      percentage: total > 0 ? (f.amount / total) * 100 : 0,
    }));

  return { breakdown, total, unit: cfg.unit, decimals: cfg.decimals };
}

/**
 * Meals whose CreatedAt clock falls in a logging window.
 */
export function extractMealWindowContributions(meals, parameterKey, timeWindows) {
  const windowKey = PARAMETER_TIME_WINDOW_KEYS[parameterKey];
  const mealWindow = windowKey ? timeWindows?.[windowKey] : null;
  if (!mealWindow?.start || !mealWindow?.end) {
    return { breakdown: [], total: 0, unit: '', listLabel: 'Logs in window' };
  }

  const endWithBuffer = addBufferToTime(mealWindow.end);
  const rows = [];

  for (const analysis of meals || []) {
    if (analysis?.isUndoPlaceholder) continue;
    const time = extractClock(analysis.CreatedAt);
    if (!time || time < mealWindow.start || time > endWithBuffer) continue;
    const clockLabel = formatClockTime(time) || time;
    rows.push({
      foodName: mealDisplayName(analysis),
      detail: clockLabel,
      amount: 1,
      amountLabel: clockLabel,
    });
  }

  const total = rows.length;
  const breakdown = rows.map((r) => ({
    foodName: r.detail ? `${r.foodName}` : r.foodName,
    detail: r.detail,
    amount: r.amount,
    amountLabel: r.amountLabel,
    percentage: total > 0 ? (100 / total) : 0,
  }));

  return {
    breakdown,
    total,
    unit: '',
    listLabel: 'Meals in this window',
    emptyHint: 'No meals logged in this time window',
  };
}

/**
 * GI: one row per meal with a GI value.
 */
export function extractGiContributions(meals) {
  const rows = [];
  for (const analysis of meals || []) {
    if (analysis?.isUndoPlaceholder) continue;
    const gi = Number(analysis.GlycemicIndex);
    if (!Number.isFinite(gi) || gi <= 0) continue;
    const time = extractClock(analysis.CreatedAt);
    rows.push({
      foodName: mealDisplayName(analysis),
      detail: time ? formatClockTime(time) : null,
      amount: gi,
      percentage: 0,
    });
  }
  const avg = rows.length
    ? rows.reduce((s, r) => s + r.amount, 0) / rows.length
    : 0;
  const breakdown = rows
    .sort((a, b) => b.amount - a.amount)
    .map((r) => ({
      ...r,
      percentage: avg > 0 ? (r.amount / avg) * 100 : 0,
    }));
  return {
    breakdown,
    total: avg,
    unit: 'GI',
    decimals: 0,
    listLabel: 'Meals by glycemic index',
    emptyHint: 'No GI data logged',
  };
}

/**
 * @param {{
 *   parameter: object,
 *   meals?: object[],
 *   timeWindows?: object|null,
 * }} args
 */
export function buildParameterContributionView({ parameter, meals = [], timeWindows = null }) {
  const key = parameter?.key;
  const earned = Math.round(parameter?.earnedPoints ?? 0);
  const max = Math.round(parameter?.maxPoints ?? 0);
  const base = {
    key,
    title: parameter?.label || key,
    earnedPoints: earned,
    maxPoints: max,
    percentage: max > 0 ? Math.round((earned / max) * 100) : 0,
    calculationReason: parameter?.calculationReason || null,
    scoringMode: parameter?.scoringMode || null,
    listLabel: 'Top contributing foods',
    emptyHint: 'No contributing foods logged',
    unit: '',
    totalConsumed: null,
    decimals: 0,
    breakdown: [],
    showAmountPercent: true,
  };

  if (!key) return base;

  if (NUTRIENT_CONTRIBUTION_MAP[key]) {
    const { breakdown, total, unit, decimals } = extractNutrientContributions(meals, key);
    return {
      ...base,
      breakdown,
      totalConsumed: total,
      unit,
      decimals,
      listLabel: 'Top contributing foods',
      emptyHint: 'No foods logged for this nutrient',
    };
  }

  if (key === 'gi') {
    const gi = extractGiContributions(meals);
    return {
      ...base,
      ...gi,
      totalConsumed: gi.total,
      showAmountPercent: false,
    };
  }

  if (MEAL_POST_KEYS.has(key)) {
    const meal = extractMealWindowContributions(meals, key, timeWindows);
    return {
      ...base,
      breakdown: meal.breakdown,
      totalConsumed: meal.total,
      unit: meal.unit,
      listLabel: meal.listLabel,
      emptyHint: meal.emptyHint,
      showAmountPercent: false,
      amountIsLabel: true,
    };
  }

  // Logging / progress params without a food contribution list — reason-only card.
  return {
    ...base,
    listLabel: 'How this scored',
    emptyHint: parameter?.calculationReason || 'No contribution details for this parameter',
    breakdown: parameter?.calculationReason
      ? [{
          foodName: parameter.calculationReason,
          amount: earned,
          amountLabel: `${earned}/${max} pts`,
          percentage: max > 0 ? (earned / max) * 100 : 0,
        }]
      : [],
    showAmountPercent: true,
    amountIsLabel: true,
  };
}

export function parameterNeedsMeals(parameterKey) {
  if (!parameterKey) return false;
  if (NUTRIENT_CONTRIBUTION_MAP[parameterKey]) return true;
  if (parameterKey === 'gi') return true;
  if (MEAL_POST_KEYS.has(parameterKey)) return true;
  return false;
}
