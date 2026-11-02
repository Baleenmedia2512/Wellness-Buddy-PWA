import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  EMAIL_OTP_LENGTH,
  SMS_OTP_LENGTH,
  extractOtpFromText,
  isValidEmailOtp,
  isValidSmsOtp,
} from './otpLength.js';

describe('extractOtpFromText', () => {
  it('extracts 4-digit email OTP from plain and prose text', () => {
    assert.equal(extractOtpFromText('1234'), '1234');
    assert.equal(extractOtpFromText(' 12 34 '), '1234');
    assert.equal(extractOtpFromText('Your OTP is 1234'), '1234');
    assert.equal(extractOtpFromText('Code: 1234\n'), '1234');
    assert.equal(extractOtpFromText('123'), null);
  });

  it('takes the first N digits when pasted text is longer than expected length', () => {
    assert.equal(extractOtpFromText('12345', EMAIL_OTP_LENGTH), '1234');
    assert.equal(extractOtpFromText('123456', EMAIL_OTP_LENGTH), '1234');
    assert.equal(extractOtpFromText('123456789', SMS_OTP_LENGTH), '1234');
  });

  it('extracts 4-digit SMS OTP', () => {
    assert.equal(extractOtpFromText('1234', SMS_OTP_LENGTH), '1234');
    assert.equal(extractOtpFromText('Your code is 4821', SMS_OTP_LENGTH), '4821');
    assert.equal(extractOtpFromText('123456', SMS_OTP_LENGTH), '1234');
  });
});

describe('otp validators', () => {
  it('validates email and SMS lengths', () => {
    assert.equal(isValidEmailOtp('1234'), true);
    assert.equal(isValidEmailOtp('12345'), false);
    assert.equal(isValidSmsOtp('1234'), true);
    assert.equal(isValidSmsOtp('123456'), false);
  });
});
