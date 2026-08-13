/**
 * Meal detail cache unit tests.
 * Run: node --test frontend/src/features/nutrition/services/mealDetailCache.test.js
 */
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  mealHasFullAnalysis,
  mergeMealRows,
  seedMealDetail,
  getCachedMealDetail,
  invalidateMealDetail,
  _resetMealDetailCacheForTests,
} from './mealDetailCache.js';

const SAMPLE_ANALYSIS = JSON.stringify({
  foods: [{ name: 'Dosa', nutrition: { calories: 540, protein: 12, carbs: 80, fat: 18, fiber: 3 } }],
  total: { calories: 540, protein: 12, carbs: 80, fat: 18, fiber: 3 },
});

beforeEach(() => {
  _resetMealDetailCacheForTests();
});

describe('mealHasFullAnalysis', () => {
  it('returns true when foods array is populated', () => {
    assert.equal(mealHasFullAnalysis({ AnalysisData: SAMPLE_ANALYSIS }), true);
  });

  it('returns false when AnalysisData is null', () => {
    assert.equal(mealHasFullAnalysis({ AnalysisData: null }), false);
  });
});

describe('seedMealDetail', () => {
  it('stores and retrieves meal by user+id', () => {
    const meal = { ID: 42, AnalysisData: SAMPLE_ANALYSIS };
    seedMealDetail('user1', meal);
    const cached = getCachedMealDetail('user1', 42);
    assert.equal(cached.ID, 42);
    assert.equal(cached.AnalysisData, SAMPLE_ANALYSIS);
  });

  it('invalidate removes cached meal', () => {
    seedMealDetail('user1', { ID: 7, AnalysisData: SAMPLE_ANALYSIS });
    invalidateMealDetail('user1', 7);
    assert.equal(getCachedMealDetail('user1', 7), null);
  });
});

describe('mergeMealRows', () => {
  it('preserves listSummary from diary stub', () => {
    const merged = mergeMealRows(
      { ID: 1, AnalysisData: SAMPLE_ANALYSIS },
      { ID: 1, listSummary: { name: 'Dosa' }, TotalCalories: 540 },
    );
    assert.equal(merged.listSummary.name, 'Dosa');
    assert.ok(mealHasFullAnalysis(merged));
  });
});
