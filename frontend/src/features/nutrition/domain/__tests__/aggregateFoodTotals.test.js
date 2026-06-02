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
