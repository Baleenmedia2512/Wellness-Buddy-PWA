/**
 * Range meal totals must include carb-weighted averageGlycemicIndex
 * (home carousel Last 10 Days / Custom).
 * Run: node --test backend/features/food-corrections/__tests__/meal-totals-gi.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyMealTotalsSeed,
  addMealRowToTotals,
  roundMealTotals,
} from '../domain/meal-totals.js';

describe('meal totals GI aggregation', () => {
  it('computes carb-weighted averageGlycemicIndex across meals', () => {
    let totals = emptyMealTotalsSeed();
    totals = addMealRowToTotals(totals, {
      TotalCalories: 400,
      TotalProtein: 20,
      TotalCarbs: 50,
      TotalFiber: 10,
      TotalFat: 10,
      TotalSugar: 5,
      TotalSodium: 0,
      TotalCholesterol: 0,
      GlycemicIndex: 70,
    });
    totals = addMealRowToTotals(totals, {
      TotalCalories: 300,
      TotalProtein: 15,
      TotalCarbs: 30,
      TotalFiber: 0,
      TotalFat: 8,
      TotalSugar: 4,
      TotalSodium: 0,
      TotalCholesterol: 0,
      GlycemicIndex: 40,
    });

    const rounded = roundMealTotals(totals);
    // available carbs: (50-10)=40 @70, 30 @40 → (2800+1200)/70 = 57.14 → 57
    assert.equal(rounded.averageGlycemicIndex, 57);
    assert.equal(rounded.mealCount, 2);
    assert.equal(rounded.totalSugar, 9);
    assert.equal(rounded._giCarbProduct, undefined);
    assert.equal(rounded._giTotalCarbs, undefined);
  });

  it('returns null GI when meals lack GlycemicIndex', () => {
    let totals = emptyMealTotalsSeed();
    totals = addMealRowToTotals(totals, {
      TotalCalories: 200,
      TotalProtein: 10,
      TotalCarbs: 40,
      TotalFiber: 5,
      TotalFat: 5,
      TotalSugar: 8,
      TotalSodium: 0,
      TotalCholesterol: 0,
      GlycemicIndex: null,
    });
    const rounded = roundMealTotals(totals);
    assert.equal(rounded.averageGlycemicIndex, null);
    assert.equal(rounded.mealCount, 1);
    assert.equal(rounded.totalSugar, 8);
  });

  it('skips zero-available-carb meals for GI weighting', () => {
    let totals = emptyMealTotalsSeed();
    totals = addMealRowToTotals(totals, {
      TotalCalories: 50,
      TotalProtein: 0,
      TotalCarbs: 5,
      TotalFiber: 5,
      TotalFat: 0,
      TotalSugar: 0,
      TotalSodium: 0,
      TotalCholesterol: 0,
      GlycemicIndex: 90,
    });
    totals = addMealRowToTotals(totals, {
      TotalCalories: 200,
      TotalProtein: 10,
      TotalCarbs: 20,
      TotalFiber: 0,
      TotalFat: 5,
      TotalSugar: 2,
      TotalSodium: 0,
      TotalCholesterol: 0,
      GlycemicIndex: 55,
    });
    const rounded = roundMealTotals(totals);
    assert.equal(rounded.averageGlycemicIndex, 55);
  });
});
