/**
 * Run: node --test frontend/src/features/wellness-score-sheet/domain/__tests__/historyPaint.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  asHistoryDay,
  historyDaysForInstantPaint,
  isSingleDayRange,
  pickLiveDailyScore,
  rangeKey,
  scoreIsForDate,
  selectHistoryDay,
  snapshotMatchesRange,
} from '../historyPaint.js';

const daily = {
  date: '2026-08-13',
  totalEarned: 496,
  totalPossible: 1000,
  percentage: 50,
  parameters: [{ key: 'lunch', earnedPoints: 50 }],
};

describe('historyPaint', () => {
  it('detects a single-day range', () => {
    assert.equal(isSingleDayRange('2026-08-13', '2026-08-13'), true);
    assert.equal(isSingleDayRange('2026-08-04', '2026-08-13'), false);
    assert.equal(rangeKey('2026-08-13', '2026-08-13'), '2026-08-13__2026-08-13');
  });

  it('paints Home daily cache when the sheet snapshot is empty', () => {
    const days = historyDaysForInstantPaint({
      snapshot: null,
      userId: '339',
      startDate: '2026-08-13',
      endDate: '2026-08-13',
      dailyScore: daily,
    });
    assert.equal(days.length, 1);
    assert.equal(days[0].totalEarned, 496);
    assert.equal(days[0].date, '2026-08-13');
  });

  it('prefers Home daily cache over a stale sheet snapshot for Today', () => {
    const snapshot = {
      userId: '339',
      rangeKey: '2026-08-13__2026-08-13',
      days: [{ date: '2026-08-13', totalEarned: 482 }],
    };
    const days = historyDaysForInstantPaint({
      snapshot,
      userId: '339',
      startDate: '2026-08-13',
      endDate: '2026-08-13',
      dailyScore: daily,
    });
    assert.equal(days[0].totalEarned, 496);
  });

  it('falls back to a matching sheet snapshot when daily cache is empty', () => {
    const snapshot = {
      userId: '339',
      rangeKey: '2026-08-13__2026-08-13',
      days: [{ date: '2026-08-13', totalEarned: 482 }],
    };
    const days = historyDaysForInstantPaint({
      snapshot,
      userId: '339',
      startDate: '2026-08-13',
      endDate: '2026-08-13',
      dailyScore: null,
    });
    assert.equal(days[0].totalEarned, 482);
  });

  it('ignores a snapshot for a different range', () => {
    assert.equal(snapshotMatchesRange({
      snapshot: { userId: '339', rangeKey: '2026-08-12__2026-08-12', days: [daily] },
      userId: '339',
      startDate: '2026-08-13',
      endDate: '2026-08-13',
    }), false);

    const days = historyDaysForInstantPaint({
      snapshot: { userId: '339', rangeKey: '2026-08-12__2026-08-12', days: [{ totalEarned: 1 }] },
      userId: '339',
      startDate: '2026-08-13',
      endDate: '2026-08-13',
      dailyScore: daily,
    });
    assert.equal(days[0].totalEarned, 496);
  });

  it('does not paint a snapshot that belongs to a different user', () => {
    const snapshot = {
      userId: '1',
      rangeKey: '2026-08-16__2026-08-16',
      days: [{ date: '2026-08-16', totalEarned: 400, userId: '1' }],
    };
    assert.equal(snapshotMatchesRange({
      snapshot,
      userId: '22',
      startDate: '2026-08-16',
      endDate: '2026-08-16',
    }), false);

    const days = historyDaysForInstantPaint({
      snapshot,
      userId: '22',
      startDate: '2026-08-16',
      endDate: '2026-08-16',
      dailyScore: null,
    });
    assert.deepEqual(days, []);
  });

  it('does not invent a multi-day row from a single daily cache', () => {
    const days = historyDaysForInstantPaint({
      snapshot: null,
      userId: '339',
      startDate: '2026-08-04',
      endDate: '2026-08-13',
      dailyScore: daily,
    });
    assert.deepEqual(days, []);
  });

  it('fills date on asHistoryDay', () => {
    assert.equal(asHistoryDay({ totalEarned: 10 }, '2026-08-13').date, '2026-08-13');
    assert.equal(asHistoryDay(null, '2026-08-13'), null);
  });

  it('does not instant-paint a daily cache stamped for a different day', () => {
    const days = historyDaysForInstantPaint({
      snapshot: null,
      userId: '339',
      startDate: '2026-08-12',
      endDate: '2026-08-12',
      dailyScore: daily,
    });
    assert.deepEqual(days, []);
  });

  it('scoreIsForDate is strict about YYYY-MM-DD', () => {
    assert.equal(scoreIsForDate(daily, '2026-08-13'), true);
    assert.equal(scoreIsForDate(daily, '2026-08-12'), false);
    assert.equal(scoreIsForDate({ totalEarned: 10 }, '2026-08-13'), false);
    assert.equal(scoreIsForDate(null, '2026-08-13'), false);
  });

  it('pickLiveDailyScore ignores the previous Today/Yesterday payload', () => {
    const today = { date: '2026-08-18', totalEarned: 500 };
    const yesterday = { date: '2026-08-17', totalEarned: 220 };

    assert.equal(pickLiveDailyScore({
      liveScore: today,
      parentScore: today,
      dateYmd: '2026-08-17',
    }), null);
    assert.equal(pickLiveDailyScore({
      liveScore: today,
      parentScore: yesterday,
      dateYmd: '2026-08-17',
    }).totalEarned, 220);
    assert.equal(pickLiveDailyScore({
      liveScore: yesterday,
      parentScore: today,
      dateYmd: '2026-08-18',
    }).totalEarned, 500);
  });

  it('selectHistoryDay does not return the only row when it is a different day', () => {
    assert.equal(selectHistoryDay([daily], '2026-08-12'), null);
    assert.equal(selectHistoryDay([daily], '2026-08-13').totalEarned, 496);
    assert.equal(selectHistoryDay([daily], null).totalEarned, 496);
  });
});
