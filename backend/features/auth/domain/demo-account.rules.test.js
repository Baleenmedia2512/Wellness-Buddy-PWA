/**
 * Run: node --test backend/features/auth/domain/demo-account.rules.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEMO_EMAIL,
  DEMO_LOGIN_OTP,
  DEMO_PHONE_NATIONAL,
  demoPhoneForStorage,
  isDemoEmail,
  isDemoPhone,
  isDemoRecipient,
  isValidDemoDeleteOtp,
  isValidDemoLoginOtp,
} from './demo-account.rules.js';

describe('demo-account.rules', () => {
  it('matches demo email case-insensitively', () => {
    assert.equal(isDemoEmail(DEMO_EMAIL), true);
    assert.equal(isDemoEmail('  TesterEasyWork@gmail.com '), true);
    assert.equal(isDemoEmail('other@example.com'), false);
  });

  it('matches Cashfree demo phone in E.164 and national forms', () => {
    assert.equal(isDemoPhone(DEMO_PHONE_NATIONAL), true);
    assert.equal(isDemoPhone('+919876543211'), true);
    assert.equal(isDemoPhone('919876543211'), true);
    assert.equal(isDemoPhone('9876543210'), false);
  });

  it('routes isDemoRecipient by contactType', () => {
    assert.equal(isDemoRecipient('+919876543211', 'phone'), true);
    assert.equal(isDemoRecipient(DEMO_EMAIL, 'email'), true);
    assert.equal(isDemoRecipient(DEMO_EMAIL, 'phone'), false);
    assert.equal(isDemoRecipient('+919876543211', 'email'), false);
  });

  it('accepts fixed login and delete OTPs', () => {
    assert.equal(isValidDemoLoginOtp(DEMO_LOGIN_OTP), true);
    assert.equal(isValidDemoLoginOtp('0000'), false);
    assert.equal(isValidDemoDeleteOtp('6543'), true);
    assert.equal(isValidDemoDeleteOtp(DEMO_LOGIN_OTP), false);
  });

  it('stores demo phone as 10-digit national', () => {
    assert.equal(demoPhoneForStorage(), DEMO_PHONE_NATIONAL);
  });
});
