/**
 * Run: node --test frontend/src/features/reports/utils/__tests__/wellnessScoreReportFormat.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeWeightChange,
  formatWeightKg,
  formatWellnessScore,
  formatReportNameLines,
} from '../wellnessScoreReportFormat.js';

describe('computeWeightChange', () => {
  it('shows before → after plus grams below 1 kg', () => {
    const r = computeWeightChange(72.4, 72.8);
    assert.equal(r.direction, 'down');
    assert.equal(r.changeLabel, '400 g');
    assert.equal(r.comparisonLabel, '72.80 kg → 72.40 kg');
  });

  it('uses API difference when provided', () => {
    const r = computeWeightChange(72.4, 72.8, -0.5);
    assert.equal(r.direction, 'down');
    assert.equal(r.changeLabel, '500 g');
    assert.equal(r.comparisonLabel, '72.80 kg → 72.40 kg');
  });

  it('uses kilograms at 1 kg or more with up direction', () => {
    const r = computeWeightChange(81.2, 80);
    assert.equal(r.direction, 'up');
    assert.equal(r.changeLabel, '1.20 kg');
    assert.equal(r.comparisonLabel, '80.00 kg → 81.20 kg');
  });

  it('shows gray dash when unchanged', () => {
    const r = computeWeightChange(70, 70);
    assert.equal(r.direction, 'same');
    assert.equal(r.changeLabel, '—');
    assert.equal(r.comparisonLabel, '70.00 kg → 70.00 kg');
  });
});

describe('format helpers', () => {
  it('formats weight and total_earned points', () => {
    assert.equal(formatWeightKg(72.4), '72.40 kg');
    assert.equal(formatWellnessScore(660), '660');
    assert.equal(formatWellnessScore(550), '550');
    assert.equal(formatWellnessScore(null), '—');
  });

  it('splits multi-word names onto two lines', () => {
    assert.deepEqual(formatReportNameLines('bharathi pradeepan'), {
      line1: 'bharathi',
      line2: 'pradeepan',
    });
    assert.deepEqual(formatReportNameLines('Sathiya Priya'), {
      line1: 'Sathiya',
      line2: 'Priya',
    });
    assert.deepEqual(formatReportNameLines('Single'), {
      line1: 'Single',
      line2: null,
    });
    assert.deepEqual(formatReportNameLines(''), {
      line1: '—',
      line2: null,
    });
  });
});
