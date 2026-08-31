/**
 * Run: node --test frontend/src/features/marathon/domain/__tests__/marathonWeightComparisonDates.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getMarathonGapComparisonDates,
  getMarathonWeightComparisonDates,
} from '../marathonCalendar.js';
import {
  buildMarathonGapProgress,
  buildMarathonRunningProgress,
  formatMarathonDayComparisonLine,
  formatMarathonWeightChangeLabel,
  formatMarathonWeightWhatsAppNotice,
  formatMarathonWeightWhatsAppNoticeLines,
  mergeMarathonWeightComparisonForShare,
} from '../marathonWeightComparison.js';

describe('getMarathonWeightComparisonDates', () => {
  it('returns null outside marathon windows', () => {
    assert.equal(getMarathonWeightComparisonDates('2026-08-12'), null);
    assert.equal(getMarathonWeightComparisonDates('2026-08-14'), null);
    assert.equal(getMarathonWeightComparisonDates('2026-08-31'), null);
  });

  it('maps Marathon 1 Day 0 to previous month Day 10 (11th)', () => {
    assert.deepEqual(getMarathonWeightComparisonDates('2026-08-01'), {
      currentDay0Ymd: '2026-08-01',
      previousDay10Ymd: '2026-07-11',
      marathonNumber: 1,
    });
    assert.deepEqual(getMarathonWeightComparisonDates('2026-09-01'), {
      currentDay0Ymd: '2026-09-01',
      previousDay10Ymd: '2026-08-11',
      marathonNumber: 1,
    });
  });

  it('maps Marathon 2 Day 0 to same month Day 10 (25th)', () => {
    assert.deepEqual(getMarathonWeightComparisonDates('2026-08-15'), {
      currentDay0Ymd: '2026-08-15',
      previousDay10Ymd: '2026-08-25',
      marathonNumber: 2,
    });
    assert.deepEqual(getMarathonWeightComparisonDates('2026-09-15'), {
      currentDay0Ymd: '2026-09-15',
      previousDay10Ymd: '2026-09-25',
      marathonNumber: 2,
    });
  });
});

describe('getMarathonGapComparisonDates', () => {
  it('resolves gap days between marathons', () => {
    assert.deepEqual(getMarathonGapComparisonDates('2026-09-12'), {
      previousDay10Ymd: '2026-09-25',
      upcomingDay0Ymd: '2026-09-15',
      upcomingMarathonNumber: 2,
    });
    assert.deepEqual(getMarathonGapComparisonDates('2026-09-26'), {
      previousDay10Ymd: '2026-09-11',
      upcomingDay0Ymd: '2026-10-01',
      upcomingMarathonNumber: 1,
    });
  });
});

describe('marathon day comparison formatting', () => {
  it('formats increase, decrease, unchanged, and missing weights', () => {
    assert.equal(formatMarathonDayComparisonLine(75, 74.5), '75.0 kg → 74.5 kg ↓ 0.5 kg');
    assert.equal(formatMarathonDayComparisonLine(75, 76), '75.0 kg → 76.0 kg ↑ 1.0 kg');
    assert.equal(formatMarathonDayComparisonLine(75, 75), '75.0 kg → 75.0 kg');
    assert.equal(formatMarathonDayComparisonLine(75, null), '75.0 kg → —');
    assert.equal(formatMarathonDayComparisonLine(null, 74.5), '— → 74.5 kg');
  });

  it('builds running progress for profile and share', () => {
    const dayYmds = Array.from({ length: 11 }, (_, day) => `2026-09-${String(day + 1).padStart(2, '0')}`);
    const result = buildMarathonRunningProgress({
      currentDay0Ymd: '2026-09-01',
      marathonNumber: 1,
      currentMarathonDay: 2,
      dayYmds,
      weightsByDay: { 0: 75, 1: 74.5, 2: 74 },
    });
    assert.equal(result.mode, 'running');
    assert.equal(result.days[2].displayLine, '75.0 kg → 74.0 kg ↓ 1.0 kg');
  });
});

describe('formatMarathonWeightWhatsAppNotice', () => {
  it('formats running-day comparison for the current marathon day', () => {
    const progress = buildMarathonRunningProgress({
      currentDay0Ymd: '2026-09-01',
      marathonNumber: 1,
      currentMarathonDay: 2,
      dayYmds: Array.from({ length: 11 }, (_, day) => `2026-09-${String(day + 1).padStart(2, '0')}`),
      weightsByDay: { 0: 75, 2: 74 },
    });
    const lines = formatMarathonWeightWhatsAppNoticeLines(progress, {
      inMarathon: true,
      marathonDay: 2,
    });
    assert.deepEqual(lines, ['75.0 kg → 74.0 kg ↓ 1.0 kg']);
    assert.equal(formatMarathonWeightWhatsAppNotice(progress, {
      inMarathon: true,
      marathonDay: 2,
    }), '75.0 kg → 74.0 kg ↓ 1.0 kg');
  });

  it('formats gap-day previous end vs current weight', () => {
    const progress = buildMarathonGapProgress({
      previousMarathonEndWeight: 75,
      currentWeight: 74.2,
    });
    assert.deepEqual(formatMarathonWeightWhatsAppNoticeLines(progress, {
      inMarathon: false,
      showMarathonStartReminder: false,
    }), [
      'Previous Marathon End weight : 75.0 kg',
      'Current Weight : 74.2 kg ↓',
    ]);
  });

  it('formats zero change label', () => {
    assert.equal(formatMarathonWeightChangeLabel(0, 'unchanged'), '0 kg — No Change');
  });
});

describe('mergeMarathonWeightComparisonForShare', () => {
  it('overrides the current marathon day weight while sharing', () => {
    const source = buildMarathonRunningProgress({
      currentDay0Ymd: '2026-09-01',
      marathonNumber: 1,
      currentMarathonDay: 1,
      dayYmds: Array.from({ length: 11 }, (_, day) => `2026-09-${String(day + 1).padStart(2, '0')}`),
      weightsByDay: { 0: 75, 1: 74.5 },
    });
    const merged = mergeMarathonWeightComparisonForShare(source, 74, 1);
    assert.equal(merged.currentDay.displayLine, '75.0 kg → 74.0 kg ↓ 1.0 kg');
  });

  it('builds gap comparison from current share weight only', () => {
    const merged = mergeMarathonWeightComparisonForShare(null, 73);
    assert.equal(merged.mode, 'gap');
    assert.equal(merged.currentWeight, 73);
    assert.equal(merged.previousMarathonEndWeight, null);
  });
});
