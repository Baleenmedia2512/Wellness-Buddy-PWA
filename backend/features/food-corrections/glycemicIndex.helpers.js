/**
 * Glycemic-index helpers for meal edit persistence.
 * GI is intrinsic to the food — portion edits must never wipe it.
 */

/**
 * Resolve glycemic index from analysisData.total or carb-weighted food items.
 * @param {object} analysisData
 * @returns {number|null}
 */
export function extractGlycemicIndexFromAnalysisData(analysisData) {
  const totalGi = analysisData?.total?.glycemic_index;
  if (totalGi != null && Number.isFinite(Number(totalGi))) {
    return Math.round(Number(totalGi));
  }
  const foods = Array.isArray(analysisData?.foods) ? analysisData.foods : [];
  let product = 0;
  let carbs = 0;
  for (const food of foods) {
    const gi = food?.nutrition?.glycemic_index ?? food?.glycemic_index;
    const c = Number(food?.nutrition?.carbs ?? food?.carbs ?? 0);
    if (gi != null && Number.isFinite(Number(gi)) && c > 0) {
      product += Number(gi) * c;
      carbs += c;
    }
  }
  if (carbs <= 0) return null;
  return Math.round(product / carbs);
}

/**
 * Ensure AnalysisData JSON keeps GI when the DB column still has a value
 * (portion edits must not wipe GI from the persisted payload).
 * @param {object} analysisData
 * @param {number} gi
 * @returns {object}
 */
export function injectGlycemicIndexIntoAnalysisData(analysisData, gi) {
  if (!analysisData || gi == null) return analysisData;
  const next = { ...analysisData };
  if (next.total && typeof next.total === 'object') {
    if (next.total.glycemic_index == null) {
      next.total = { ...next.total, glycemic_index: gi };
    }
  } else {
    next.total = { ...(next.total || {}), glycemic_index: gi };
  }
  if (Array.isArray(next.foods)) {
    next.foods = next.foods.map((food) => {
      if (!food || typeof food !== 'object') return food;
      const nutrition = food.nutrition && typeof food.nutrition === 'object'
        ? food.nutrition
        : {};
      if (nutrition.glycemic_index != null) return food;
      return {
        ...food,
        nutrition: { ...nutrition, glycemic_index: gi },
      };
    });
  }
  return next;
}

/**
 * Resolve GI for an update: client body → AnalysisData → existing DB column.
 * @param {{ glycemicIndex?: number|null, analysisData?: object, existingGlycemicIndex?: number|null }} input
 * @returns {{ resolvedGi: number|null, source: 'client'|'analysisData'|'existing'|'none' }}
 */
export function resolveGlycemicIndexForUpdate({
  glycemicIndex,
  analysisData,
  existingGlycemicIndex,
}) {
  if (glycemicIndex != null && Number.isFinite(Number(glycemicIndex))) {
    return { resolvedGi: Math.round(Number(glycemicIndex)), source: 'client' };
  }
  const fromData = extractGlycemicIndexFromAnalysisData(analysisData);
  if (fromData != null) {
    return { resolvedGi: fromData, source: 'analysisData' };
  }
  if (existingGlycemicIndex != null && Number.isFinite(Number(existingGlycemicIndex))) {
    return {
      resolvedGi: Math.round(Number(existingGlycemicIndex)),
      source: 'existing',
    };
  }
  return { resolvedGi: null, source: 'none' };
}
