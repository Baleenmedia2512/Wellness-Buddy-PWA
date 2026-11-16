/**
 * Run: node --test backend/features/coach-portfolio/__tests__/publishFormDiff.rules.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPublishFormDiff,
  formatPublishDiffText,
} from '../domain/publishFormDiff.rules.js';
import { buildPublishOtpEmail } from '../domain/publishOtpEmail.rules.js';
import {
  hasUnpublishedFormChanges,
  resolveLiveFormJson,
} from '../domain/submission.rules.js';
import { toPublicPortfolioPage } from '../domain/public-page.rules.js';

describe('publishFormDiff.rules', () => {
  const baseForm = {
    personal: {
      fullName: 'Priya',
      professionalTitle: 'Wellness Coach',
      yearsExperience: '5 years',
      background: 'Coach background',
      uniqueApproach: 'Beliefs',
      profilePhoto: 'https://example.com/p.jpg',
    },
    center: {
      centerName: 'Demo Centre',
      city: 'Chennai',
      locality: 'Kodambakkam',
      businessPhone: '9876543210',
      whatsapp: '9876543210',
    },
    mediaBrand: {
      websiteDisplayName: 'Priya Wellness',
      entrancePhoto: null,
      interiorPhotos: [],
      activityPhotos: [],
    },
  };

  it('marks first publish fields as new', () => {
    const diff = buildPublishFormDiff(null, baseForm);
    assert.equal(diff.changes.length > 0, true);
    assert.ok(diff.changes.every((c) => c.kind === 'new' || !c.before));
    assert.ok(diff.changes.some((c) => c.key === 'displayName' && c.after === 'Priya Wellness'));
  });

  it('returns only changed fields on republish', () => {
    const next = {
      ...baseForm,
      mediaBrand: {
        ...baseForm.mediaBrand,
        websiteDisplayName: 'Priya Coach',
      },
      center: {
        ...baseForm.center,
        locality: 'Adyar',
      },
    };
    const diff = buildPublishFormDiff(baseForm, next);
    const keys = diff.changes.map((c) => c.key).sort();
    assert.deepEqual(keys, ['displayName', 'locality']);
    const name = diff.changes.find((c) => c.key === 'displayName');
    assert.equal(name.before, 'Priya Wellness');
    assert.equal(name.after, 'Priya Coach');
    assert.equal(name.kind, 'changed');
  });

  it('omits unchanged fields from text output', () => {
    const next = {
      ...baseForm,
      center: { ...baseForm.center, city: 'Madurai' },
    };
    const lines = formatPublishDiffText(buildPublishFormDiff(baseForm, next));
    assert.ok(lines.some((l) => /City:/.test(l) && /Madurai/.test(l)));
    assert.equal(lines.some((l) => /WhatsApp:/.test(l)), false);
  });
});

describe('publish OTP email includes change highlight', () => {
  it('includes What changed section and excludes offerings', () => {
    const previous = {
      personal: { fullName: 'Old Name', professionalTitle: 'Wellness Coach' },
      center: { city: 'Chennai', locality: 'Kodambakkam' },
      mediaBrand: { websiteDisplayName: 'Old Name' },
    };
    const next = {
      personal: { fullName: 'New Name', professionalTitle: 'Wellness Coach' },
      center: { city: 'Chennai', locality: 'Adyar' },
      mediaBrand: { websiteDisplayName: 'New Name' },
      services: { offerings: ['Weight Management', 'Nutrition Coaching'] },
    };
    const mail = buildPublishOtpEmail({
      otp: '1234',
      form: next,
      previousForm: previous,
      userId: 1,
      userName: 'New Name',
      forCoachApproval: true,
      coachName: 'Coach',
      memberName: 'New Name',
    });
    assert.match(mail.html, /What changed/i);
    assert.match(mail.html, /Changed/);
    assert.match(mail.html, /Old Name/);
    assert.match(mail.html, /New Name/);
    assert.match(mail.text, /Changes:/);
    assert.doesNotMatch(mail.html, /Offerings/i);
    assert.doesNotMatch(mail.html, /Weight Management/);
  });
});

describe('draft vs published snapshot helpers', () => {
  it('hasUnpublishedFormChanges is false when not published', () => {
    assert.equal(hasUnpublishedFormChanges({
      isPublished: false,
      formJson: { mediaBrand: { websiteDisplayName: 'A' } },
      publishedFormJson: null,
    }), false);
  });

  it('hasUnpublishedFormChanges detects draft vs published', () => {
    assert.equal(hasUnpublishedFormChanges({
      isPublished: true,
      formJson: {
        personal: { fullName: 'Draft' },
        center: {},
        mediaBrand: { websiteDisplayName: 'Draft' },
        timings: {},
        services: {},
        goalsConsent: {},
      },
      publishedFormJson: {
        personal: { fullName: 'Live' },
        center: {},
        mediaBrand: { websiteDisplayName: 'Live' },
        timings: {},
        services: {},
        goalsConsent: {},
      },
    }), true);
  });

  it('resolveLiveFormJson prefers PublishedFormJson', () => {
    const live = resolveLiveFormJson({
      formJson: { mediaBrand: { websiteDisplayName: 'Draft' }, personal: {}, center: {}, timings: {}, services: {}, goalsConsent: {} },
      publishedFormJson: { mediaBrand: { websiteDisplayName: 'Live' }, personal: {}, center: {}, timings: {}, services: {}, goalsConsent: {} },
    });
    assert.equal(live.mediaBrand.websiteDisplayName, 'Live');
  });

  it('toPublicPortfolioPage uses published snapshot for display name', () => {
    const page = toPublicPortfolioPage({
      publicSlug: 'chennai/kodambakkam/live-name',
      userName: '',
      formJson: {
        personal: { fullName: 'Draft Person', professionalTitle: 'Wellness Coach' },
        center: { city: 'Chennai', locality: 'Kodambakkam' },
        mediaBrand: { websiteDisplayName: 'Draft Name' },
        timings: {},
        services: {},
        goalsConsent: {},
      },
      publishedFormJson: {
        personal: { fullName: 'Live Person', professionalTitle: 'Wellness Coach' },
        center: { city: 'Chennai', locality: 'Kodambakkam' },
        mediaBrand: { websiteDisplayName: 'Live Name' },
        timings: {},
        services: {},
        goalsConsent: {},
      },
    });
    assert.equal(page.displayName, 'Live Name');
    assert.equal(page.fullName, 'Live Person');
  });
});
