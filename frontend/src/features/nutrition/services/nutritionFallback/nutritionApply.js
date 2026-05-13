// Detect missing/zero nutrition values and apply fallback estimates.
import { normalizeFoodName, ZERO_CALORIE_FOODS } from './foodDatabase';
import { getFallbackNutrition } from './nutritionLookup';

export function needsNutritionCorrection(food) {
  if (!food || !food.nutrition) return true;
  const { calories, protein, carbs, fat } = food.nutrition;

  // Don't "correct" foods that are legitimately 0-calorie.
  const normalizedName = normalizeFoodName(food.name);
  if (ZERO_CALORIE_FOODS.includes(normalizedName)) return false;

  if (calories === 0 || (calories === undefined && carbs === 0 && protein === 0 && fat === 0)) {
    console.log(`⚠️ [NUTRITION-CHECK] "${food.name}" has suspicious 0 values`);
    return true;
  }
  return false;
}

export function applyFallbackNutrition(foods) {
  if (!foods || !Array.isArray(foods)) return foods;
  console.log(`🔧 [NUTRITION-FALLBACK] Checking ${foods.length} foods for missing nutrition...`);

  return foods.map((food) => {
    if (!needsNutritionCorrection(food)) return food;
    console.log(`⚠️ [NUTRITION-FALLBACK] "${food.name}" needs correction`);
    const fallback = getFallbackNutrition(food);
    if (!fallback) {
      console.warn(`❌ [NUTRITION-FALLBACK] No fallback found for: "${food.name}"`);
      return food;
    }
    console.log(`✅ [NUTRITION-FALLBACK] Applied fallback nutrition:`, fallback);
    const { calories, protein, carbs, fat, fiber } = fallback;
    return {
      ...food,
      nutrition: { calories, protein, carbs, fat, fiber },
      calories, protein, carbs, fat, fiber,
      nutritionSource: fallback.source,
      fallbackApplied: true,
    };
  });
}
