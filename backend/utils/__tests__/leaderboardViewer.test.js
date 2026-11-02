/**
 * Run: node --test backend/utils/__tests__/leaderboardViewer.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseLeaderboardUserId } from '../leaderboardViewer.js';

describe('parseLeaderboardUserId', () => {
  it('accepts positive integers only', () => {
    assert.equal(parseLeaderboardUserId(19), 19);
    assert.equal(parseLeaderboardUserId('19'), 19);
    assert.equal(parseLeaderboardUserId('firebaseUid'), null);
    assert.equal(parseLeaderboardUserId(''), null);
  });
});
