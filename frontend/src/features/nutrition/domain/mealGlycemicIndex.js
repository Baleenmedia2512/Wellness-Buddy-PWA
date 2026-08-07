/**
 * Mixed-meal Glycemic Index — carbohydrate-weighted average.
 *
 * Scientifically correct formula (FAO/WHO mixed-meal method):
 *   Meal GI = Σ(GIᵢ × AvailableCarbsᵢ) / Σ(AvailableCarbsᵢ)
 *
 * Available carbohydrates = digestible carbs = max(0, total carbs − fiber).
 * Foods with 0 available carbs (or missing GI) are excluded.
 * Individual food GI values are never modified by this helper.
 *
 * @module mealGlycemicIndex
 */

/**
 * Digestible (available) carbohydrates for a food item.
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
 * Read GI / carbs / fiber from nested or flat food shapes.
 * @param {object} item
 * @returns {{ gi: number|null, carbs: number, fiber: number }}
 */
function readItemNutrition(item) {
  const n = item?.nutrition && typeof item.nutrition === 'object'
    ? item.nutrition
    : {};
  const giRaw = n.glycemic_index ?? item?.glycemic_index ?? null;
  const gi = giRaw != null && Number.isFinite(Number(giRaw))
    ? Number(giRaw)
    : null;
  const carbs = Number(n.carbs ?? item?.carbs ?? 0) || 0;
  const fiber = Number(n.fiber ?? item?.fiber ?? 0) || 0;
  return { gi, carbs, fiber };
}

/**
 * Carb-weighted meal Glycemic Index from food items.
 * Never sums or simple-averages item GI values.
 *
 * @param {Array<object>|null|undefined} items
 * @returns {number|null} Whole-number meal GI, or null when not computable
 */
export function computeMealGlycemicIndex(items) {
  if (!Array.isArray(items) || items.length === 0) return null;

  let product = 0;
  let availableTotal = 0;

  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    const { gi, carbs, fiber } = readItemNutrition(item);
    if (gi == null) continue;
    const available = availableCarbohydrates(carbs, fiber);
    if (available <= 0) continue;
    product += gi * available;
    availableTotal += available;
  }

  if (availableTotal <= 0) return null;
  return Math.round(product / availableTotal);
}

/**
 * Prefer recomputing from food items (heals legacy summed totals).
 * Falls back to stored GlycemicIndex / AnalysisData.total when items lack GI.
 *
 * @param {{ GlycemicIndex?: number|null, AnalysisData?: string|object }} analysis
 * @returns {number|null}
 */
export function resolveMealGlycemicIndexFromAnalysis(analysis) {
  if (!analysis) return null;
  try {
    const parsed = typeof analysis.AnalysisData === 'string'
      ? JSON.parse(analysis.AnalysisData)
      : analysis.AnalysisData;
    if (Array.isArray(parsed?.foods) && parsed.foods.length > 0) {
      const fromFoods = computeMealGlycemicIndex(parsed.foods);
      if (fromFoods != null) return fromFoods;
    }
    const totalGi = parsed?.total?.glycemic_index ?? parsed?.nutrition?.glycemic_index;
    if (totalGi != null && Number.isFinite(Number(totalGi))) {
      return Math.round(Number(totalGi));
    }
  } catch {
    /* ignore parse errors */
  }
  if (analysis.GlycemicIndex != null && Number.isFinite(Number(analysis.GlycemicIndex))) {
    return Math.round(Number(analysis.GlycemicIndex));
  }
  return null;
}
