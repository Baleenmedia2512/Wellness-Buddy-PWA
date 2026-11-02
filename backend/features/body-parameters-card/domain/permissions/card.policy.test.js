/**
 * Run: node --test backend/features/body-parameters-card/domain/permissions/card.policy.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  canCreateCard,
  canDeleteCard,
  canSearchTeamPhones,
} from './card.policy.js';

describe('canCreateCard', () => {
  it('allows any authenticated user object', () => {
    assert.equal(canCreateCard({ isCoach: true }), true);
    assert.equal(canCreateCard({}), true);
  });

  it('rejects missing user', () => {
    assert.equal(canCreateCard(null), false);
  });
});

describe('canSearchTeamPhones / canDeleteCard', () => {
  it('requires a positive integer coachId', () => {
    assert.equal(canSearchTeamPhones({ coachId: 12 }), true);
    assert.equal(canDeleteCard({ coachId: 12 }), true);
    assert.equal(canDeleteCard({ coachId: 0 }), false);
    assert.equal(canDeleteCard({ coachId: null }), false);
    assert.equal(canDeleteCard({}), false);
  });
});
