/**
 * Rank after hierarchy filter — never global-top then filter.
 * Run: node --test backend/utils/__tests__/wellnessScoreLeaderboard.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  aggregateWellnessWindowScores,
  rankWellnessLeaderboardEntries,
} from '../wellnessScoreLeaderboard.js';

describe('rankWellnessLeaderboardEntries', () => {
  it('takes Top N from the already-filtered set, not a global list', () => {
    const allowed = [
      { userId: 1, userName: 'Usha', wellnessPercentage: 40, totalEarned: 40 },
      { userId: 2, userName: 'Balaji', wellnessPercentage: 90, totalEarned: 90 },
      { userId: 3, userName: 'Prem', wellnessPercentage: 70, totalEarned: 70 },
    ];
    // A1 would be #1 globally but is not in the allowed set.
    const ranked = rankWellnessLeaderboardEntries(allowed, 10);
    const names = ranked.map((e) => e.userName);
    assert.equal(names.includes('A1'), false);
    assert.deepEqual(
      ranked.map((e) => e.userName),
      ['Balaji', 'Prem', 'Usha'],
    );
    assert.equal(ranked[0].rank, 1);
    assert.equal(ranked[0].userName, 'Balaji');
  });

  it('caps at topN after sorting filtered candidates', () => {
    const allowed = Array.from({ length: 15 }, (_, i) => ({
      userId: i + 1,
      userName: `U${i + 1}`,
      wellnessPercentage: 100 - i,
      totalEarned: 100 - i,
    }));
    const ranked = rankWellnessLeaderboardEntries(allowed, 10);
    assert.equal(ranked.length, 10);
    assert.equal(ranked[0].userName, 'U1');
    assert.equal(ranked[0].rank, 1);
    assert.equal(ranked[ranked.length - 1].userName, 'U10');
  });

  it('ranks a last-10-days board by summed points, so 9000 beats a one-day 1000', () => {
    const ranked = rankWellnessLeaderboardEntries([
      { userId: 1, userName: 'One day', wellnessPercentage: 100, totalEarned: 1000, totalPossible: 1000 },
      { userId: 2, userName: 'Ten days', wellnessPercentage: 90, totalEarned: 9000, totalPossible: 10000 },
    ], 10, { orderBy: 'earned' });
    assert.equal(ranked[0].userName, 'Ten days');
    assert.equal(ranked[0].rank, 1);
    assert.equal(ranked[1].userName, 'One day');
    assert.equal(ranked[1].rank, 2);
  });
});

describe('aggregateWellnessWindowScores', () => {
  it('sums earned and possible and ignores a missing day', () => {
    const totals = aggregateWellnessWindowScores([
      { user_id: 7, score_date: '2026-11-01', total_earned: 900, total_possible: 1000 },
      { user_id: 7, score_date: '2026-11-02', total_earned: 900, total_possible: 1000 },
    ]);
    const row = totals.get(7);
    assert.equal(row.totalEarned, 1800);
    assert.equal(row.totalPossible, 2000);
    assert.equal(row.wellnessPercentage, 90);
  });

  it('keeps one row per user per day, preferring the later computed_at', () => {
    const totals = aggregateWellnessWindowScores([
      {
        user_id: 7,
        score_date: '2026-11-05',
        total_earned: 100,
        total_possible: 1000,
        computed_at: '2026-11-05T01:00:00.000Z',
      },
      {
        user_id: 7,
        score_date: '2026-11-05',
        total_earned: 900,
        total_possible: 1000,
        computed_at: '2026-11-05T02:00:00.000Z',
      },
    ]);
    assert.equal(totals.get(7).totalEarned, 900);
    assert.equal(totals.get(7).totalPossible, 1000);
  });

  it('builds a 9000/10000 window that ranks above a single perfect day', () => {
    const rows = [];
    for (let day = 1; day <= 10; day += 1) {
      const ymd = `2026-11-${String(day).padStart(2, '0')}`;
      rows.push({
        user_id: 2,
        score_date: ymd,
        total_earned: 900,
        total_possible: 1000,
      });
    }
    rows.push({
      user_id: 1,
      score_date: '2026-11-05',
      total_earned: 1000,
      total_possible: 1000,
    });

    const totals = aggregateWellnessWindowScores(rows);
    const tenDay = totals.get(2);
    assert.equal(tenDay.totalEarned, 9000);
    assert.equal(tenDay.totalPossible, 10000);

    const ranked = rankWellnessLeaderboardEntries([
      { userId: 1, userName: 'Today only', ...totals.get(1) },
      { userId: 2, userName: 'Steady', ...tenDay },
    ], 10, { orderBy: 'earned' });
    assert.equal(ranked[0].userName, 'Steady');
    assert.equal(ranked[0].totalEarned, 9000);
    assert.equal(ranked[0].totalPossible, 10000);
  });
});
