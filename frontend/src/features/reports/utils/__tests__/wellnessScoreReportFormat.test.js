/**
 * Run: node --test frontend/src/features/reports/utils/__tests__/wellnessScoreReportFormat.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeWeightChange,
  formatWeightKg,
  formatWellnessScore,
} from '../wellnessScoreReportFormat.js';

describe('computeWeightChange', () => {
  it('uses grams below 1 kg with green down direction', () => {
    const r = computeWeightChange(72.4, 72.8);
    assert.equal(r.direction, 'down');
    assert.equal(r.changeLabel, '400 g');
    assert.equal(r.comparisonLabel, '72.80 kg → 72.40 kg');
  });

  it('uses kilograms at 1 kg or more with red up direction', () => {
    const r = computeWeightChange(81.2, 80);
    assert.equal(r.direction, 'up');
    assert.equal(r.changeLabel, '1.20 kg');
  });

  it('shows gray dash when unchanged', () => {
    const r = computeWeightChange(70, 70);
    assert.equal(r.direction, 'same');
    assert.equal(r.changeLabel, '—');
  });
});

describe('format helpers', () => {
  it('formats weight and score', () => {
    assert.equal(formatWeightKg(72.4), '72.40 kg');
    assert.equal(formatWellnessScore(92), '92 / 100');
    assert.equal(formatWellnessScore(null), '—');
  });
});
