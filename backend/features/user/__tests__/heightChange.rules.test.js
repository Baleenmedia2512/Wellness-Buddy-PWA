/**
 * Unit tests — height change OTP domain rules.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  HEIGHT_CHANGE_OTP_MIN_APP_VERSION,
  heightsDiffer,
  isHeightLocked,
  maskEmailForDisplay,
  parseHeightCm,
  shouldDeferHeightChangeToOtp,
  validateHeightCm,
} from '../domain/heightChange.rules.js';

describe('heightChange.rules', () => {
  it('locks only heights in the allowed cm range', () => {
    assert.equal(isHeightLocked(170), true);
    assert.equal(isHeightLocked('170'), true);
    assert.equal(isHeightLocked(null), false);
    assert.equal(isHeightLocked(''), false);
    assert.equal(isHeightLocked(49), false);
    assert.equal(isHeightLocked(199), false);
  });

  it('detects height differences', () => {
    assert.equal(heightsDiffer(170, 171), true);
    assert.equal(heightsDiffer(170, 170), false);
    assert.equal(heightsDiffer(170, '170'), false);
    assert.equal(heightsDiffer(null, 170), true);
  });

  it('validates height cm for profile OTP', () => {
    assert.equal(validateHeightCm(170).valid, true);
    assert.equal(validateHeightCm(170).value, 170);
    assert.equal(validateHeightCm(49).valid, false);
    assert.equal(validateHeightCm(199).valid, false);
    assert.equal(parseHeightCm('172.5'), 172.5);
  });

  it('defers only when flag + new app + locked + different', () => {
    assert.equal(shouldDeferHeightChangeToOtp({
      flagEnabled: true,
      appVersion: '3.5.0',
      existingHeight: 170,
      newHeight: 175,
    }), true);

    assert.equal(shouldDeferHeightChangeToOtp({
      flagEnabled: true,
      appVersion: '3.5.0',
      existingHeight: 170,
      newHeight: 170,
    }), false);

    assert.equal(shouldDeferHeightChangeToOtp({
      flagEnabled: true,
      appVersion: '3.5.0',
      existingHeight: null,
      newHeight: 170,
    }), false);

    assert.equal(shouldDeferHeightChangeToOtp({
      flagEnabled: true,
      appVersion: '3.4.9',
      existingHeight: 170,
      newHeight: 175,
    }), false);

    assert.equal(shouldDeferHeightChangeToOtp({
      flagEnabled: true,
      appVersion: null,
      existingHeight: 170,
      newHeight: 175,
    }), false);

    assert.equal(shouldDeferHeightChangeToOtp({
      flagEnabled: false,
      appVersion: '3.5.0',
      existingHeight: 170,
      newHeight: 175,
    }), false);
  });

  it('masks email for display', () => {
    assert.equal(maskEmailForDisplay('yasheer@example.com'), 'ya***@example.com');
  });

  it('documents min app version for legacy dual-path', () => {
    assert.equal(HEIGHT_CHANGE_OTP_MIN_APP_VERSION, '3.5.0');
  });
});
