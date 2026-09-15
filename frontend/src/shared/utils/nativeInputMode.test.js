/**
 * nativeInputMode — OTP autofill attrs must stay one-time-code on mobile.
 * Run: node --test frontend/src/shared/utils/nativeInputMode.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveNativeKeyboardAttrs } from './nativeInputMode.js';

describe('resolveNativeKeyboardAttrs', () => {
  it('keeps one-time-code on OTP fields for SMS suggestion (Android + iOS)', () => {
    const attrs = resolveNativeKeyboardAttrs({
      inputMode: 'numeric',
      type: 'text',
      autoComplete: 'one-time-code',
      isOtp: true,
    });
    assert.equal(attrs.autoComplete, 'one-time-code');
    assert.equal(attrs.type, 'text');
    assert.equal(attrs.inputMode, 'numeric');
  });

  it('uses tel dial pad for non-OTP numeric fields', () => {
    const attrs = resolveNativeKeyboardAttrs({
      inputMode: 'numeric',
      type: 'text',
      autoComplete: 'tel',
      isOtp: false,
    });
    assert.equal(attrs.type, 'tel');
    assert.equal(attrs.inputMode, 'numeric');
  });

  it('does not claim OTP autofill when autocomplete is off', () => {
    const attrs = resolveNativeKeyboardAttrs({
      inputMode: 'numeric',
      autoComplete: 'off',
      isOtp: true,
    });
    assert.equal(attrs.autoComplete, 'off');
    assert.equal(attrs.type, 'tel');
  });
});
