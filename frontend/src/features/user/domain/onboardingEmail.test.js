/**
 * Unit tests for onboarding email client helpers.
 * Run: node --test frontend/src/features/user/domain/onboardingEmail.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  looksLikeEmail,
  formatOtpCountdown,
  ONBOARDING_EMAIL_OTP_SECONDS,
} from './onboardingEmail.js';

describe('looksLikeEmail', () => {
  it('accepts a normal address', () => {
    assert.equal(looksLikeEmail('User@Example.com'), true);
  });

  it('rejects empty or incomplete values', () => {
    assert.equal(looksLikeEmail(''), false);
    assert.equal(looksLikeEmail('not-an-email'), false);
    assert.equal(looksLikeEmail('a@b'), false);
  });
});

describe('formatOtpCountdown', () => {
  it('formats five minutes', () => {
    assert.equal(ONBOARDING_EMAIL_OTP_SECONDS, 300);
    assert.equal(formatOtpCountdown(300), '5:00');
    assert.equal(formatOtpCountdown(59), '0:59');
    assert.equal(formatOtpCountdown(0), '0:00');
  });
});
