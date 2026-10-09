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
  shouldStampSignupConsent,
  consentInsertFields,
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

  it('shouldStampSignupConsent only when gate on, unconsented, and acceptance valid', () => {
    const input = { consentAccepted: true, consentVersion: CURRENT_CONSENT_VERSION };
    assert.equal(shouldStampSignupConsent({ ConsentAcceptedAt: null }, input, true), true);
    assert.equal(shouldStampSignupConsent({ ConsentAcceptedAt: null }, input, false), false);
    assert.equal(
      shouldStampSignupConsent({ ConsentAcceptedAt: '2026-07-31T10:00:00.000Z' }, input, true),
      false,
    );
    assert.equal(shouldStampSignupConsent({ ConsentAcceptedAt: null }, {}, true), false);
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
