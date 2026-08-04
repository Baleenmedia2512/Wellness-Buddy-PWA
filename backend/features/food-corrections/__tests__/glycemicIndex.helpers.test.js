/**
 * Pure GI preserve helpers for meal edit.
 * Run: node --test backend/features/food-corrections/__tests__/glycemicIndex.helpers.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  extractGlycemicIndexFromAnalysisData,
  injectGlycemicIndexIntoAnalysisData,
  resolveGlycemicIndexForUpdate,
} from '../glycemicIndex.helpers.js';

describe('extractGlycemicIndexFromAnalysisData', () => {
  it('recomputes available-carb weighted GI from foods (ignores legacy summed total)', () => {
    assert.equal(
      extractGlycemicIndexFromAnalysisData({
        foods: [
          { nutrition: { glycemic_index: 73, carbs: 43, fiber: 0 } },
          { nutrition: { glycemic_index: 50, carbs: 24, fiber: 0 } },
          { nutrition: { glycemic_index: 40, carbs: 20, fiber: 0 } },
          { nutrition: { glycemic_index: 64, carbs: 14, fiber: 0 } },
          { nutrition: { glycemic_index: 60, carbs: 6, fiber: 0 } },
        ],
        total: { glycemic_index: 287 },
      }),
      60,
    );
  });

  it('falls back to total when foods lack GI', () => {
    assert.equal(
      extractGlycemicIndexFromAnalysisData({
        foods: [{ nutrition: { carbs: 40 } }],
        total: { glycemic_index: 55.4 },
      }),
      55,
    );
  });

  it('returns null when GI is absent', () => {
    assert.equal(
      extractGlycemicIndexFromAnalysisData({
        foods: [{ nutrition: { carbs: 40 } }],
        total: { carbs: 40 },
      }),
      null,
    );
  });
});

describe('injectGlycemicIndexIntoAnalysisData', () => {
  it('sets total GI without changing per-food GI', () => {
    const injected = injectGlycemicIndexIntoAnalysisData({
      foods: [
        { name: 'A', nutrition: { carbs: 10 } },
        { name: 'B', nutrition: { carbs: 20, glycemic_index: 40 } },
      ],
      total: { carbs: 30 },
    }, 68);

    assert.equal(injected.total.glycemic_index, 68);
    assert.equal(injected.foods[0].nutrition.glycemic_index, undefined);
    assert.equal(injected.foods[1].nutrition.glycemic_index, 40);
  });
});

describe('resolveGlycemicIndexForUpdate', () => {
  it('prefers food-weighted GI over client top-level (legacy sum)', () => {
    const r = resolveGlycemicIndexForUpdate({
      glycemicIndex: 287,
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

  it('uses client when foods cannot produce GI', () => {
    const r = resolveGlycemicIndexForUpdate({
      glycemicIndex: 55,
      analysisData: { foods: [{ nutrition: { carbs: 20 } }], total: {} },
      existingGlycemicIndex: 68,
    });
    assert.deepEqual(r, { resolvedGi: 55, source: 'client' });
  });

  it('preserves existing DB GI when client and AnalysisData omit it', () => {
    const r = resolveGlycemicIndexForUpdate({
      glycemicIndex: null,
      analysisData: {
        foods: [{ nutrition: { calories: 100, carbs: 20 } }],
        total: { calories: 100, carbs: 20 },
      },
      existingGlycemicIndex: 68,
    });
    assert.deepEqual(r, { resolvedGi: 68, source: 'existing' });
  });

  it('returns none when GI is unavailable everywhere', () => {
    const r = resolveGlycemicIndexForUpdate({
      glycemicIndex: null,
      analysisData: { total: {} },
      existingGlycemicIndex: null,
    });
    assert.deepEqual(r, { resolvedGi: null, source: 'none' });
  });
});
