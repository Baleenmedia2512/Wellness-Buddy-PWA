/**
 * Run: node --test backend/features/marathon/domain/__tests__/marathonWeightComparison.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getMarathonGapComparisonDates,
  getMarathonWeightComparisonDates,
} from '../marathonCalendar.js';
import {
  buildMarathonDayEntry,
  buildMarathonGapProgress,
  buildMarathonRunningProgress,
  buildMarathonWeightComparison,
  formatMarathonDayComparisonLine,
} from '../marathonWeightComparison.js';

describe('backend marathon weight comparison dates', () => {
  it('resolves Sep 1 from Aug 11 previous marathon end', () => {
    assert.deepEqual(getMarathonWeightComparisonDates('2026-09-01'), {
      currentDay0Ymd: '2026-09-01',
      previousDay10Ymd: '2026-08-11',
      marathonNumber: 1,
    });
  });

  it('handles leap-year February boundaries', () => {
    assert.deepEqual(getMarathonWeightComparisonDates('2028-03-01'), {
      currentDay0Ymd: '2028-03-01',
      previousDay10Ymd: '2028-02-11',
      marathonNumber: 1,
    });
    assert.deepEqual(getMarathonWeightComparisonDates('2028-02-15'), {
      currentDay0Ymd: '2028-02-15',
      previousDay10Ymd: '2028-02-25',
      marathonNumber: 2,
    });
  });
});

describe('backend marathon gap comparison dates', () => {
  it('resolves Sep 12 gap before Marathon 2', () => {
    assert.deepEqual(getMarathonGapComparisonDates('2026-09-12'), {
      previousDay10Ymd: '2026-09-25',
      upcomingDay0Ymd: '2026-09-15',
      upcomingMarathonNumber: 2,
    });
  });

  it('resolves Sep 26 gap before next Marathon 1', () => {
    assert.deepEqual(getMarathonGapComparisonDates('2026-09-26'), {
      previousDay10Ymd: '2026-09-11',
      upcomingDay0Ymd: '2026-10-01',
      upcomingMarathonNumber: 1,
    });
  });

  it('returns null during an active marathon', () => {
    assert.equal(getMarathonGapComparisonDates('2026-09-03'), null);
  });
});

describe('backend marathon day formatting', () => {
  it('formats Day 0 vs Day N against Day 0 baseline', () => {
    assert.equal(formatMarathonDayComparisonLine(75, 74.5), '75.00 kg → 74.50 kg ↓ 0.50 kg');
    assert.equal(formatMarathonDayComparisonLine(75, 76), '75.00 kg → 76.00 kg ↑ 1.00 kg');
    assert.equal(formatMarathonDayComparisonLine(75, 75), '75.00 kg → 75.00 kg');
    assert.equal(formatMarathonDayComparisonLine(75, null), '75.00 kg → —');
  });

  it('builds running marathon day entries', () => {
    const day0 = buildMarathonDayEntry({
      day: 0,
      ymd: '2026-09-01',
      day0Weight: 75,
      dayWeight: 75,
    });
    assert.equal(day0.displayLine, '75.00 kg');

    const day2 = buildMarathonDayEntry({
      day: 2,
      ymd: '2026-09-03',
      day0Weight: 75,
      dayWeight: 74,
    });
    assert.equal(day2.displayLine, '75.00 kg → 74.00 kg ↓ 1.00 kg');
  });

  it('builds running progress for Day 0 with previous marathon end comparison', () => {
    const dayYmds = Array.from({ length: 11 }, (_, day) => `2026-09-${String(day + 1).padStart(2, '0')}`);
    const result = buildMarathonRunningProgress({
      currentDay0Ymd: '2026-09-01',
      marathonNumber: 1,
      currentMarathonDay: 0,
      dayYmds,
      weightsByDay: { 0: 73 },
      previousMarathonEndWeight: 75,
      previousDay10Ymd: '2026-08-11',
    });
    assert.equal(result.previousMarathonEndWeight, 75);
    assert.equal(result.currentWeight, 73);
    assert.equal(result.direction, 'decrease');
    assert.equal(result.weightDifference, -2);
  });

  it('builds running progress for Day 0 through Day 10', () => {
    const dayYmds = Array.from({ length: 11 }, (_, day) => `2026-09-${String(day + 1).padStart(2, '0')}`);
    const result = buildMarathonRunningProgress({
      currentDay0Ymd: '2026-09-01',
      marathonNumber: 1,
      currentMarathonDay: 2,
      dayYmds,
      weightsByDay: { 0: 75, 1: 74.5, 2: 74 },
    });
    assert.equal(result.mode, 'running');
    assert.equal(result.days.length, 11);
    assert.equal(result.days[2].displayLine, '75.00 kg → 74.00 kg ↓ 1.00 kg');
  });
});

describe('backend buildMarathonWeightComparison', () => {
  it('builds gap comparison from previous end and current weight', () => {
    const result = buildMarathonWeightComparison({
      previousMarathonEndWeight: 75,
      currentMarathonDay0Weight: 73,
      previousDay10Ymd: '2026-08-11',
      currentDay0Ymd: '2026-09-01',
    });
    assert.equal(result.mode, 'gap');
    assert.equal(result.weightDifference, -2);
    assert.equal(result.direction, 'decrease');
    assert.equal(result.changeLabel, '−2.00 kg ↓ Decrease');
    assert.equal(result.previousDay10Ymd, '2026-08-11');
    assert.equal(result.currentDay0Ymd, '2026-09-01');
  });

  it('builds partial gap comparison when a weight is missing', () => {
    const result = buildMarathonGapProgress({
      previousMarathonEndWeight: 75,
      currentWeight: null,
      previousDay10Ymd: '2026-08-11',
    });
    assert.equal(result.mode, 'gap');
    assert.equal(result.partial, true);
    assert.equal(result.previousMarathonEndWeight, 75);
    assert.equal(result.currentWeight, null);
  });
});
