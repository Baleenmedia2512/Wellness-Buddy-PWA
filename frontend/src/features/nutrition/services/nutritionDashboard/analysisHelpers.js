// Pure helpers used across the nutrition dashboard.
// These do NOT touch the network — see *Api.js modules for fetches.
import { computeMealGlycemicIndex } from '../../domain/mealGlycemicIndex';
import { parseUtcTimestamp } from '../../../../shared/utils/datetimeUtils';
import { FOOD_MICRO_FIELDS, aggregateFoodTotals } from '../../domain/aggregateFoodTotals';

/**
 * Multi-food title: every item name, comma-separated.
 * e.g. "Dosa, Idli with Sambar, Idiyappam" — not "Dosa+3more".
 */
export const formatFoodsTitle = (foods) => {
  const items = Array.isArray(foods) ? foods.filter(Boolean) : [];
  const seen = new Set();
  const names = [];
  for (const item of items) {
    const name = String(item?.name || item?.foodName || '').trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(name);
  }
  if (names.length === 0) return 'Unknown Food';
  return names.join(', ');
};

/**
 * Parse meal CreatedAt. Timezone-less API/DB values are IST wall-clock
 * (same contract as parseUtcTimestamp / backend legacy storage).
 */
export const parseMealTimestamp = (value) => parseUtcTimestamp(value);

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
      // Always recompute meal GI from foods (heals legacy summed totals like 287)
      const mealGi = computeMealGlycemicIndex(parsed.foods)
        ?? (parsed.total.glycemic_index != null ? Math.round(Number(parsed.total.glycemic_index)) : null);
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
          glycemic_index: mealGi,
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
      const nutrition = { ...(parsed.nutrition || {}) };
      const mealGi = computeMealGlycemicIndex(items);
      if (mealGi != null) nutrition.glycemic_index = mealGi;
      return {
        name: items.length > 1 ? formatFoodsTitle(items) : parsed.category.name,
        nutrition,
        detailedItems: items,
      };
    }
    if (parsed?.foods?.length > 0) {
      const firstFood = parsed.foods[0] || {};
      const mealGi = computeMealGlycemicIndex(parsed.foods);
      const nutrition = { ...(firstFood.nutrition || {}) };
      if (mealGi != null) nutrition.glycemic_index = mealGi;
      return { name: formatFoodsTitle(parsed.foods), nutrition, detailedItems: parsed.foods || [] };
    }
    return { name: 'Unknown Food', nutrition: {}, detailedItems: [] };
  } catch {
    return { name: 'Error parsing data', nutrition: {}, detailedItems: [] };
  }
};

/** Sum & round per-item nutrition into day/meal totals. */
export const recalculateTotals = (items) => {
  const list = Array.isArray(items) ? items : [];
  const t = aggregateFoodTotals(list);
  const micros = {};
  for (const key of FOOD_MICRO_FIELDS) {
    micros[key] = t[key] || 0;
  }
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
    glycemic_index: t.glycemicIndex ?? computeMealGlycemicIndex(list),
    ...micros,
  };
};
