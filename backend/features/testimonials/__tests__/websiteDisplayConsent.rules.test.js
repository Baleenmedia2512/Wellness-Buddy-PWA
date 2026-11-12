/**
 * Run: node --test backend/features/testimonials/__tests__/websiteDisplayConsent.rules.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  canRequestDisplayConsent,
  hasWebsiteDisplayConsent,
  isPublicWebsiteEligible,
  parseWebsiteDisplayAgreed,
  websiteDisplayOtpRecipientKey,
} from '../domain/websiteDisplayConsent.rules.js';

describe('websiteDisplayConsent.rules', () => {
  it('builds stable otp recipient key', () => {
    assert.equal(
      websiteDisplayOtpRecipientKey(10, 55),
      'testimonial-website-display:10:55',
    );
  });

  it('requires coach-verified photo or video before consent OTP', () => {
    assert.equal(canRequestDisplayConsent({ status: 'pending', video_status: 'none' }), false);
    assert.equal(canRequestDisplayConsent({ status: 'verified', video_status: 'none' }), true);
    assert.equal(canRequestDisplayConsent({ status: 'incomplete', video_status: 'verified' }), true);
  });

  it('gates public eligibility on consent_at', () => {
    const verified = { status: 'verified', video_status: 'none' };
    assert.equal(isPublicWebsiteEligible(verified), false);
    assert.equal(
      isPublicWebsiteEligible({ ...verified, website_display_consent_at: '2026-11-09T10:00:00Z' }),
      true,
    );
    assert.equal(hasWebsiteDisplayConsent({ websiteDisplayConsentAt: '2026-11-09' }), true);
  });

  it('parses agreement checkbox payloads', () => {
    assert.equal(parseWebsiteDisplayAgreed(true), true);
    assert.equal(parseWebsiteDisplayAgreed('true'), true);
    assert.equal(parseWebsiteDisplayAgreed(false), false);
    assert.equal(parseWebsiteDisplayAgreed(undefined), false);
  });
});
