// Pure helpers used across the nutrition dashboard.
// These do NOT touch the network — see *Api.js modules for fetches.
import { computeMealGlycemicIndex } from '../../domain/mealGlycemicIndex';

/** Calories for a single food item from canonical or legacy shapes. */
const foodItemCalories = (food) =>
  Number(food?.nutrition?.calories ?? food?.calories ?? 0);

/**
 * Compact multi-food title: highest-calorie dish + extra count.
 * e.g. "Dosa+2more" for 3 items when Dosa has the most kcal.
 */
export const formatFoodsTitle = (foods) => {
  const items = Array.isArray(foods) ? foods.filter(Boolean) : [];
  const count = items.length;
  if (count === 0) return 'Unknown Food';
  if (count === 1) return (items[0]?.name || 'Unknown Food').trim();

  const top = [...items].sort((a, b) => foodItemCalories(b) - foodItemCalories(a))[0];
  const topName = (top?.name || 'Unknown Food').trim();
  return `${topName}+${count - 1}more`;
};

/** Treat API timestamps without trailing-Z as UTC wall time. */
export const parseMealTimestamp = (value) => {
  if (!value) return null;
  if (value instanceof Date) return new Date(value.getTime());
  if (typeof value === 'string') {
    const normalized = value.trim().replace(' ', 'T');
    const withZone = normalized.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(normalized)
      ? normalized
      : `${normalized}Z`;
    const parsed = new Date(withZone);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  const fallback = new Date(value);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
};

export const getMealCategory = (timeString, timezoneIana = 'Asia/Kolkata') => {
  const date = parseMealTimestamp(timeString);
  if (!date) return 'late-night';
  const hour = Number(new Intl.DateTimeFormat('en-US', {
    timeZone: timezoneIana,
    hour: 'numeric',
    hour12: false,
  }).format(date));
  if (hour >= 5 && hour < 10) return 'breakfast';
  if (hour >= 10 && hour < 12) return 'morning-snack';
  if (hour >= 12 && hour < 16) return 'lunch';
  if (hour >= 16 && hour < 18) return 'evening-snack';
  if (hour >= 18 && hour < 23) return 'dinner';
  return 'late-night';
};

export const toLocalDateString = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

/** Parse a meal's AnalysisData column into { name, nutrition, detailedItems }. */
export const parseAnalysisData = (analysisData) => {
  try {
    const parsed = typeof analysisData === 'string' ? JSON.parse(analysisData) : analysisData;
    if (parsed?.foods?.length > 0 && parsed?.total) {
      return {
        name: formatFoodsTitle(parsed.foods),
        nutrition: {
          calories: parsed.total.calories || 0,
          protein:  parsed.total.protein  || 0,
          carbs:    parsed.total.carbs    || 0,
          fat:      parsed.total.fat      || 0,
          fiber:    parsed.total.fiber    || 0,
          sugar:       parsed.total.sugar       ?? null,
          sodium:      parsed.total.sodium      ?? null,
          cholesterol: parsed.total.cholesterol ?? null,
          glycemic_index: parsed.total.glycemic_index ?? null,
          // 17 vitamin/mineral fields — populated when AI returns full schema
          vitamin_a:   parsed.total.vitamin_a   ?? null,
          vitamin_c:   parsed.total.vitamin_c   ?? null,
          vitamin_d:   parsed.total.vitamin_d   ?? null,
          vitamin_e:   parsed.total.vitamin_e   ?? null,
          vitamin_k:   parsed.total.vitamin_k   ?? null,
          vitamin_b1:  parsed.total.vitamin_b1  ?? null,
          vitamin_b2:  parsed.total.vitamin_b2  ?? null,
          vitamin_b3:  parsed.total.vitamin_b3  ?? null,
          vitamin_b6:  parsed.total.vitamin_b6  ?? null,
          vitamin_b9:  parsed.total.vitamin_b9  ?? null,
          vitamin_b12: parsed.total.vitamin_b12 ?? null,
          calcium:     parsed.total.calcium     ?? null,
          iron:        parsed.total.iron        ?? null,
          magnesium:   parsed.total.magnesium   ?? null,
          potassium:   parsed.total.potassium   ?? null,
          zinc:        parsed.total.zinc        ?? null,
          phosphorus:  parsed.total.phosphorus  ?? null,
        },
        detailedItems: parsed.foods || [],
      };
    }
    if (parsed?.category?.name) {
      const items = parsed.detailedItems || [];
      return {
        name: items.length > 1 ? formatFoodsTitle(items) : parsed.category.name,
        nutrition: parsed.nutrition || {},
        detailedItems: items,
      };
    }
    if (parsed?.foods?.length > 0) {
      const firstFood = parsed.foods[0] || {};
      return { name: formatFoodsTitle(parsed.foods), nutrition: firstFood.nutrition || {}, detailedItems: parsed.foods || [] };
    }
    return { name: 'Unknown Food', nutrition: {}, detailedItems: [] };
  } catch {
    return { name: 'Error parsing data', nutrition: {}, detailedItems: [] };
  }
};

/** Sum & round per-item nutrition into day/meal totals. */
export const recalculateTotals = (items) => {
  const list = Array.isArray(items) ? items : [];
  const t = list.reduce(
    (acc, item) => {
      const n = item.nutrition || {};
      const itemCarbs = n.carbs ?? item.carbs ?? 0;
      return {
        calories:    acc.calories    + (n.calories    ?? item.calories    ?? 0),
        protein:     acc.protein     + (n.protein     ?? item.protein     ?? 0),
        carbs:       acc.carbs       + itemCarbs,
        fat:         acc.fat         + (n.fat         ?? item.fat         ?? 0),
        fiber:       acc.fiber       + (n.fiber       ?? item.fiber       ?? 0),
        sugar:       acc.sugar       + (n.sugar       ?? item.sugar       ?? 0),
        sodium:      acc.sodium      + (n.sodium      ?? item.sodium      ?? 0),
        cholesterol: acc.cholesterol + (n.cholesterol ?? item.cholesterol ?? 0),
      };
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0, cholesterol: 0 },
  );
  return {
    calories:    Math.round(t.calories),
    protein:     Math.round(t.protein * 10) / 10,
    carbs:       Math.round(t.carbs   * 10) / 10,
    fat:         Math.round(t.fat     * 10) / 10,
    fiber:       Math.round(t.fiber   * 10) / 10,
    sugar:       Math.round(t.sugar   * 10) / 10,
    sodium:      Math.round(t.sodium),
    cholesterol: Math.round(t.cholesterol),
    // Available-carb weighted meal GI (never sum/simple-average item GIs)
    glycemic_index: computeMealGlycemicIndex(list),
  };
};
