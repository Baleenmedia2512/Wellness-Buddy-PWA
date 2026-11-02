import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  isOtpBulkInputType,
  resolveOtpDigits,
} from './otpInputPaste.js';
import { EMAIL_OTP_LENGTH, SMS_OTP_LENGTH } from './otpLength.js';

describe('isOtpBulkInputType', () => {
  it('recognises paste and autofill input types', () => {
    assert.equal(isOtpBulkInputType('insertFromPaste'), true);
    assert.equal(isOtpBulkInputType('insertReplacementText'), true);
    assert.equal(isOtpBulkInputType('insertFromDrop'), true);
    assert.equal(isOtpBulkInputType('insertText'), false);
    assert.equal(isOtpBulkInputType('deleteContentBackward'), false);
  });
});

describe('resolveOtpDigits', () => {
  it('distributes a full SMS OTP regardless of spacing', () => {
    assert.equal(resolveOtpDigits('1234', SMS_OTP_LENGTH), '1234');
    assert.equal(resolveOtpDigits('12 34', SMS_OTP_LENGTH), '1234');
  });

  it('uses only the first N digits when pasted text is longer', () => {
    assert.equal(resolveOtpDigits('123456789', SMS_OTP_LENGTH), '1234');
    assert.equal(resolveOtpDigits('12345', EMAIL_OTP_LENGTH), '1234');
  });

  it('returns partial digits without crashing', () => {
    assert.equal(resolveOtpDigits('123', SMS_OTP_LENGTH), '123');
    assert.equal(resolveOtpDigits('12', EMAIL_OTP_LENGTH), '12');
  });

  it('strips non-numeric characters', () => {
    assert.equal(resolveOtpDigits('12-34', SMS_OTP_LENGTH), '1234');
    assert.equal(resolveOtpDigits('Code: 4821', EMAIL_OTP_LENGTH), '4821');
  });
});
