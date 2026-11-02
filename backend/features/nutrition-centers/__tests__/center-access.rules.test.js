/**
 * Run: node --test backend/features/nutrition-centers/__tests__/center-access.rules.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { canUnregisterCenter } from '../domain/center-access.rules.js';

const PAIR = { CoachId: 10, CoCoachId: 20 };

describe('canUnregisterCenter', () => {
  it('allows the owner', () => {
    assert.equal(canUnregisterCenter({ actorUserId: 10, ownerUserId: 10 }), true);
  });

  it('allows admin and developer', () => {
    assert.equal(canUnregisterCenter({ actorUserId: 99, ownerUserId: 10, role: 'admin' }), true);
    assert.equal(canUnregisterCenter({ actorUserId: 99, ownerUserId: 10, role: 'developer' }), true);
  });

  it('allows the coach / co-coach partner', () => {
    assert.equal(canUnregisterCenter({
      actorUserId: 10, ownerUserId: 20, coachTeam: PAIR,
    }), true);
    assert.equal(canUnregisterCenter({
      actorUserId: 20, ownerUserId: 10, coachTeam: PAIR,
    }), true);
  });

  it('rejects unrelated users and incomplete pairs', () => {
    assert.equal(canUnregisterCenter({ actorUserId: 30, ownerUserId: 10, coachTeam: PAIR }), false);
    assert.equal(canUnregisterCenter({ actorUserId: 10, ownerUserId: 20 }), false);
    assert.equal(canUnregisterCenter({
      actorUserId: 10, ownerUserId: 20, coachTeam: { CoachId: 10 },
    }), false);
  });
});
