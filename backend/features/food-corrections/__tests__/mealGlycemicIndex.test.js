/**
 * Backend meal GI helpers.
 * Run: node --test backend/features/food-corrections/__tests__/mealGlycemicIndex.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { computeMealGlycemicIndex } from '../mealGlycemicIndex.js';
import {
  extractGlycemicIndexFromAnalysisData,
  resolveGlycemicIndexForUpdate,
} from '../glycemicIndex.helpers.js';

describe('backend computeMealGlycemicIndex', () => {
  it('computes available-carb weighted meal GI', () => {
    const foods = [
      { nutrition: { glycemic_index: 73, carbs: 43, fiber: 0 } },
      { nutrition: { glycemic_index: 50, carbs: 24, fiber: 0 } },
      { nutrition: { glycemic_index: 40, carbs: 20, fiber: 0 } },
      { nutrition: { glycemic_index: 64, carbs: 14, fiber: 0 } },
      { nutrition: { glycemic_index: 60, carbs: 6, fiber: 0 } },
    ];
    assert.equal(computeMealGlycemicIndex(foods), 60);
  });
});

describe('extractGlycemicIndexFromAnalysisData', () => {
  it('recomputes from foods even when total is a legacy sum', () => {
    const gi = extractGlycemicIndexFromAnalysisData({
      foods: [
        { nutrition: { glycemic_index: 73, carbs: 43 } },
        { nutrition: { glycemic_index: 50, carbs: 24 } },
      ],
      // Legacy bug: summed GIs
      total: { glycemic_index: 123, carbs: 67 },
    });
    // (73*43 + 50*24) / 67 ≈ 64.73 → 65
    assert.equal(gi, 65);
  });
});

describe('resolveGlycemicIndexForUpdate', () => {
  it('prefers food-weighted GI over client top-level value', () => {
    const r = resolveGlycemicIndexForUpdate({
      glycemicIndex: 287, // legacy sum
      analysisData: {
        foods: [
          { nutrition: { glycemic_index: 73, carbs: 43 } },
          { nutrition: { glycemic_index: 50, carbs: 24 } },
        ],
        total: { glycemic_index: 287 },
      },
      existingGlycemicIndex: 287,
    });
    assert.equal(r.source, 'analysisData');
    assert.equal(r.resolvedGi, 65);
  });
});
