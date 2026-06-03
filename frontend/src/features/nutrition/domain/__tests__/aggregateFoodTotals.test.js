/**
 * Regression suite for the sugar/sodium/cholesterol data-loss bug in the
 * food image-upload pipeline.
 *
 * Before this fix App.js summed only 5 macros from the AI's per-food
 * `nutrition` blocks, silently dropping sugar/sodium/cholesterol before
 * the payload reached `transformToBackgroundServiceFormat`. The transform
 * then defaulted them to 0 and the backend persisted them as NULL.
 */
import {
  aggregateFoodTotals,
  FOOD_TOTAL_FIELDS,
} from '../aggregateFoodTotals';

describe('aggregateFoodTotals', () => {
  test('exports all 8 canonical fields including sugar/sodium/cholesterol', () => {
    expect(FOOD_TOTAL_FIELDS).toEqual([
      'calories', 'protein', 'carbs', 'fat', 'fiber',
      'sugar', 'sodium', 'cholesterol',
    ]);
  });

  test('sums sugar/sodium/cholesterol from nested AI nutrition blocks (bug repro)', () => {
    const foods = [
      { name: 'Idli', nutrition: { calories: 80, protein: 2, carbs: 16, fat: 0.5, fiber: 1, sugar: 0.5, sodium: 180, cholesterol: 0 } },
      { name: 'Coconut chutney', nutrition: { calories: 120, protein: 1, carbs: 4, fat: 11, fiber: 2, sugar: 1.5, sodium: 300, cholesterol: 0 } },
    ];
    const total = aggregateFoodTotals(foods);
    expect(total.sugar).toBeCloseTo(2);
    expect(total.sodium).toBe(480);
    expect(total.cholesterol).toBe(0);
  });

  test('preserves the 5 legacy macros (backward compat)', () => {
    const foods = [
      { nutrition: { calories: 100, protein: 5, carbs: 10, fat: 3, fiber: 1 } },
      { nutrition: { calories: 200, protein: 8, carbs: 20, fat: 5, fiber: 2 } },
    ];
    const total = aggregateFoodTotals(foods);
    expect(total.calories).toBe(300);
    expect(total.protein).toBe(13);
    expect(total.carbs).toBe(30);
    expect(total.fat).toBe(8);
    expect(total.fiber).toBe(3);
  });

  test('falls back to flat fields when nested nutrition is absent', () => {
    const foods = [{ calories: 250, protein: 30, carbs: 0, fat: 5, fiber: 0, sugar: 0, sodium: 320, cholesterol: 85 }];
    const total = aggregateFoodTotals(foods);
    expect(total.sodium).toBe(320);
    expect(total.cholesterol).toBe(85);
  });

  test('nested nutrition takes precedence over flat fields when both present', () => {
    const foods = [{
      sodium: 999,
      nutrition: { calories: 100, protein: 5, carbs: 10, fat: 3, fiber: 1, sugar: 2, sodium: 150, cholesterol: 10 },
    }];
    expect(aggregateFoodTotals(foods).sodium).toBe(150);
  });

  test('treats missing fields as 0, not NaN', () => {
    const foods = [{ name: 'Unknown', nutrition: { calories: 50 } }];
    const total = aggregateFoodTotals(foods);
    expect(total.sugar).toBe(0);
    expect(total.sodium).toBe(0);
    expect(total.cholesterol).toBe(0);
    expect(Number.isNaN(total.sugar)).toBe(false);
  });

  test('returns a zeroed total for empty / non-array input', () => {
    expect(aggregateFoodTotals([]).sodium).toBe(0);
    expect(aggregateFoodTotals(null).sodium).toBe(0);
    expect(aggregateFoodTotals(undefined).sodium).toBe(0);
  });
});

describe('aggregateFoodTotals — glycemicIndex (carb-weighted average)', () => {
  test('computes carb-weighted GI across multiple foods', () => {
    const foods = [
      { name: 'White rice', nutrition: { calories: 200, protein: 4, carbs: 44, fat: 0.5, fiber: 0, sugar: 0, sodium: 5, cholesterol: 0, glycemic_index: 72 } },
      { name: 'Apple',      nutrition: { calories: 52,  protein: 0, carbs: 14, fat: 0.2, fiber: 2, sugar: 10, sodium: 1, cholesterol: 0, glycemic_index: 38 } },
    ];
    const total = aggregateFoodTotals(foods);
    // Expected: (72*44 + 38*14) / (44+14) = (3168+532)/58 ≈ 63.8 → rounds to 64
    expect(total.glycemicIndex).toBe(Math.round((72 * 44 + 38 * 14) / (44 + 14)));
  });

  test('returns null when all foods have null GI', () => {
    const foods = [
      { name: 'Manual entry', nutrition: { calories: 100, protein: 5, carbs: 10, fat: 3, fiber: 1, sugar: 0, sodium: 0, cholesterol: 0 } },
    ];
    expect(aggregateFoodTotals(foods).glycemicIndex).toBeNull();
  });

  test('returns null for pure protein/fat meal (zero carbs)', () => {
    const foods = [
      { name: 'Egg whites', nutrition: { calories: 50, protein: 11, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 160, cholesterol: 0, glycemic_index: 0 } },
    ];
    expect(aggregateFoodTotals(foods).glycemicIndex).toBeNull();
  });

  test('excludes foods with null GI from weighted average', () => {
    const foods = [
      { name: 'White bread', nutrition: { calories: 80, protein: 3, carbs: 15, fat: 1, fiber: 1, sugar: 1, sodium: 150, cholesterol: 0, glycemic_index: 75 } },
      { name: 'Mystery food', nutrition: { calories: 100, protein: 5, carbs: 20, fat: 2, fiber: 0, sugar: 2, sodium: 50, cholesterol: 0 } },
    ];
    const total = aggregateFoodTotals(foods);
    // Only white bread has GI → weighted avg uses only that food
    expect(total.glycemicIndex).toBe(75);
  });

  test('returns null for empty array', () => {
    expect(aggregateFoodTotals([]).glycemicIndex).toBeNull();
  });

  test('returns null for null/undefined input', () => {
    expect(aggregateFoodTotals(null).glycemicIndex).toBeNull();
    expect(aggregateFoodTotals(undefined).glycemicIndex).toBeNull();
  });

  test('picks glycemic_index from flat fields when nutrition block is absent', () => {
    const foods = [
      { calories: 120, protein: 2, carbs: 25, fat: 0.5, fiber: 1, sugar: 5, sodium: 10, cholesterol: 0, glycemic_index: 60 },
    ];
    expect(aggregateFoodTotals(foods).glycemicIndex).toBe(60);
  });

  test('nested glycemic_index takes precedence over flat field', () => {
    const foods = [
      { glycemic_index: 99, nutrition: { calories: 100, protein: 5, carbs: 20, fat: 1, fiber: 0, sugar: 1, sodium: 5, cholesterol: 0, glycemic_index: 45 } },
    ];
    expect(aggregateFoodTotals(foods).glycemicIndex).toBe(45);
  });
});
