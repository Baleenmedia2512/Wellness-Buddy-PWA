/**
 * Run: node --test backend/shared/lib/__tests__/otp.constants.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generateOtp, OTP_LENGTH, OTP_REGEX } from '../otp.constants.js';

describe('otp.constants', () => {
  it('generates exactly OTP_LENGTH digits', () => {
    for (let i = 0; i < 50; i++) {
      const code = generateOtp();
      assert.equal(code.length, OTP_LENGTH);
      assert.match(code, OTP_REGEX);
    }
  });
});
