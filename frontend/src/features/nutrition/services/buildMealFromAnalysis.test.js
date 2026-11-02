/**
 * buildMealFromAnalysis helpers.
 * Run: node --test frontend/src/features/nutrition/services/buildMealFromAnalysis.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMealRowFromAnalysis,
  extractMealIdFromPromotionResult,
} from './buildMealFromAnalysis.js';

describe('buildMealRowFromAnalysis', () => {
  it('builds a meal row with AnalysisData and totals', () => {
    const analysis = {
      foods: [{ name: 'Dosa', nutrition: { calories: 540, protein: 12, carbs: 80, fat: 18, fiber: 3 } }],
      total: { calories: 540, protein: 12, carbs: 80, fat: 18, fiber: 3 },
    };
    const row = buildMealRowFromAnalysis({
      mealId: 99,
      analysisResult: analysis,
      capturedAt: '2026-06-09T06:11:00.000Z',
    });
    assert.equal(row.ID, 99);
    assert.equal(row.TotalCalories, 540);
    assert.ok(typeof row.AnalysisData === 'string');
    assert.ok(row.AnalysisData.includes('Dosa'));
  });
});

describe('extractMealIdFromPromotionResult', () => {
  it('reads id from save() envelope', () => {
    assert.equal(extractMealIdFromPromotionResult({ id: 55 }), '55');
    assert.equal(extractMealIdFromPromotionResult({ data: { id: 66 } }), '66');
    assert.equal(extractMealIdFromPromotionResult(null), null);
  });
});
