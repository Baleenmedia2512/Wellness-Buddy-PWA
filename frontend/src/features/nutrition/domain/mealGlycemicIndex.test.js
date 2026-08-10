/**
 * Meal GI = Σ(GI × available carbs) / Σ(available carbs).
 * Run: node --test frontend/src/features/nutrition/domain/mealGlycemicIndex.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  availableCarbohydrates,
  computeMealGlycemicIndex,
} from './mealGlycemicIndex.js';

describe('availableCarbohydrates', () => {
  it('subtracts fiber from carbs', () => {
    assert.equal(availableCarbohydrates(43, 2), 41);
  });

  it('never goes below zero', () => {
    assert.equal(availableCarbohydrates(5, 10), 0);
  });

  it('treats missing fiber as 0', () => {
    assert.equal(availableCarbohydrates(24, null), 24);
    assert.equal(availableCarbohydrates(24, undefined), 24);
  });
});

describe('computeMealGlycemicIndex', () => {
  it('returns the single food GI unchanged', () => {
    assert.equal(
      computeMealGlycemicIndex([
        { nutrition: { glycemic_index: 73, carbs: 43, fiber: 0 } },
      ]),
      73,
    );
  });

  it('computes carb-weighted meal GI (user mixed-meal example)', () => {
    // Available carbs = carbs (fiber omitted / 0 in the example)
    const foods = [
      { name: 'Plain White Rice', nutrition: { glycemic_index: 73, carbs: 43, fiber: 0 } },
      { name: 'Sambar with Drumsticks', nutrition: { glycemic_index: 50, carbs: 24, fiber: 0 } },
      { name: 'Cabbage Poriyal with Chana Dal', nutrition: { glycemic_index: 40, carbs: 20, fiber: 0 } },
      { name: 'Beetroot Poriyal', nutrition: { glycemic_index: 64, carbs: 14, fiber: 0 } },
      { name: 'Papad', nutrition: { glycemic_index: 60, carbs: 6, fiber: 0 } },
    ];
    // (73*43 + 50*24 + 40*20 + 64*14 + 60*6) / 107 ≈ 59.77 → 60
    assert.equal(computeMealGlycemicIndex(foods), 60);
  });

  it('never sums GI values', () => {
    const foods = [
      { nutrition: { glycemic_index: 73, carbs: 43 } },
      { nutrition: { glycemic_index: 50, carbs: 24 } },
      { nutrition: { glycemic_index: 40, carbs: 20 } },
      { nutrition: { glycemic_index: 64, carbs: 14 } },
      { nutrition: { glycemic_index: 60, carbs: 6 } },
    ];
    const mealGi = computeMealGlycemicIndex(foods);
    const summed = 73 + 50 + 40 + 64 + 60;
    assert.notEqual(mealGi, summed);
    assert.ok(mealGi < 100);
  });

  it('uses available carbs (carbs − fiber), not total carbs', () => {
    // Without fiber subtract: (70*20 + 50*20) / 40 = 60
    // With fiber: (70*10 + 50*20) / 30 ≈ 56.67 → 57
    assert.equal(
      computeMealGlycemicIndex([
        { nutrition: { glycemic_index: 70, carbs: 20, fiber: 10 } },
        { nutrition: { glycemic_index: 50, carbs: 20, fiber: 0 } },
      ]),
      57,
    );
  });

  it('ignores foods with 0 available carbohydrates', () => {
    assert.equal(
      computeMealGlycemicIndex([
        { nutrition: { glycemic_index: 90, carbs: 0, fiber: 0 } },
        { nutrition: { glycemic_index: 50, carbs: 20, fiber: 0 } },
      ]),
      50,
    );
  });

  it('ignores foods with missing GI', () => {
    assert.equal(
      computeMealGlycemicIndex([
        { nutrition: { carbs: 40, fiber: 0 } },
        { nutrition: { glycemic_index: 55, carbs: 10, fiber: 0 } },
      ]),
      55,
    );
  });

  it('reweights when quantity changes carbs', () => {
    const before = computeMealGlycemicIndex([
      { nutrition: { glycemic_index: 70, carbs: 10, fiber: 0 } },
      { nutrition: { glycemic_index: 40, carbs: 10, fiber: 0 } },
    ]);
    const afterMoreRice = computeMealGlycemicIndex([
      { nutrition: { glycemic_index: 70, carbs: 30, fiber: 0 } },
      { nutrition: { glycemic_index: 40, carbs: 10, fiber: 0 } },
    ]);
    assert.equal(before, 55);
    assert.equal(afterMoreRice, 63);
  });

  it('returns null for empty / unusable input', () => {
    assert.equal(computeMealGlycemicIndex([]), null);
    assert.equal(computeMealGlycemicIndex(null), null);
    assert.equal(
      computeMealGlycemicIndex([
        { nutrition: { glycemic_index: 50, carbs: 0 } },
      ]),
      null,
    );
  });

  it('does not mutate per-item GI', () => {
    const item = { nutrition: { glycemic_index: 73, carbs: 43, fiber: 0 } };
    computeMealGlycemicIndex([item, { nutrition: { glycemic_index: 50, carbs: 24 } }]);
    assert.equal(item.nutrition.glycemic_index, 73);
  });

  it('resolveMealGlycemicIndexFromAnalysis prefers foods over legacy summed total', async () => {
    const { resolveMealGlycemicIndexFromAnalysis } = await import('./mealGlycemicIndex.js');
    assert.equal(
      resolveMealGlycemicIndexFromAnalysis({
        GlycemicIndex: 287,
        AnalysisData: JSON.stringify({
          foods: [
            { nutrition: { glycemic_index: 73, carbs: 43, fiber: 0 } },
            { nutrition: { glycemic_index: 50, carbs: 24, fiber: 0 } },
            { nutrition: { glycemic_index: 40, carbs: 20, fiber: 0 } },
            { nutrition: { glycemic_index: 64, carbs: 14, fiber: 0 } },
            { nutrition: { glycemic_index: 60, carbs: 6, fiber: 0 } },
          ],
          total: { glycemic_index: 287 },
        }),
      }),
      60,
    );
  });
});
