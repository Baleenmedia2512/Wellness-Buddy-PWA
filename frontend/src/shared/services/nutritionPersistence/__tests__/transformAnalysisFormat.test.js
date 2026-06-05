/**
 * transformAnalysisFormat.test.js
 *
 * Regression suite for the sugar/sodium/cholesterol data-loss bug.
 *
 * Root cause: macros() and detailedItemToFood() only copied 5 nutrient fields,
 * silently dropping sugar/sodium/cholesterol before the payload reached the
 * backend → values always saved as NULL in food_nutrition_data_table.
 */
import { transformToBackgroundServiceFormat } from '../transformAnalysisFormat';

// ─── shared fixtures ───────────────────────────────────────────────────────

const FULL_NUTRITION = {
  calories: 450,
  protein: 20,
  carbs: 55,
  fat: 15,
  fiber: 8,
  sugar: 12,
  sodium: 680,
  cholesterol: 45,
};

const DETAIL_ITEM = {
  name: 'Grilled Chicken',
  portionDescription: '1 breast',
  estimatedWeight: 150,
  unit: 'g',
  isLiquid: false,
  volume_ml: null,
  weight_g: 150,
  calories: 250,
  protein: 30,
  carbs: 0,
  fat: 5,
  fiber: 0,
  sugar: 2,
  sodium: 320,
  cholesterol: 85,
  originalAiName: 'Grilled Chicken',
  wasAutoCorrected: false,
  correctionSource: null,
  correctionMetadata: null,
};

// ─── macros helper (tested indirectly via total) ───────────────────────────

describe('transformToBackgroundServiceFormat — total field', () => {
  test('preserves sugar from nutrition', () => {
    const result = transformToBackgroundServiceFormat({ nutrition: FULL_NUTRITION, detailedItems: [] });
    expect(result.total.sugar).toBe(12);
  });

  test('preserves sodium from nutrition', () => {
    const result = transformToBackgroundServiceFormat({ nutrition: FULL_NUTRITION, detailedItems: [] });
    expect(result.total.sodium).toBe(680);
  });

  test('preserves cholesterol from nutrition', () => {
    const result = transformToBackgroundServiceFormat({ nutrition: FULL_NUTRITION, detailedItems: [] });
    expect(result.total.cholesterol).toBe(45);
  });

  test('defaults missing sugar/sodium/cholesterol to 0, not undefined', () => {
    const result = transformToBackgroundServiceFormat({
      nutrition: { calories: 100, protein: 5, carbs: 10, fat: 3, fiber: 1 },
      detailedItems: [],
    });
    expect(result.total.sugar).toBe(0);
    expect(result.total.sodium).toBe(0);
    expect(result.total.cholesterol).toBe(0);
  });

  test('still preserves all 5 original macro fields', () => {
    const result = transformToBackgroundServiceFormat({ nutrition: FULL_NUTRITION, detailedItems: [] });
    expect(result.total.calories).toBe(450);
    expect(result.total.protein).toBe(20);
    expect(result.total.carbs).toBe(55);
    expect(result.total.fat).toBe(15);
    expect(result.total.fiber).toBe(8);
  });
});

// ─── detailedItemToFood (tested indirectly via foods array) ────────────────

describe('transformToBackgroundServiceFormat — foods[].nutrition', () => {
  test('preserves sugar on per-food nutrition object', () => {
    const result = transformToBackgroundServiceFormat({
      nutrition: FULL_NUTRITION,
      detailedItems: [DETAIL_ITEM],
    });
    expect(result.foods[0].nutrition.sugar).toBe(2);
  });

  test('preserves sodium on per-food nutrition object', () => {
    const result = transformToBackgroundServiceFormat({
      nutrition: FULL_NUTRITION,
      detailedItems: [DETAIL_ITEM],
    });
    expect(result.foods[0].nutrition.sodium).toBe(320);
  });

  test('preserves cholesterol on per-food nutrition object', () => {
    const result = transformToBackgroundServiceFormat({
      nutrition: FULL_NUTRITION,
      detailedItems: [DETAIL_ITEM],
    });
    expect(result.foods[0].nutrition.cholesterol).toBe(85);
  });

  test('falls back to nutrition.sugar when top-level sugar is absent', () => {
    const itemWithNutritionOnly = {
      name: 'Rice',
      portionDescription: '1 cup',
      estimatedWeight: 200,
      unit: 'g',
      nutrition: { calories: 200, protein: 4, carbs: 45, fat: 0, fiber: 2, sugar: 0, sodium: 5, cholesterol: 0 },
    };
    const result = transformToBackgroundServiceFormat({
      nutrition: FULL_NUTRITION,
      detailedItems: [itemWithNutritionOnly],
    });
    expect(result.foods[0].nutrition.sodium).toBe(5);
  });

  test('defaults per-food sugar/sodium/cholesterol to 0 when absent', () => {
    const bare = { name: 'Apple', portionDescription: '1 medium', estimatedWeight: 180, unit: 'g' };
    const result = transformToBackgroundServiceFormat({
      nutrition: FULL_NUTRITION,
      detailedItems: [bare],
    });
    expect(result.foods[0].nutrition.sugar).toBe(0);
    expect(result.foods[0].nutrition.sodium).toBe(0);
    expect(result.foods[0].nutrition.cholesterol).toBe(0);
  });
});

// ─── pass-through and edge cases ──────────────────────────────────────────

describe('transformToBackgroundServiceFormat — pass-through / edge', () => {
  test('returns already-transformed object unchanged (foods + total present)', () => {
    const already = {
      foods: [{ name: 'Salad', nutrition: { calories: 80, sugar: 3, sodium: 120, cholesterol: 0 } }],
      total: { calories: 80, sugar: 3, sodium: 120, cholesterol: 0 },
      confidence: 'high',
    };
    expect(transformToBackgroundServiceFormat(already)).toBe(already);
  });

  test('returns null/undefined input unchanged', () => {
    expect(transformToBackgroundServiceFormat(null)).toBeNull();
    expect(transformToBackgroundServiceFormat(undefined)).toBeUndefined();
  });

  test('returns unknown-shape input unchanged (no nutrition key)', () => {
    const unknown = { something: 'else' };
    expect(transformToBackgroundServiceFormat(unknown)).toBe(unknown);
  });

  test('uses fallback food when detailedItems is empty — includes sugar/sodium/cholesterol', () => {
    const result = transformToBackgroundServiceFormat({
      nutrition: FULL_NUTRITION,
      detailedItems: [],
      category: { name: 'Pasta Bowl' },
    });
    expect(result.foods).toHaveLength(1);
    expect(result.foods[0].name).toBe('Pasta Bowl');
    expect(result.foods[0].nutrition.sugar).toBe(12);
    expect(result.foods[0].nutrition.sodium).toBe(680);
    expect(result.foods[0].nutrition.cholesterol).toBe(45);
  });
});
