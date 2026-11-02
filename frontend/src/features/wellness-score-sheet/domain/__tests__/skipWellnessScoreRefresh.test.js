/**
 * Run: node --test frontend/src/features/wellness-score-sheet/domain/__tests__/skipWellnessScoreRefresh.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { shouldSkipWellnessScoreRefresh } from '../skipWellnessScoreRefresh.js';

describe('shouldSkipWellnessScoreRefresh', () => {
  it('skips the AI-started watermark (food is not saved yet)', () => {
    assert.equal(shouldSkipWellnessScoreRefresh('capture-ai-started'), true);
  });

  it('refreshes after the food row is committed', () => {
    assert.equal(shouldSkipWellnessScoreRefresh('capture-food-saved'), false);
    assert.equal(shouldSkipWellnessScoreRefresh('camera-save'), false);
    assert.equal(shouldSkipWellnessScoreRefresh('capture-weight-saved'), false);
  });
});
