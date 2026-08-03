/**
 * Shared helpers for manually adding a food item to an existing meal.
 * Used by NutritionCard and NutritionAnalysisPanel (diary food modal).
 */
import { getUserId } from '../../../../shared/services/userIdentity';
import { searchFoods } from '../foodCorrectionService';

const toNumber = (value) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

/** Scale search-result nutrition to a quantity (grams or ml). */
export function calculateNutritionFromSearchResult(foodResult, quantity) {
  const qty = Number.parseFloat(quantity);
  if (!Number.isFinite(qty) || qty <= 0 || !foodResult) return null;

  const scalePer100g = (per100g) => {
    const factor = qty / 100;
    const nutrition = {
      calories: Math.round(toNumber(per100g.calories) * factor),
      protein: Math.round(toNumber(per100g.protein) * factor * 10) / 10,
      carbs: Math.round(toNumber(per100g.carbs) * factor * 10) / 10,
      fat: Math.round(toNumber(per100g.fat) * factor * 10) / 10,
      fiber: Math.round(toNumber(per100g.fiber) * factor * 10) / 10,
    };
    if (per100g.sugar != null) nutrition.sugar = Math.round(toNumber(per100g.sugar) * factor * 10) / 10;
    if (per100g.sodium != null) nutrition.sodium = Math.round(toNumber(per100g.sodium) * factor);
    if (per100g.cholesterol != null) {
      nutrition.cholesterol = Math.round(toNumber(per100g.cholesterol) * factor);
    }
    if (per100g.glycemic_index != null) {
      nutrition.glycemic_index = Math.round(toNumber(per100g.glycemic_index));
    }
    return nutrition;
  };

  if (foodResult.per100g) {
    return scalePer100g(foodResult.per100g);
  }

  if (
    foodResult.defaultServing?.nutrition &&
    Number.isFinite(Number.parseFloat(foodResult.defaultServing?.grams)) &&
    Number.parseFloat(foodResult.defaultServing?.grams) > 0
  ) {
    const servingGrams = Number.parseFloat(foodResult.defaultServing.grams);
    const factor = qty / servingGrams;
    const sn = foodResult.defaultServing.nutrition;
    const nutrition = {
      calories: Math.round(toNumber(sn.calories) * factor),
      protein: Math.round(toNumber(sn.protein) * factor * 10) / 10,
      carbs: Math.round(toNumber(sn.carbs) * factor * 10) / 10,
      fat: Math.round(toNumber(sn.fat) * factor * 10) / 10,
      fiber: Math.round(toNumber(sn.fiber) * factor * 10) / 10,
    };
    if (sn.glycemic_index != null) {
      nutrition.glycemic_index = Math.round(toNumber(sn.glycemic_index));
    }
    return nutrition;
  }

  return null;
}

/** Build an editable food-item object ready to append to a meal. */
export function buildManualFoodItem({
  trimmedName,
  quantity,
  unit,
  portionText,
  selectedFoodResult,
  nutritionValues,
}) {
  const isLiquid = unit === 'ml';
  return {
    name: trimmedName,
    originalAiName: trimmedName,
    wasAutoCorrected: false,
    correctionSource: 'manual_add',
    correctionMetadata: null,
    portionDescription: portionText,
    estimatedWeight: quantity,
    unit,
    isLiquid,
    grams: quantity,
    weight_g: isLiquid ? null : quantity,
    volume_ml: isLiquid ? quantity : null,
    serving: {
      description: portionText,
      grams: quantity,
      unit,
      isLiquid,
    },
    per100g: selectedFoodResult?.per100g || null,
    defaultServing: selectedFoodResult?.defaultServing || null,
    ...nutritionValues,
    nutrition: nutritionValues,
  };
}

/**
 * Resolve a search result for a typed food name (exact match preferred).
 * @returns {Promise<object|null>}
 */
export async function resolveFoodSearchResult(trimmedName, user) {
  const uid = user?.id || (await getUserId(user).catch(() => null));
  const results = await searchFoods(trimmedName, uid);
  if (!results?.length) return null;
  return (
    results.find(
      (r) => (r.name || '').trim().toLowerCase() === trimmedName.toLowerCase(),
    ) || results[0]
  );
}
