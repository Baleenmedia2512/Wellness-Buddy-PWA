/**
 * Pure helpers for meal multi-select totals + plate save payload.
 */
import {
  scaleNutritionFields,
  sumNutrition,
  pickNutrition,
  formatServingPortion,
  referenceWeightG,
} from '../../domain/nutritionFields';

export function normalizeServings(raw) {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

export function computeSelectedKcal(items = []) {
  return items.reduce((sum, item) => {
    const servings = normalizeServings(item.servings);
    return sum + Math.round((item.calories ?? 0) * servings);
  }, 0);
}

export function computeMacroSummary(items = []) {
  return items.reduce(
    (acc, item) => {
      const servings = normalizeServings(item.servings);
      return {
        calories: acc.calories + Math.round((item.calories ?? 0) * servings),
        protein: acc.protein + (Number(item.protein) || 0) * servings,
        carbs: acc.carbs + (Number(item.carbs) || 0) * servings,
        fat: acc.fat + (Number(item.fat) || 0) * servings,
      };
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );
}

/** Scale one selected item the same way SmartFoodSearchModal does. */
export function scaleSelectedItem(item) {
  const servings = normalizeServings(item.servings);
  const nutrition = scaleNutritionFields(item, servings);
  const refW = item.refWeightG ?? referenceWeightG(item);
  return {
    name: item.name,
    weight_g: Math.round(refW * servings),
    portion: formatServingPortion(item, servings),
    nutrition,
    ...nutrition,
  };
}

/**
 * Existing save contract for multi-add / plate meals.
 * { isPlate, items, total, plateName }
 */
export function buildPlateSavePayload(selectedItems = []) {
  const scaled = selectedItems.map(scaleSelectedItem);
  const total = sumNutrition(scaled.map((f) => pickNutrition(f)));
  return {
    items: scaled,
    total,
    isPlate: true,
    plateName: selectedItems.map((f) => f.name).join(', '),
  };
}

export function itemAlreadySelected(selectedItems, name) {
  const key = String(name || '').trim().toLowerCase();
  return selectedItems.some((s) => String(s.name || '').trim().toLowerCase() === key);
}
