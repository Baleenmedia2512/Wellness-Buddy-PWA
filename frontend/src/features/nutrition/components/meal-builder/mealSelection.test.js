/**
 * mealSelection.test.js — totals + plate save payload shape.
 *
 * Run: npx react-scripts test --watchAll=false --testPathPattern=mealSelection
 */
import {
  buildPlateSavePayload,
  computeMacroSummary,
  computeSelectedKcal,
  itemAlreadySelected,
  normalizeServings,
  scaleSelectedItem,
} from './mealSelection';
import { saveMealLabel } from './FloatingMealTray';

describe('meal selection helpers', () => {
  const rice = {
    name: 'Rice',
    calories: 130,
    protein: 2.5,
    carbs: 28,
    fat: 0.3,
    servings: 2,
    quantity_g: 100,
  };
  const egg = {
    name: 'Egg',
    calories: 70,
    protein: 6,
    carbs: 0.5,
    fat: 5,
    servings: 1,
    quantity_g: 50,
  };

  test('normalizeServings falls back to 1', () => {
    expect(normalizeServings(2)).toBe(2);
    expect(normalizeServings(0)).toBe(1);
    expect(normalizeServings('x')).toBe(1);
  });

  test('computeSelectedKcal scales by servings', () => {
    expect(computeSelectedKcal([rice, egg])).toBe(130 * 2 + 70);
  });

  test('computeMacroSummary aggregates macros', () => {
    const m = computeMacroSummary([rice, egg]);
    expect(m.calories).toBe(330);
    expect(m.protein).toBeCloseTo(2.5 * 2 + 6);
    expect(m.carbs).toBeCloseTo(28 * 2 + 0.5);
    expect(m.fat).toBeCloseTo(0.3 * 2 + 5);
  });

  test('itemAlreadySelected is case-insensitive', () => {
    expect(itemAlreadySelected([rice], 'rice')).toBe(true);
    expect(itemAlreadySelected([rice], 'Egg')).toBe(false);
  });

  test('scaleSelectedItem multiplies nutrition by servings', () => {
    const scaled = scaleSelectedItem(rice);
    expect(scaled.name).toBe('Rice');
    expect(scaled.calories).toBe(260);
  });

  test('buildPlateSavePayload keeps isPlate contract', () => {
    const payload = buildPlateSavePayload([rice, egg]);
    expect(payload.isPlate).toBe(true);
    expect(payload.plateName).toBe('Rice, Egg');
    expect(payload.items).toHaveLength(2);
    expect(payload.items[0].name).toBe('Rice');
    expect(payload.total).toBeTruthy();
    expect(payload.total.calories).toBe(330);
  });

  test('saveMealLabel copy', () => {
    expect(saveMealLabel(1)).toBe('Save Meal');
    expect(saveMealLabel(3)).toBe('Save 3 Items');
  });
});
