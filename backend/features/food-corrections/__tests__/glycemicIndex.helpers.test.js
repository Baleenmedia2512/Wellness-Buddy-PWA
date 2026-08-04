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
  it('reads total.glycemic_index', () => {
    assert.equal(
      extractGlycemicIndexFromAnalysisData({ total: { glycemic_index: 55.4 } }),
      55,
    );
  });

  it('falls back to carb-weighted average of foods', () => {
    assert.equal(
      extractGlycemicIndexFromAnalysisData({
        foods: [
          { nutrition: { carbs: 100, glycemic_index: 50 } },
          { nutrition: { carbs: 100, glycemic_index: 70 } },
        ],
      }),
      60,
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
  it('fills missing total and food GI without overwriting existing item GI', () => {
    const injected = injectGlycemicIndexIntoAnalysisData({
      foods: [
        { name: 'A', nutrition: { carbs: 10 } },
        { name: 'B', nutrition: { carbs: 20, glycemic_index: 40 } },
      ],
      total: { carbs: 30 },
    }, 68);

    assert.equal(injected.total.glycemic_index, 68);
    assert.equal(injected.foods[0].nutrition.glycemic_index, 68);
    assert.equal(injected.foods[1].nutrition.glycemic_index, 40);
  });
});

describe('resolveGlycemicIndexForUpdate', () => {
  it('prefers client value', () => {
    const r = resolveGlycemicIndexForUpdate({
      glycemicIndex: 42,
      analysisData: { total: { glycemic_index: 55 } },
      existingGlycemicIndex: 68,
    });
    assert.deepEqual(r, { resolvedGi: 42, source: 'client' });
  });

  it('uses analysisData when client omits GI', () => {
    const r = resolveGlycemicIndexForUpdate({
      glycemicIndex: null,
      analysisData: { total: { glycemic_index: 55 } },
      existingGlycemicIndex: 68,
    });
    assert.deepEqual(r, { resolvedGi: 55, source: 'analysisData' });
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
