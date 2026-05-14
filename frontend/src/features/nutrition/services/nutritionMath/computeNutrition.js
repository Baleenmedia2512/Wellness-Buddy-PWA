/**
 * Pure scaler: derives a nutrition object for `grams` from per-100g values.
 *
 * Returns null if either input is missing/falsy. Calorie value is rounded;
 * macros are rounded UP (Math.ceil) — preserved exactly from the legacy
 * inline implementation.
 *
 * @param {{calories:number, protein:number, carbs:number, fat:number, fiber?:number}|null|undefined} per100g
 * @param {number|string|null|undefined} grams
 * @returns {{calories:number, protein:number, carbs:number, fat:number, fiber:number}|null}
 */
export function computeNutrition(per100g, grams) {
  if (!per100g || !grams) return null;

  const multiplier = parseFloat(grams) / 100;

  return {
    calories: Math.round(per100g.calories * multiplier),
    protein: Math.ceil(per100g.protein * multiplier),
    carbs: Math.ceil(per100g.carbs * multiplier),
    fat: Math.ceil(per100g.fat * multiplier),
    fiber: Math.ceil((per100g.fiber || 0) * multiplier),
  };
}
