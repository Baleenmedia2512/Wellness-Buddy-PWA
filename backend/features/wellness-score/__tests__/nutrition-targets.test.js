/**
 * nutrition-targets.test.js — fat limit uses calorieTarget × fat% / 100 / 9 by gender.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  computeFatLimitGrams,
  computeNutritionTargets,
  resolveFatPercent,
} from '../domain/nutrition-targets.js';

describe('resolveFatPercent', () => {
  it('male → 20%, female → 30%, other → 25%', () => {
    assert.equal(resolveFatPercent('Male'), 20);
    assert.equal(resolveFatPercent('Female'), 30);
    assert.equal(resolveFatPercent('Other'), 25);
    assert.equal(resolveFatPercent(null), 25);
  });
});

describe('computeFatLimitGrams', () => {
  it('male: round(calorieTarget × 20% / 9)', () => {
    assert.equal(computeFatLimitGrams(1800, 'Male'), 40);
  });

  it('female: round(calorieTarget × 30% / 9)', () => {
    assert.equal(computeFatLimitGrams(1800, 'Female'), 60);
  });
});

describe('computeNutritionTargets — gender-based fat', () => {
  it('sets totalFat from calorie target and gender %', () => {
    const male = computeNutritionTargets({ bmr: 1800, weightKg: 70, gender: 'Male' });
    assert.equal(male.totalFat, 40);
    assert.equal(male.totalProtein, 105);

    const female = computeNutritionTargets({ bmr: 1800, weightKg: 70, gender: 'Female' });
    assert.equal(female.totalFat, 60);
  });
});
