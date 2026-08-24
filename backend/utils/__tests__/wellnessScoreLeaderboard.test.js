/**
 * Rank after hierarchy filter — never global-top then filter.
 * Run: node --test backend/utils/__tests__/wellnessScoreLeaderboard.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { rankWellnessLeaderboardEntries } from '../wellnessScoreLeaderboard.js';

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
      ['Usha', 'Prem', 'Balaji'],
    );
    assert.equal(ranked[ranked.length - 1].rank, 1);
    assert.equal(ranked[ranked.length - 1].userName, 'Balaji');
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
    assert.equal(ranked[ranked.length - 1].userName, 'U1');
    assert.equal(ranked[0].userName, 'U10');
  });
});
