/**
 * Tests for buildCorrectedFood — specifically the name-nullability regression
 * that caused food names (e.g. "Milk tea") to vanish from the NutritionCard
 * header when a correction record had a null/empty user_corrected value.
 */
import { buildCorrectedFood } from '../correctionApplier';

const baseLiquidFood = {
  name: 'Milk tea',
  unit: 'ml',
  isLiquid: true,
  calories: 120,
  nutrition: { calories: 120, protein: 3, carbs: 15, fat: 5, fiber: 0 },
};

const validCorrection = {
  id: 1,
  user_corrected: 'Milk Tea with Sugar',
  correctedUnit: 'ml',
  source: 'global',
  calories: 130,
  protein: 3,
  carbs: 16,
  fat: 5,
  fiber: 0,
};

describe('buildCorrectedFood', () => {
  test('applies a valid correction and updates the name', () => {
    const { food, skipped } = buildCorrectedFood(baseLiquidFood, validCorrection, 'exact', 'Milk tea');
    expect(skipped).toBe(false);
    expect(food.name).toBe('Milk Tea with Sugar');
    expect(food.originalAiName).toBe('Milk tea');
    expect(food.wasAutoCorrected).toBe(true);
  });

  // REGRESSION: null user_corrected must not blank the food name (bug fix)
  test('preserves original name when correction.user_corrected is null', () => {
    const nullNameCorrection = { ...validCorrection, user_corrected: null };
    const { food, skipped } = buildCorrectedFood(baseLiquidFood, nullNameCorrection, 'exact', 'Milk tea');
    expect(skipped).toBe(false);
    expect(food.name).toBe('Milk tea');  // must fall back to original
  });

  // REGRESSION: empty string user_corrected must not blank the food name
  test('preserves original name when correction.user_corrected is empty string', () => {
    const emptyNameCorrection = { ...validCorrection, user_corrected: '' };
    const { food, skipped } = buildCorrectedFood(baseLiquidFood, emptyNameCorrection, 'exact', 'Milk tea');
    expect(skipped).toBe(false);
    expect(food.name).toBe('Milk tea');
  });

  test('skips when solid→liquid type mismatch', () => {
    const solidFood = { ...baseLiquidFood, unit: 'g' };
    const liquidCorrection = { ...validCorrection, correctedUnit: 'ml' };
    const { skipped, skipReason } = buildCorrectedFood(solidFood, liquidCorrection, 'exact', 'Milk tea');
    expect(skipped).toBe(true);
    expect(skipReason).toBe('type-mismatch');
  });
});
