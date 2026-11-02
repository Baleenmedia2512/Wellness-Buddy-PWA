/**
 * Run: node --test frontend/src/features/user/domain/demoAccount.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEMO_LOGIN_OTP,
  DEMO_PHONE_NATIONAL,
  isDemoEmail,
  isDemoPhone,
} from './demoAccount.js';

describe('demoAccount', () => {
  it('recognises Cashfree demo phone forms', () => {
    assert.equal(isDemoPhone(DEMO_PHONE_NATIONAL), true);
    assert.equal(isDemoPhone('+919876543211'), true);
    assert.equal(isDemoPhone('9876543210'), false);
  });

  it('exposes fixed login OTP', () => {
    assert.equal(DEMO_LOGIN_OTP, '1234');
  });

  it('keeps email demo helper', () => {
    assert.equal(isDemoEmail('testereasywork@gmail.com'), true);
  });
});
