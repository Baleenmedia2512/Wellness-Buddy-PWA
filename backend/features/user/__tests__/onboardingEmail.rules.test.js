/**
 * Unit tests for onboarding email assign / recover-account rules.
 * Run: node --test backend/features/user/__tests__/onboardingEmail.rules.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  decideOnboardingEmailAction,
  planAdoptPhoneTransfer,
  EMAIL_TAKEN_ADOPT_MESSAGE,
} from '../domain/onboardingEmail.rules.js';

describe('decideOnboardingEmailAction', () => {
  it('assigns when no other user owns the email', () => {
    assert.deepEqual(
      decideOnboardingEmailAction({ currentUserId: 10, emailOwnerUserId: null }),
      { action: 'ASSIGN' },
    );
  });

  it('treats the same user as already owning the email', () => {
    assert.deepEqual(
      decideOnboardingEmailAction({ currentUserId: 10, emailOwnerUserId: 10 }),
      { action: 'ALREADY_OWNED' },
    );
  });

  it('offers recover-account when another user owns the email', () => {
    const result = decideOnboardingEmailAction({
      currentUserId: 10,
      emailOwnerUserId: 99,
    });
    assert.equal(result.action, 'OFFER_ADOPT');
    assert.equal(result.code, 'EMAIL_TAKEN');
    assert.equal(result.message, EMAIL_TAKEN_ADOPT_MESSAGE);
  });

  it('adopts the existing account when the user confirms', () => {
    assert.deepEqual(
      decideOnboardingEmailAction({
        currentUserId: 10,
        emailOwnerUserId: 99,
        adoptExisting: true,
      }),
      { action: 'ADOPT' },
    );
  });
});

describe('planAdoptPhoneTransfer', () => {
  it('requires the new phone from the current login', () => {
    const result = planAdoptPhoneTransfer({ newPhone: '', existingPhone: '+919999' });
    assert.equal(result.ok, false);
    assert.match(result.message, /phone number is missing/i);
  });

  it('moves a different new number onto the recovered account', () => {
    const result = planAdoptPhoneTransfer({
      newPhone: '+919000000001',
      existingPhone: '+919000000002',
    });
    assert.equal(result.ok, true);
    assert.equal(result.samePhone, false);
  });

  it('skips the write when the recovered account already has this phone', () => {
    const result = planAdoptPhoneTransfer({
      newPhone: '+919000000001',
      existingPhone: '+919000000001',
    });
    assert.equal(result.ok, true);
    assert.equal(result.samePhone, true);
  });
});
