/**
 * Run: node --test backend/features/testimonials/__tests__/websiteDisplayConsent.rules.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  canRequestDisplayConsent,
  hasWebsiteDisplayConsent,
  isPublicWebsiteEligible,
  ownerAllowsPublicTeamMedia,
  parseWebsiteDisplayAgreed,
  resolvePublicTeamMediaAccess,
  websiteDisplayOtpRecipientKey,
} from '../domain/websiteDisplayConsent.rules.js';
import { selectPublicTeamMediaCandidates } from '../../coach-portfolio/domain/public-team-media.rules.js';

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

  it('ownerAllowsPublicTeamMedia requires owner consent_at', () => {
    assert.equal(ownerAllowsPublicTeamMedia(null), false);
    assert.equal(ownerAllowsPublicTeamMedia({ status: 'verified' }), false);
    assert.equal(
      ownerAllowsPublicTeamMedia({ website_display_consent_at: '2026-11-12T10:00:00Z' }),
      true,
    );
  });

  it('resolvePublicTeamMediaAccess: flag OFF is legacy (allow, no member consent)', () => {
    assert.deepEqual(
      resolvePublicTeamMediaAccess({
        consentFlagEnabled: false,
        ownerTestimonial: null,
      }),
      { allow: true, requireDisplayConsent: false },
    );
  });

  it('resolvePublicTeamMediaAccess: flag ON + owner without consent → empty site', () => {
    assert.deepEqual(
      resolvePublicTeamMediaAccess({
        consentFlagEnabled: true,
        ownerTestimonial: { status: 'verified' },
      }),
      { allow: false, requireDisplayConsent: true },
    );
  });

  it('resolvePublicTeamMediaAccess: flag ON + owner consented → load with member consent', () => {
    assert.deepEqual(
      resolvePublicTeamMediaAccess({
        consentFlagEnabled: true,
        ownerTestimonial: { website_display_consent_at: '2026-11-12T10:00:00Z' },
      }),
      { allow: true, requireDisplayConsent: true },
    );
  });

  it('owner off → no downline media even when downlines consented', () => {
    const access = resolvePublicTeamMediaAccess({
      consentFlagEnabled: true,
      ownerTestimonial: null,
    });
    assert.equal(access.allow, false);
    // Callers short-circuit before select; if they did select with requireDisplayConsent,
    // consented downlines would still be candidates — but allow=false blocks the load.
    const downlines = selectPublicTeamMediaCandidates([
      {
        user: { UserId: 2, UserName: 'Downline' },
        testimonial: {
          status: 'verified',
          video_status: 'verified',
          before_image_path: '2/before.jpg',
          after_image_path: '2/after.jpg',
          health_video_path: '2/health.mp4',
          website_display_consent_at: '2026-11-09T10:00:00Z',
        },
      },
    ], { requireDisplayConsent: true });
    assert.equal(downlines.sayCandidates.length, 1);
    assert.equal(access.allow, false);
  });

  it('owner on → only consented downlines included', () => {
    const access = resolvePublicTeamMediaAccess({
      consentFlagEnabled: true,
      ownerTestimonial: { websiteDisplayConsentAt: '2026-11-12' },
    });
    assert.equal(access.allow, true);
    const { sayCandidates, doCandidates } = selectPublicTeamMediaCandidates([
      {
        user: { UserId: 2, UserName: 'Consented' },
        testimonial: {
          status: 'verified',
          video_status: 'verified',
          before_image_path: '2/before.jpg',
          after_image_path: '2/after.jpg',
          health_video_path: '2/health.mp4',
          website_display_consent_at: '2026-11-09T10:00:00Z',
        },
      },
      {
        user: { UserId: 3, UserName: 'NoConsent' },
        testimonial: {
          status: 'verified',
          video_status: 'none',
          before_image_path: '3/before.jpg',
          after_image_path: '3/after.jpg',
        },
      },
    ], { requireDisplayConsent: access.requireDisplayConsent });
    assert.equal(sayCandidates.length, 1);
    assert.equal(sayCandidates[0].memberName, 'Consented');
    assert.equal(doCandidates.length, 1);
    assert.equal(doCandidates[0].memberName, 'Consented');
  });

  it('matrix: owner + downline both verified → show; any side missing → hide', () => {
    const downlineConsented = {
      user: { UserId: 20, UserName: 'Member A' },
      testimonial: {
        status: 'verified',
        video_status: 'verified',
        before_image_path: '20/b.jpg',
        after_image_path: '20/a.jpg',
        health_video_path: '20/h.mp4',
        website_display_consent_at: '2026-11-12T08:00:00Z',
      },
    };
    const downlineNotConsented = {
      user: { UserId: 21, UserName: 'Member B' },
      testimonial: {
        status: 'verified',
        video_status: 'verified',
        before_image_path: '21/b.jpg',
        after_image_path: '21/a.jpg',
        health_video_path: '21/h.mp4',
      },
    };

    // Owner not verified → site empty (even if Member A consented).
    const ownerOff = resolvePublicTeamMediaAccess({
      consentFlagEnabled: true,
      ownerTestimonial: { status: 'verified' },
    });
    assert.equal(ownerOff.allow, false);

    // Owner verified + only consented downlines → Member A only.
    const ownerOn = resolvePublicTeamMediaAccess({
      consentFlagEnabled: true,
      ownerTestimonial: { website_display_consent_at: '2026-11-12T09:00:00Z' },
    });
    assert.equal(ownerOn.allow, true);
    const picked = selectPublicTeamMediaCandidates(
      [downlineConsented, downlineNotConsented],
      { requireDisplayConsent: ownerOn.requireDisplayConsent },
    );
    assert.deepEqual(picked.sayCandidates.map((c) => c.memberName), ['Member A']);
    assert.deepEqual(picked.doCandidates.map((c) => c.memberName), ['Member A']);
  });
});
