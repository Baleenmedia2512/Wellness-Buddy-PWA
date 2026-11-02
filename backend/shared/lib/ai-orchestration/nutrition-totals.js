/**
 * Additive meal totals. Glycemic index is never summed.
 * Keep GI formula in sync with backend/features/food-corrections/mealGlycemicIndex.js
 */

/**
 * @param {number|null|undefined} carbs
 * @param {number|null|undefined} fiber
 * @returns {number}
 */
export function availableCarbohydrates(carbs, fiber) {
  const c = Number(carbs);
  const f = Number(fiber);
  const totalCarbs = Number.isFinite(c) ? c : 0;
  const totalFiber = Number.isFinite(f) ? f : 0;
  return Math.max(0, totalCarbs - totalFiber);
}

/**
 * Carb-weighted meal GI (FAO/WHO). Never sums item GI values.
 * Meal GI = Σ(GIᵢ × AvailableCarbsᵢ) / Σ(AvailableCarbsᵢ).
 * @param {Array<object>|null|undefined} foods
 * @returns {number|null}
 */
export function computeMealGlycemicIndexFromFoods(foods) {
  if (!Array.isArray(foods) || foods.length === 0) return null;

  let product = 0;
  let availableTotal = 0;

  for (const item of foods) {
    if (!item || typeof item !== 'object') continue;
    const n = item.nutrition && typeof item.nutrition === 'object' ? item.nutrition : {};
    const giRaw = n.glycemic_index ?? item.glycemic_index ?? null;
    if (giRaw == null || !Number.isFinite(Number(giRaw))) continue;
    const gi = Number(giRaw);
    const carbs = Number(n.carbs ?? item.carbs ?? 0) || 0;
    const fiber = Number(n.fiber ?? item.fiber ?? 0) || 0;
    const available = availableCarbohydrates(carbs, fiber);
    if (available <= 0) continue;
    product += gi * available;
    availableTotal += available;
  }

  if (availableTotal <= 0) return null;
  return Math.round(product / availableTotal);
}

/**
 * @param {Array<object>} foods
 * @param {{
 *   isShakeName: (name: string) => boolean,
 *   cloneShakeNutrition: () => Record<string, number>,
 *   allKeys: readonly string[],
 * }} deps
 * @returns {Record<string, number>}
 */
export function sumNutritionFields(foods, { isShakeName, cloneShakeNutrition, allKeys }) {
  const shakeFoods = foods.filter((food) => isShakeName(food?.name));
  const otherFoods = foods.filter((food) => !isShakeName(food?.name));

  if (shakeFoods.length > 0 && otherFoods.length === 0) {
    return cloneShakeNutrition();
  }

  let total = shakeFoods.length > 0
    ? cloneShakeNutrition()
    : Object.fromEntries(allKeys.map((key) => [key, 0]));

  for (const food of otherFoods) {
    const nutrition = food?.nutrition ?? {};
    for (const key of allKeys) {
      if (key === 'glycemic_index') continue;
      const val = nutrition[key];
      if (val != null && val !== '') total[key] += +val;
    }
  }

  const foodsForGi = foods.map((food) => {
    if (!isShakeName(food?.name)) return food;
    return { ...food, nutrition: cloneShakeNutrition() };
  });
  const mealGi = computeMealGlycemicIndexFromFoods(foodsForGi);
  if (mealGi != null) {
    total.glycemic_index = mealGi;
  }

  return total;
}

/**
 * Sum enrichment micros. Skips glycemic_index so meal GI is not overwritten with a sum.
 * @param {object} left
 * @param {object} right
 * @param {string[]} keys
 * @returns {object}
 */
export function sumEnrichmentFields(left, right, keys) {
  const result = {};
  for (const key of keys) {
    if (key === 'glycemic_index') continue;
    result[key] = (left?.[key] ?? 0) + (right?.[key] ?? 0);
  }
  return result;
}
