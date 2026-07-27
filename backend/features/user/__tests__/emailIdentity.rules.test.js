/**
 * Unit tests for email identity rules.
 * Run: node --test backend/features/user/__tests__/emailIdentity.rules.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  canAssignEmailToUser,
  normalizeEmailForStorage,
  EMAIL_TAKEN_MESSAGE,
} from '../domain/emailIdentity.rules.js';

describe('normalizeEmailForStorage', () => {
  it('trims and lowercases', () => {
    assert.equal(normalizeEmailForStorage('  User@Example.COM '), 'user@example.com');
  });
});

describe('canAssignEmailToUser', () => {
  it('allows a fresh email with no conflict', () => {
    assert.deepEqual(
      canAssignEmailToUser({ email: 'new@example.com', userId: 10 }),
      { ok: true },
    );
  });

  it('allows when user already owns the same email', () => {
    assert.deepEqual(
      canAssignEmailToUser({
        email: 'User@Example.com',
        userId: 10,
        existingEmailOnUser: 'user@example.com',
        conflictingUserId: 10,
      }),
      { ok: true },
    );
  });

  it('blocks when another user already has the email', () => {
    const result = canAssignEmailToUser({
      email: 'taken@example.com',
      userId: 10,
      conflictingUserId: 99,
    });
    assert.equal(result.ok, false);
    assert.equal(result.code, 'EMAIL_TAKEN');
    assert.equal(result.message, EMAIL_TAKEN_MESSAGE);
  });

  it('allows when conflicting row is the same user', () => {
    assert.deepEqual(
      canAssignEmailToUser({
        email: 'mine@example.com',
        userId: 10,
        conflictingUserId: 10,
      }),
      { ok: true },
    );
  });
});
