/**
 * herbalifeShakeProfile.test.js — Active Fibre Complex + combine math
 */
import {
  ACTIVE_FIBRE_COMPLEX,
  combineShakeNutrition,
  powderGramsFromServings,
  scaleActiveFibreNutrition,
  HERBALIFE_SHAKE_STANDARD,
} from './herbalifeShakeProfile';
import { SHAKE_PRODUCTS } from './shakeProductProfiles';

describe('Active Fibre Complex nutrition', () => {
  test('label per scoop matches canister (6.7 g)', () => {
    expect(ACTIVE_FIBRE_COMPLEX.weightPerScoopG).toBe(6.7);
    expect(ACTIVE_FIBRE_COMPLEX.nutritionPerScoop).toEqual({
      calories: 12.8,
      protein: 0,
      carbs: 5.7,
      fat: 0,
      fiber: 5.0,
      sugar: 0.19,
      sodium: 16.45,
      cholesterol: 0,
    });
  });

  test('scales linearly by scoop count', () => {
    expect(scaleActiveFibreNutrition(2)).toEqual({
      calories: 25.6,
      protein: 0,
      carbs: 11.4,
      fat: 0,
      fiber: 10,
      sugar: 0.38,
      sodium: 32.9,
      cholesterol: 0,
    });
  });
});

describe('combineShakeNutrition', () => {
  test('standard recipe unchanged when Active Fibre is 0', () => {
    const item = combineShakeNutrition(58, 0);
    expect(item.weight_g).toBe(58);
    expect(item.nutrition.calories).toBe(223);
    expect(item.nutrition.fiber).toBe(3);
  });

  test('adds Active Fibre macros without scaling base mix by fibre weight', () => {
    const item = combineShakeNutrition(58, 1);
    expect(item.weight_g).toBe(64.7);
    expect(item.nutrition.calories).toBe(235.8); // 223 + 12.8
    expect(item.nutrition.protein).toBe(24.73);
    expect(item.nutrition.carbs).toBe(29.94); // 24.24 + 5.7
    expect(item.nutrition.fiber).toBe(8); // 3 + 5
    expect(item.nutrition.sugar).toBe(11.76); // 11.57 + 0.19
    expect(item.nutrition.sodium).toBe(371.45); // 355 + 16.45
  });

  test('Active Fibre alone is saveable', () => {
    const item = combineShakeNutrition(0, 1);
    expect(item.weight_g).toBe(6.7);
    expect(item.nutrition.calories).toBe(12.8);
    expect(item.nutrition.fiber).toBe(5);
  });
});

describe('powderGramsFromServings additive flag', () => {
  test('excludes Active Fibre from base powder grams', () => {
    const servings = {
      formula1: 3,
      shakemate: 2,
      protein: 1,
      activeFibre: 2,
    };
    expect(powderGramsFromServings(servings, SHAKE_PRODUCTS, { includeAdditive: false }))
      .toBe(HERBALIFE_SHAKE_STANDARD.weight_g);
    expect(powderGramsFromServings(servings, SHAKE_PRODUCTS, { includeAdditive: true }))
      .toBeCloseTo(58 + 13.4, 5);
  });
});
