/**
 * Meal discipline filters: food + shakes count; Target Nutrition / Afresh / drinks do not.
 * Run: node --test backend/utils/__tests__/foodTypeDetection.mealFilter.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isExemptedBeverageOnly,
  isNonMealNutritionOnly,
  isNonMealSupplement,
  isMealShakeName,
} from '../foodTypeDetection.js';

describe('isMealShakeName', () => {
  it('recognizes Formula 1 / protein shake as meal shakes', () => {
    assert.equal(isMealShakeName('Formula 1 Shake'), true);
    assert.equal(isMealShakeName('Herbalife Formula1'), true);
    assert.equal(isMealShakeName('Protein Shake'), true);
    assert.equal(isMealShakeName('Idli'), false);
  });
});

describe('isNonMealSupplement', () => {
  it('treats Vritilife Triphala as a non-meal supplement', () => {
    assert.equal(isNonMealSupplement('*Vritilife Triphala* (Digestive Health)'), true);
    assert.equal(isNonMealSupplement('Vriti Life Triphala'), true);
  });

  it('does not treat Formula 1 as a supplement', () => {
    assert.equal(isNonMealSupplement('Formula 1 Nutritional Shake Mix'), false);
  });
});

describe('isNonMealNutritionOnly', () => {
  it('skips Target Nutrition Triphala (dry-salad) for breakfast/lunch/dinner', () => {
    assert.equal(isNonMealNutritionOnly({
      mealKind: 'dry-salad',
      foods: [{ name: '*Vritilife Triphala* (Digestive Health)', calories: 5 }],
    }), true);
  });

  it('skips Triphala even without mealKind tag', () => {
    assert.equal(isNonMealNutritionOnly({
      foods: [{ name: '*Vritilife Triphala* (Digestive Health)' }],
    }), true);
  });

  it('skips Afresh / beverage-only', () => {
    assert.equal(isNonMealNutritionOnly({
      foods: [{ name: 'Herbalife Afresh Energy Drink' }],
    }), true);
    assert.equal(isExemptedBeverageOnly({
      foods: [{ name: 'Herbalife Afresh Energy Drink' }],
    }), true);
  });

  it('counts real food as a meal', () => {
    assert.equal(isNonMealNutritionOnly({
      foods: [{ name: 'Idli' }, { name: 'Sambar' }],
    }), false);
  });

  it('counts Formula 1 shake as a meal (including Target Nutrition)', () => {
    assert.equal(isNonMealNutritionOnly({
      mealKind: 'dry-salad',
      foods: [{ name: 'Formula 1 Nutritional Shake Mix' }],
    }), false);
    assert.equal(isNonMealNutritionOnly({
      processedBy: 'shake_calculator',
      foods: [{ name: 'Protein Shake' }],
    }), false);
  });

  it('counts mixed food + drink as a meal', () => {
    assert.equal(isNonMealNutritionOnly({
      foods: [{ name: 'Coffee' }, { name: 'Dosa' }],
    }), false);
  });
});
