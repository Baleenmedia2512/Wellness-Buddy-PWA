/**
 * Map AI analysis ({ foods, total }) → NutritionCard `data` shape for Home.
 */
import { transformDbItemToEditable } from '../../features/nutrition/services/nutritionDashboard/foodItemTransform';
import { recalculateTotals } from '../../features/nutrition/services/nutritionDashboard/analysisHelpers';

/**
 * @param {object|null|undefined} analysisResult
 * @returns {object|null}
 */
export function analysisResultToNutritionCardData(analysisResult) {
  if (!analysisResult || typeof analysisResult !== 'object') return null;
  const foods = Array.isArray(analysisResult.foods) ? analysisResult.foods : [];
  if (foods.length === 0) return null;

  const detailedItems = foods.map((f) => transformDbItemToEditable({
    name: f.name,
    nutrition: f.nutrition || {},
    weight_g: f.weight_g,
    volume_ml: f.volume_ml,
    portion: f.portion || f.portionDescription,
    unit: f.unit,
    isLiquid: f.isLiquid,
  }, true));

  const fromTotal = analysisResult.total || {};
  const summed = recalculateTotals(detailedItems) || {};
  const nutrition = {
    calories: fromTotal.calories ?? summed.calories ?? 0,
    protein: fromTotal.protein ?? summed.protein ?? 0,
    carbs: fromTotal.carbs ?? summed.carbs ?? 0,
    fat: fromTotal.fat ?? summed.fat ?? 0,
    fiber: fromTotal.fiber ?? summed.fiber ?? 0,
    sugar: fromTotal.sugar ?? summed.sugar ?? 0,
    sodium: fromTotal.sodium ?? summed.sodium ?? 0,
    glycemic_index: fromTotal.glycemic_index ?? summed.glycemic_index ?? null,
  };

  const names = foods.map((f) => String(f?.name || '').trim()).filter(Boolean);

  return {
    nutrition,
    detailedItems,
    category: { name: names.slice(0, 3).join(', ') || 'Meal' },
    source: 'AI Analysis',
    isRealData: true,
    confidence: analysisResult.confidence || 'medium',
    itemCount: detailedItems.length,
    loggedAt: new Date().toISOString(),
  };
}
