/**
 * Pure helpers for promoting an `unknown` capture via Retry / Edit flows.
 * Shared by UnknownEntryFlow (Diary) and App.js (share-link viewer).
 */

function foodItemFromGeminiItem(item) {
  if (!item || typeof item !== 'object') return null;
  const name = item.name || item.originalAiName || 'Food';
  if (item.nutrition && typeof item.nutrition === 'object') {
    return {
      name,
      portion: item.portion || item.portionDescription || undefined,
      weight_g: item.weight_g ?? item.estimatedWeight ?? undefined,
      volume_ml: item.volume_ml ?? undefined,
      unit: item.unit,
      isLiquid: item.isLiquid,
      nutrition: item.nutrition,
    };
  }
  return {
    name,
    portion: item.portion || item.portionDescription || undefined,
    weight_g: item.weight_g ?? item.estimatedWeight ?? undefined,
    volume_ml: item.volume_ml ?? undefined,
    unit: item.unit,
    isLiquid: item.isLiquid,
    nutrition: {
      calories: item.calories ?? 0,
      protein: item.protein ?? 0,
      carbs: item.carbs ?? 0,
      fat: item.fat ?? 0,
      fiber: item.fiber ?? 0,
      sugar: item.sugar ?? 0,
      sodium: item.sodium ?? 0,
      cholesterol: item.cholesterol ?? 0,
      glycemic_index: item.glycemic_index ?? null,
    },
  };
}

/** Sum calories from geminiService `detailedItems` when `nutrition.calories` is missing. */
export function resolveGeminiCalories(analysis) {
  const total = Number(analysis?.nutrition?.calories);
  if (Number.isFinite(total) && total > 0) return total;
  const items = analysis?.detailedItems;
  if (!Array.isArray(items) || items.length === 0) return 0;
  return items.reduce((sum, item) => {
    const fromNested = Number(item?.nutrition?.calories);
    if (Number.isFinite(fromNested) && fromNested > 0) return sum + fromNested;
    const flat = Number(item?.calories);
    return sum + (Number.isFinite(flat) && flat > 0 ? flat : 0);
  }, 0);
}

/** True when the analysis result contains at least one food item with positive calories.
 *  Accepts both the legacy geminiService shape ({ detailedItems, nutrition }) and the
 *  new orchestrator shape ({ foods[], total }) so retry flows work on both paths. */
export function hasRecognizedFood(analysis) {
  // New orchestrator format: foods[] + total
  const newItems = analysis?.foods;
  if (Array.isArray(newItems) && newItems.length > 0) {
    const cal = Number(analysis?.total?.calories) ||
      newItems.reduce((s, f) => s + (Number(f?.nutrition?.calories) || Number(f?.calories) || 0), 0);
    return cal > 0;
  }
  // Legacy geminiService format: detailedItems
  const items = analysis?.detailedItems;
  if (!Array.isArray(items) || items.length === 0) return false;
  return resolveGeminiCalories(analysis) > 0;
}

/** Transform an AI analysis result → backend `analysisResult` shape.
 *  Accepts both the legacy geminiService shape ({ detailedItems, nutrition }) and the
 *  new orchestrator shape ({ foods[], total }) so retry flows work on both paths. */
export function buildAnalysisFromGeminiAnalysis(analysis) {
  // New orchestrator format: foods[] + total
  if (Array.isArray(analysis?.foods) && analysis.foods.length > 0) {
    const foods = analysis.foods.map(foodItemFromGeminiItem).filter(Boolean);
    const total = analysis.total || {};
    return {
      foods,
      total: {
        // Spread all fields from total first (includes micronutrients when present)
        ...total,
        // Then enforce required macros so they are never undefined
        calories: total.calories ?? 0,
        protein: total.protein ?? 0,
        carbs: total.carbs ?? 0,
        fat: total.fat ?? 0,
        fiber: total.fiber ?? 0,
        sugar: total.sugar ?? 0,
        sodium: total.sodium ?? 0,
        cholesterol: total.cholesterol ?? 0,
        glycemic_index: total.glycemic_index ?? null,
      },
      confidence: analysis.confidence || 'medium',
    };
  }
  // Legacy geminiService format: detailedItems + nutrition
  const foods = (analysis?.detailedItems || [])
    .map(foodItemFromGeminiItem)
    .filter(Boolean);
  const total = analysis?.nutrition || {};
  return {
    foods,
    total: {
      ...total,
      calories: total.calories ?? resolveGeminiCalories(analysis),
      protein: total.protein ?? 0,
      carbs: total.carbs ?? 0,
      fat: total.fat ?? 0,
      fiber: total.fiber ?? 0,
      sugar: total.sugar ?? 0,
      sodium: total.sodium ?? 0,
      cholesterol: total.cholesterol ?? 0,
      glycemic_index: total.glycemic_index ?? null,
    },
    confidence: analysis?.confidence || 'medium',
  };
}

/** Accept both `{ ok: true }` (captures routes) and `{ success: true }` (save()). */
export function isCaptureApiSuccess(body) {
  return body?.ok === true || body?.success === true;
}
