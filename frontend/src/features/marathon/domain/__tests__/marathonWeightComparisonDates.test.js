/**
 * Run: node --test frontend/src/features/marathon/domain/__tests__/marathonWeightComparisonDates.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getMarathonWeightComparisonDates } from '../marathonCalendar.js';
import {
  buildMarathonWeightComparison,
  formatMarathonWeightChangeLabel,
} from '../marathonWeightComparison.js';

describe('getMarathonWeightComparisonDates', () => {
  it('returns null outside Marathon Day 0', () => {
    assert.equal(getMarathonWeightComparisonDates('2026-08-02'), null);
    assert.equal(getMarathonWeightComparisonDates('2026-08-11'), null);
    assert.equal(getMarathonWeightComparisonDates('2026-08-14'), null);
    assert.equal(getMarathonWeightComparisonDates('2026-08-31'), null);
  });

  it('maps Marathon 1 Day 0 to previous month Day 10', () => {
    assert.deepEqual(getMarathonWeightComparisonDates('2026-08-01'), {
      currentDay0Ymd: '2026-08-01',
      previousDay10Ymd: '2026-07-25',
      marathonNumber: 1,
    });
    assert.deepEqual(getMarathonWeightComparisonDates('2026-09-01'), {
      currentDay0Ymd: '2026-09-01',
      previousDay10Ymd: '2026-08-25',
      marathonNumber: 1,
    });
    assert.deepEqual(getMarathonWeightComparisonDates('2026-03-01'), {
      currentDay0Ymd: '2026-03-01',
      previousDay10Ymd: '2026-02-25',
      marathonNumber: 1,
    });
    assert.deepEqual(getMarathonWeightComparisonDates('2026-01-01'), {
      currentDay0Ymd: '2026-01-01',
      previousDay10Ymd: '2025-12-25',
      marathonNumber: 1,
    });
  });

  it('maps Marathon 2 Day 0 to Day 10 of the same month', () => {
    assert.deepEqual(getMarathonWeightComparisonDates('2026-08-15'), {
      currentDay0Ymd: '2026-08-15',
      previousDay10Ymd: '2026-08-11',
      marathonNumber: 2,
    });
    assert.deepEqual(getMarathonWeightComparisonDates('2026-02-15'), {
      currentDay0Ymd: '2026-02-15',
      previousDay10Ymd: '2026-02-11',
      marathonNumber: 2,
    });
  });
});

describe('buildMarathonWeightComparison', () => {
  it('formats increase, decrease, and unchanged deltas', () => {
    const increase = buildMarathonWeightComparison({
      previousMarathonEndWeight: 70,
      currentMarathonDay0Weight: 72,
    });
    assert.equal(increase.weightDifference, 2);
    assert.equal(increase.direction, 'increase');
    assert.equal(increase.changeLabel, '+2.0 kg ↑ Increase');

    const decrease = buildMarathonWeightComparison({
      previousMarathonEndWeight: 75,
      currentMarathonDay0Weight: 73,
    });
    assert.equal(decrease.weightDifference, -2);
    assert.equal(decrease.direction, 'decrease');
    assert.equal(decrease.changeLabel, '−2.0 kg ↓ Decrease');

    const unchanged = buildMarathonWeightComparison({
      previousMarathonEndWeight: 70,
      currentMarathonDay0Weight: 70,
    });
    assert.equal(unchanged.weightDifference, 0);
    assert.equal(unchanged.direction, 'unchanged');
    assert.equal(unchanged.changeLabel, '0 kg — No Change');
  });

  it('supports decimal weights without float noise', () => {
    const result = buildMarathonWeightComparison({
      previousMarathonEndWeight: 70.5,
      currentMarathonDay0Weight: 71.8,
    });
    assert.equal(result.previousMarathonEndWeight, 70.5);
    assert.equal(result.currentMarathonDay0Weight, 71.8);
    assert.equal(result.weightDifference, 1.3);
    assert.equal(result.changeLabel, '+1.3 kg ↑ Increase');
  });

  it('returns null when either weight is missing or invalid', () => {
    assert.equal(buildMarathonWeightComparison({
      previousMarathonEndWeight: 70,
      currentMarathonDay0Weight: null,
    }), null);
    assert.equal(buildMarathonWeightComparison({
      previousMarathonEndWeight: 0,
      currentMarathonDay0Weight: 70,
    }), null);
    assert.equal(buildMarathonWeightComparison({
      previousMarathonEndWeight: 70,
      currentMarathonDay0Weight: -1,
    }), null);
  });

  it('formats zero change label', () => {
    assert.equal(formatMarathonWeightChangeLabel(0, 'unchanged'), '0 kg — No Change');
  });
});
