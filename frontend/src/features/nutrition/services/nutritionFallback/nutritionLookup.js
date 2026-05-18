// Look up fallback nutrition for a food: exact match → partial match → category average.
import { INDIAN_FOOD_DATABASE, normalizeFoodName } from './foodDatabase';
import { CATEGORY_AVERAGES, detectFoodCategory } from './categoryAverages';
import { debugLog } from '../../../../shared/utils/logger.js';

const round1 = (n) => Math.round(n * 10) / 10;

const scaleToWeight = (entry, actualWeight) => {
  const factor = actualWeight / entry.servingSize;
  return {
    calories: Math.round(entry.calories * factor),
    protein: round1(entry.protein * factor),
    carbs: round1(entry.carbs * factor),
    fat: round1(entry.fat * factor),
    fiber: round1((entry.fiber || 0) * factor),
  };
};

export function getFallbackNutrition(food) {
  if (!food || !food.name) return null;
  const normalizedName = normalizeFoodName(food.name);
  debugLog(`🔍 [NUTRITION-FALLBACK] Looking up: "${food.name}" (normalized: "${normalizedName}")`);

  // Exact match
  const exact = INDIAN_FOOD_DATABASE[normalizedName];
  if (exact) {
    debugLog(`✅ [NUTRITION-FALLBACK] Found exact match: ${exact.description}`);
    const actualWeight = food.weight_g || food.volume_ml || food.grams || exact.servingSize;
    let nutrition = {
      calories: exact.calories, protein: exact.protein, carbs: exact.carbs,
      fat: exact.fat, fiber: exact.fiber,
    };
    if (actualWeight && actualWeight !== exact.servingSize) {
      nutrition = scaleToWeight(exact, actualWeight);
      debugLog(`   ⚖️ Scaled from ${exact.servingSize}${exact.unit} to ${actualWeight}${food.unit || exact.unit}`);
    }
    return { ...nutrition, source: 'database', matched: normalizedName, servingDescription: exact.description };
  }

  // Partial match (substring either direction)
  for (const [key, value] of Object.entries(INDIAN_FOOD_DATABASE)) {
    if (normalizedName.includes(key) || key.includes(normalizedName)) {
      debugLog(`✅ [NUTRITION-FALLBACK] Found partial match: "${key}"`);
      return {
        calories: value.calories, protein: value.protein, carbs: value.carbs,
        fat: value.fat, fiber: value.fiber,
        source: 'database-partial', matched: key, servingDescription: value.description,
      };
    }
  }

  // Category average
  const category = detectFoodCategory(normalizedName);
  if (category && CATEGORY_AVERAGES[category]) {
    const avg = CATEGORY_AVERAGES[category];
    const weight = food.weight_g || food.volume_ml || food.grams || 100;
    const factor = weight / 100;
    debugLog(`⚠️ [NUTRITION-FALLBACK] Using category average: "${category}" (${weight}g)`);
    return {
      calories: Math.round(avg.calories * factor),
      protein: round1(avg.protein * factor),
      carbs: round1(avg.carbs * factor),
      fat: round1(avg.fat * factor),
      fiber: round1(avg.fiber * factor),
      source: 'category-estimate',
      category,
    };
  }

  debugLog(`❌ [NUTRITION-FALLBACK] No match found for: "${food.name}"`);
  return null;
}
