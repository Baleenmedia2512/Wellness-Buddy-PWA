/**
 * Mixed-meal Glycemic Index — carbohydrate-weighted average.
 * Keep in sync with frontend/src/features/nutrition/domain/mealGlycemicIndex.js
 *
 * Meal GI = Σ(GIᵢ × AvailableCarbsᵢ) / Σ(AvailableCarbsᵢ)
 * Available carbs = max(0, carbs − fiber). Ignore 0-carb / missing-GI items.
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
 * @param {Array<object>|null|undefined} items
 * @returns {number|null}
 */
export function computeMealGlycemicIndex(items) {
  if (!Array.isArray(items) || items.length === 0) return null;

  let product = 0;
  let availableTotal = 0;

  for (const item of items) {
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
