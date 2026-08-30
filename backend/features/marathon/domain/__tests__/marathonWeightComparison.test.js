/**
 * Run: node --test backend/features/marathon/domain/__tests__/marathonWeightComparison.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getMarathonWeightComparisonDates } from '../marathonCalendar.js';
import { buildMarathonWeightComparison } from '../marathonWeightComparison.js';

describe('backend marathon weight comparison dates', () => {
  it('resolves Sep 1 from Aug 25 previous marathon end', () => {
    assert.deepEqual(getMarathonWeightComparisonDates('2026-09-01'), {
      currentDay0Ymd: '2026-09-01',
      previousDay10Ymd: '2026-08-25',
      marathonNumber: 1,
    });
  });

  it('handles leap-year February boundaries', () => {
    assert.deepEqual(getMarathonWeightComparisonDates('2028-03-01'), {
      currentDay0Ymd: '2028-03-01',
      previousDay10Ymd: '2028-02-25',
      marathonNumber: 1,
    });
    assert.deepEqual(getMarathonWeightComparisonDates('2028-02-15'), {
      currentDay0Ymd: '2028-02-15',
      previousDay10Ymd: '2028-02-11',
      marathonNumber: 2,
    });
  });
});

describe('backend buildMarathonWeightComparison', () => {
  it('builds Sep 1 scenario from Aug 25 and Sep 1 weights', () => {
    const result = buildMarathonWeightComparison({
      previousMarathonEndWeight: 75,
      currentMarathonDay0Weight: 73,
      previousDay10Ymd: '2026-08-25',
      currentDay0Ymd: '2026-09-01',
    });
    assert.equal(result.weightDifference, -2);
    assert.equal(result.direction, 'decrease');
    assert.equal(result.changeLabel, '−2.0 kg ↓ Decrease');
    assert.equal(result.previousDay10Ymd, '2026-08-25');
    assert.equal(result.currentDay0Ymd, '2026-09-01');
  });
});
