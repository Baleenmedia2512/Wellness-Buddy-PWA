/**
 * Run: node --test backend/features/auth/domain/otp-length.rules.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  EMAIL_OTP_LENGTH,
  SMS_OTP_LENGTH,
  generateEmailOtp,
  generateSmsOtp,
  generateOtpForContactType,
  isValidEmailOtp,
  isValidSmsOtp,
  isValidOtpForContactType,
  extractOtpFromText,
} from './otp-length.rules.js';

describe('generateEmailOtp', () => {
  it('always returns exactly 4 numeric digits in range 1000–9999', () => {
    for (let i = 0; i < 50; i += 1) {
      const otp = generateEmailOtp();
      assert.match(otp, /^\d{4}$/);
      assert.ok(Number(otp) >= 1000);
      assert.ok(Number(otp) <= 9999);
    }
  });
});

describe('generateSmsOtp', () => {
  it('always returns exactly 4 numeric digits', () => {
    for (let i = 0; i < 20; i += 1) {
      const otp = generateSmsOtp();
      assert.match(otp, /^\d{4}$/);
    }
  });
});

describe('generateOtpForContactType', () => {
  it('returns 4 digits for email and phone', () => {
    assert.equal(generateOtpForContactType('email').length, EMAIL_OTP_LENGTH);
    assert.equal(generateOtpForContactType('phone').length, SMS_OTP_LENGTH);
  });
});

describe('isValidEmailOtp', () => {
  it('accepts exactly 4 digits only', () => {
    assert.equal(isValidEmailOtp('1234'), true);
    assert.equal(isValidEmailOtp('123'), false);
    assert.equal(isValidEmailOtp('12345'), false);
    assert.equal(isValidEmailOtp('12a4'), false);
  });
});

describe('isValidSmsOtp', () => {
  it('accepts exactly 4 digits only', () => {
    assert.equal(isValidSmsOtp('1234'), true);
    assert.equal(isValidSmsOtp('123456'), false);
  });
});

describe('isValidOtpForContactType', () => {
  it('routes by contact type', () => {
    assert.equal(isValidOtpForContactType('1234', 'email'), true);
    assert.equal(isValidOtpForContactType('1234', 'phone'), true);
    assert.equal(isValidOtpForContactType('123456', 'email'), false);
    assert.equal(isValidOtpForContactType('123456', 'phone'), false);
  });
});

describe('extractOtpFromText', () => {
  it('extracts plain, spaced, and prose OTP values', () => {
    assert.equal(extractOtpFromText('1234'), '1234');
    assert.equal(extractOtpFromText(' 12 34 '), '1234');
    assert.equal(extractOtpFromText('Your OTP is 1234'), '1234');
    assert.equal(extractOtpFromText('Code: 1234\n'), '1234');
    assert.equal(extractOtpFromText('123'), null);
    assert.equal(extractOtpFromText('12345'), '1234');
    assert.equal(extractOtpFromText('123456', EMAIL_OTP_LENGTH), '1234');
  });

  it('supports 4-digit SMS extraction', () => {
    assert.equal(extractOtpFromText('1234', SMS_OTP_LENGTH), '1234');
    assert.equal(extractOtpFromText('Your code is 4821', SMS_OTP_LENGTH), '4821');
    assert.equal(extractOtpFromText('123456', SMS_OTP_LENGTH), '1234');
  });
});
