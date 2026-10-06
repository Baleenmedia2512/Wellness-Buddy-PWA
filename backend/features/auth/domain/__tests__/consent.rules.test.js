/**
 * Unit tests for consent gate domain rules.
 * Run: node --test backend/features/auth/domain/__tests__/consent.rules.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CURRENT_CONSENT_VERSION,
  hasValidConsentAcceptance,
  isConsentRecorded,
  consentInsertFields,
  shouldStampSignupConsent,
} from '../consent.rules.js';

describe('consent.rules', () => {
  it('hasValidConsentAcceptance requires true + current version', () => {
    assert.equal(hasValidConsentAcceptance({
      consentAccepted: true,
      consentVersion: CURRENT_CONSENT_VERSION,
    }), true);
    assert.equal(hasValidConsentAcceptance({
      consentAccepted: true,
      consentVersion: 'old',
    }), false);
    assert.equal(hasValidConsentAcceptance({
      consentAccepted: false,
      consentVersion: CURRENT_CONSENT_VERSION,
    }), false);
    assert.equal(hasValidConsentAcceptance({}), false);
  });

  it('isConsentRecorded reads ConsentAcceptedAt', () => {
    assert.equal(isConsentRecorded({ ConsentAcceptedAt: '2026-07-31T10:00:00.000Z' }), true);
    assert.equal(isConsentRecorded({ ConsentAcceptedAt: null }), false);
    assert.equal(isConsentRecorded(null), false);
  });

  it('shouldStampSignupConsent only for an unrecorded user who accepted the current version', () => {
    const pending = { ConsentAcceptedAt: null };
    const accepted = { consentAccepted: true, consentVersion: CURRENT_CONSENT_VERSION };
    assert.equal(shouldStampSignupConsent(pending, accepted, true), true);
    assert.equal(shouldStampSignupConsent(pending, {}, true), false);
    assert.equal(shouldStampSignupConsent(pending, { consentAccepted: true, consentVersion: 'old' }, true), false);
    assert.equal(shouldStampSignupConsent({ ConsentAcceptedAt: '2026-07-31T10:00:00.000Z' }, accepted, true), false);
    assert.equal(shouldStampSignupConsent(pending, accepted, false), false);
  });

  it('consentInsertFields sets version + audit columns', () => {
    assert.deepEqual(
      consentInsertFields('2026-07-31T12:00:00.000Z', {
        version: CURRENT_CONSENT_VERSION,
        ipAddress: '203.0.113.10',
        deviceInfo: 'android; Mozilla/5.0',
      }),
      {
        ConsentAcceptedAt: '2026-07-31T12:00:00.000Z',
        ConsentVersion: CURRENT_CONSENT_VERSION,
        ConsentIpAddress: '203.0.113.10',
        ConsentDeviceInfo: 'android; Mozilla/5.0',
      },
    );
  });
});
