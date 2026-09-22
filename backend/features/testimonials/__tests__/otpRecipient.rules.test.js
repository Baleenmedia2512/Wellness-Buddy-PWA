/**
 * Run: node --test backend/features/testimonials/__tests__/otpRecipient.rules.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveCoCoachPartnerId,
  resolveOtpRecipientIds,
  toPositiveUserId,
} from '../domain/otpRecipient.rules.js';

describe('toPositiveUserId', () => {
  it('accepts positive ids', () => {
    assert.equal(toPositiveUserId(12), 12);
    assert.equal(toPositiveUserId('7'), 7);
  });

  it('rejects empty values', () => {
    assert.equal(toPositiveUserId(null), null);
    assert.equal(toPositiveUserId(0), null);
    assert.equal(toPositiveUserId(''), null);
  });
});

describe('resolveCoCoachPartnerId', () => {
  it('returns CoCoachId when user is Sponsor', () => {
    assert.equal(
      resolveCoCoachPartnerId({ userId: 10, coachId: 10, coCoachId: 20 }),
      20,
    );
  });

  it('returns CoachId when user is Co-Sponsor', () => {
    assert.equal(
      resolveCoCoachPartnerId({ userId: 20, coachId: 10, coCoachId: 20 }),
      10,
    );
  });

  it('returns null when partner missing or user not on row', () => {
    assert.equal(
      resolveCoCoachPartnerId({ userId: 10, coachId: 10, coCoachId: null }),
      null,
    );
    assert.equal(
      resolveCoCoachPartnerId({ userId: 99, coachId: 10, coCoachId: 20 }),
      null,
    );
  });
});

describe('resolveOtpRecipientIds', () => {
  it('prefers coach over co-coach', () => {
    assert.deepEqual(
      resolveOtpRecipientIds({ memberCoachId: 5, coCoachPartnerId: 9 }),
      { recipientId: 5, source: 'coach' },
    );
  });

  it('falls back to co-coach when no coach (top-level admin)', () => {
    assert.deepEqual(
      resolveOtpRecipientIds({ memberCoachId: null, coCoachPartnerId: 9 }),
      { recipientId: 9, source: 'co-coach' },
    );
  });

  it('returns null when neither exists', () => {
    assert.deepEqual(
      resolveOtpRecipientIds({ memberCoachId: null, coCoachPartnerId: null }),
      { recipientId: null, source: null },
    );
  });
});
