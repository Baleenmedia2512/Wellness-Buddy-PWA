// Public surface of the nutrition-fallback module.
import { getFallbackNutrition } from './nutritionLookup';
import { needsNutritionCorrection, applyFallbackNutrition } from './nutritionApply';

export { getFallbackNutrition } from './nutritionLookup';
export { needsNutritionCorrection, applyFallbackNutrition } from './nutritionApply';

const nutritionFallbackService = {
  getFallbackNutrition,
  needsNutritionCorrection,
  applyFallbackNutrition,
};

export default nutritionFallbackService;
