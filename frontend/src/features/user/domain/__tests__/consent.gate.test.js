/**
 * Run: node --test frontend/src/features/user/domain/__tests__/consent.gate.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { shouldOpenConsentGate } from '../consent.js';

describe('shouldOpenConsentGate', () => {
  it('returns false when consent not required', () => {
    assert.equal(shouldOpenConsentGate(false), false);
    assert.equal(shouldOpenConsentGate(undefined), false);
  });

  it('returns false when user state already cleared consentRequired', () => {
    assert.equal(shouldOpenConsentGate(true, { consentRequired: false }), false);
  });

  it('returns true when consent required and user not yet cleared', () => {
    assert.equal(shouldOpenConsentGate(true, { consentRequired: true }), true);
    assert.equal(shouldOpenConsentGate(true, null), true);
  });
});
