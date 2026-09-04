const MICRO_FIELDS = Object.freeze([
  'vitamin_a', 'vitamin_c', 'vitamin_d', 'vitamin_e', 'vitamin_k',
  'vitamin_b1', 'vitamin_b2', 'vitamin_b3', 'vitamin_b6', 'vitamin_b9', 'vitamin_b12',
  'calcium', 'iron', 'magnesium', 'potassium', 'zinc', 'phosphorus',
]);

/**
 * Pure scaler: derives a nutrition object for `grams` from per-100g values.
 *
 * Returns null if either input is missing/falsy. Calorie value is rounded;
 * macros are rounded UP (Math.ceil) — preserved exactly from the legacy
 * inline implementation.
 *
 * Vitamins/minerals scale with portion (2 decimal places). Glycemic index is
 * intrinsic to the food and is copied as-is — never scaled with grams.
 *
 * @param {object|null|undefined} per100g
 * @param {number|string|null|undefined} grams
 */
export function computeNutrition(per100g, grams) {
  if (!per100g || !grams) return null;

  const multiplier = parseFloat(grams) / 100;
  const gi = per100g.glycemic_index;
  const scaleMicro = (v) => {
    if (v == null || v === '') return null;
    const n = Number(v);
    if (!Number.isFinite(n)) return null;
    return Math.round(n * multiplier * 100) / 100;
  };

  const nutrition = {
    calories: Math.round((per100g.calories || 0) * multiplier),
    protein: Math.ceil((per100g.protein || 0) * multiplier),
    carbs: Math.ceil((per100g.carbs || 0) * multiplier),
    fat: Math.ceil((per100g.fat || 0) * multiplier),
    fiber: Math.ceil((per100g.fiber || 0) * multiplier),
    sugar: per100g.sugar != null ? Math.ceil(per100g.sugar * multiplier) : null,
    sodium: per100g.sodium != null ? Math.ceil(per100g.sodium * multiplier) : null,
    cholesterol: per100g.cholesterol != null ? Math.ceil(per100g.cholesterol * multiplier) : null,
    // GI is a food property — preserve, do not scale with portion size
    glycemic_index: gi != null && Number.isFinite(Number(gi)) ? Math.round(Number(gi)) : null,
  };

  for (const key of MICRO_FIELDS) {
    nutrition[key] = scaleMicro(per100g[key]);
  }

  return nutrition;
}

/**
 * Per-100g profile for portion edits. Merges stored per100g with values
 * derived from the current portion so vitamins/minerals are not dropped
 * when the stored per100g only had macros.
 */
export function derivePer100g(foodItem) {
  const nutritionData = foodItem?.nutrition || foodItem || {};
  const currentGrams = parseFloat(
    foodItem?.serving?.grams || foodItem?.grams || foodItem?.estimatedWeight,
  ) || 100;
  const existingGi = nutritionData.glycemic_index ?? foodItem?.glycemic_index ?? null;
  const gi = existingGi != null && Number.isFinite(Number(existingGi))
    ? Math.round(Number(existingGi))
    : null;

  const derived = {};
  const ratio = 100 / currentGrams;
  const scaleIfPresent = (v) => {
    if (v == null || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n * ratio : null;
  };

  derived.calories = (nutritionData.calories || 0) * ratio;
  derived.protein = (nutritionData.protein || 0) * ratio;
  derived.carbs = (nutritionData.carbs || 0) * ratio;
  derived.fat = (nutritionData.fat || 0) * ratio;
  derived.fiber = (nutritionData.fiber || 0) * ratio;
  derived.sugar = scaleIfPresent(nutritionData.sugar);
  derived.sodium = scaleIfPresent(nutritionData.sodium);
  derived.cholesterol = scaleIfPresent(nutritionData.cholesterol);
  derived.glycemic_index = gi;
  for (const key of MICRO_FIELDS) {
    derived[key] = scaleIfPresent(nutritionData[key]);
  }

  if (!foodItem?.per100g) return derived;

  const merged = { ...derived, ...foodItem.per100g };
  for (const key of [...MICRO_FIELDS, 'sugar', 'sodium', 'cholesterol', 'glycemic_index']) {
    if (merged[key] == null && derived[key] != null) merged[key] = derived[key];
  }
  if (merged.glycemic_index == null) merged.glycemic_index = gi;
  return merged;
}
