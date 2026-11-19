/**
 * Run: node --test frontend/src/features/events/domain/registrationBooking.rules.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { selfBookingAlreadyTaken } from './registrationBooking.rules.js';

describe('selfBookingAlreadyTaken', () => {
  it('stops a second ticket for the same person', () => {
    assert.equal(selfBookingAlreadyTaken({ paymentStatus: 'paid', entryCode: 'A1' }), true);
  });

  it('still allows a friend ticket', () => {
    assert.equal(selfBookingAlreadyTaken({
      paymentStatus: 'paid',
      entryCode: 'B2',
      bookingFor: 'friend',
    }), false);
  });
});
