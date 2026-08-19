/**
 * Run: node --test frontend/src/features/wellness-score-sheet/domain/__tests__/historyPaint.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  asHistoryDay,
  historyDaysForInstantPaint,
  isSingleDayRange,
  rangeKey,
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
});
