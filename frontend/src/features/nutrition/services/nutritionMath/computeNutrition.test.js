/**
 * computeNutrition must preserve GI across portion edits.
 * Run: node --test frontend/src/features/nutrition/services/nutritionMath/computeNutrition.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { computeNutrition } from './computeNutrition.js';

describe('computeNutrition', () => {
  const per100g = {
    calories: 350,
    protein: 8,
    carbs: 45,
    fat: 15,
    fiber: 2,
    sugar: 1,
    sodium: 400,
    cholesterol: 10,
    glycemic_index: 72,
  };

  it('scales macros with portion size', () => {
    const n = computeNutrition(per100g, 200);
    assert.equal(n.calories, 700);
    assert.equal(n.protein, 16);
    assert.equal(n.carbs, 90);
    assert.equal(n.fat, 30);
    assert.equal(n.fiber, 4);
  });

  it('scales vitamins and minerals with portion size', () => {
    const n = computeNutrition({
      ...per100g,
      phosphorus: 1230,
      calcium: 40,
    }, 50);
    assert.equal(n.phosphorus, 615);
    assert.equal(n.calcium, 20);
    const doubled = computeNutrition({ ...per100g, phosphorus: 1230 }, 40);
    assert.equal(doubled.phosphorus, 492);
  });

  it('preserves glycemic_index without scaling (portion edit)', () => {
    const at100 = computeNutrition(per100g, 100);
    const at600 = computeNutrition(per100g, 600);
    assert.equal(at100.glycemic_index, 72);
    assert.equal(at600.glycemic_index, 72);
  });

  it('returns null glycemic_index when missing from per100g', () => {
    const { glycemic_index: _gi, ...rest } = per100g;
    const n = computeNutrition(rest, 150);
    assert.equal(n.glycemic_index, null);
  });

  it('returns null when inputs are missing', () => {
    assert.equal(computeNutrition(null, 100), null);
    assert.equal(computeNutrition(per100g, 0), null);
  });
});
