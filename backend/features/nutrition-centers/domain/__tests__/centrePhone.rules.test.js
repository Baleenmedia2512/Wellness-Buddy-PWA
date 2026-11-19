/**
 * Run: node --test backend/features/nutrition-centers/domain/__tests__/centrePhone.rules.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  centrePhoneNeedsVerification,
  centrePhoneRecipientKey,
} from '../centrePhone.rules.js';

const hours = { monday: { closed: false, slots: [] } };

describe('centre phone OTP', () => {
  it('keeps the account number without a new code', () => {
    assert.equal(centrePhoneNeedsVerification({
      ownerPhone: '+919876543210',
      accountPhone: '9876543210',
      appVersion: '3.5.6',
      openingHours: hours,
    }), false);
  });

  it('asks for a code when the new form uses a different number', () => {
    assert.equal(centrePhoneNeedsVerification({
      ownerPhone: '+919111111111',
      accountPhone: '9876543210',
      appVersion: '3.5.6',
      openingHours: hours,
    }), true);
  });

  it('lets an older app save a different number', () => {
    assert.equal(centrePhoneNeedsVerification({
      ownerPhone: '+919111111111',
      accountPhone: '9876543210',
      appVersion: '3.5.6',
      openingHours: null,
    }), false);
  });

  it('keeps a centre number that was already saved', () => {
    assert.equal(centrePhoneNeedsVerification({
      ownerPhone: '+919111111111',
      accountPhone: '9876543210',
      savedPhone: '+919111111111',
      appVersion: '3.5.7',
      openingHours: hours,
    }), false);
  });

  it('scopes the code to the member and the number', () => {
    assert.equal(centrePhoneRecipientKey(4, '+919876543210'), 'centre-phone:4:919876543210');
  });
});
