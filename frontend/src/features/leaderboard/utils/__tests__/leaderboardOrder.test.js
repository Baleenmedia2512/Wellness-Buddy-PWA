/**
 * Run: node --test frontend/src/features/leaderboard/utils/__tests__/leaderboardOrder.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { sortLeaderboardByRankAsc } from '../leaderboardOrder.js';

describe('sortLeaderboardByRankAsc', () => {
  it('orders #1 then #2 then #3', () => {
    const ordered = sortLeaderboardByRankAsc([
      { userName: 'C', rank: 3 },
      { userName: 'A', rank: 1 },
      { userName: 'B', rank: 2 },
    ]);
    assert.deepEqual(ordered.map((e) => e.userName), ['A', 'B', 'C']);
  });

  it('treats missing rank as 0', () => {
    const ordered = sortLeaderboardByRankAsc([
      { userName: 'B', rank: 1 },
      { userName: 'A' },
    ]);
    assert.deepEqual(ordered.map((e) => e.userName), ['A', 'B']);
  });
});
