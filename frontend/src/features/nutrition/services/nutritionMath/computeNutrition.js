/**
 * Pure scaler: derives a nutrition object for `grams` from per-100g values.
 *
 * Returns null if either input is missing/falsy. Calorie value is rounded;
 * macros are rounded UP (Math.ceil) — preserved exactly from the legacy
 * inline implementation.
 *
 * @param {{calories:number, protein:number, carbs:number, fat:number, fiber?:number, sugar?:number|null, sodium?:number|null, cholesterol?:number|null}|null|undefined} per100g
 * @param {number|string|null|undefined} grams
 * @returns {{calories:number, protein:number, carbs:number, fat:number, fiber:number, sugar:number|null, sodium:number|null, cholesterol:number|null}|null}
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
    sugar: per100g.sugar != null ? Math.ceil(per100g.sugar * multiplier) : null,
    sodium: per100g.sodium != null ? Math.ceil(per100g.sodium * multiplier) : null,
    cholesterol: per100g.cholesterol != null ? Math.ceil(per100g.cholesterol * multiplier) : null,
  };
}
