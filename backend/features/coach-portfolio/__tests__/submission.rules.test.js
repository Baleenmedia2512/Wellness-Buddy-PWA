/**
 * Run: node --test backend/features/coach-portfolio/__tests__/submission.rules.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  coachCanEditSubmission,
  emptyPortfolioForm,
  formatClockTimeLabel,
  isAdminEditableStatus,
  normalizeClockTime,
  normalizeFormJson,
  SUBMISSION_STATUS,
  validateFormForSubmit,
} from '../domain/submission.rules.js';

describe('coach-portfolio submission.rules', () => {
  it('allows coach edit for any submission status (ongoing CMS)', () => {
    assert.equal(coachCanEditSubmission('draft'), true);
    assert.equal(coachCanEditSubmission('information_required'), true);
    assert.equal(coachCanEditSubmission('new'), true);
    assert.equal(coachCanEditSubmission('approved'), true);
    assert.equal(coachCanEditSubmission('completed'), true);
  });

  it('rejects incomplete submit payloads', () => {
    const errors = validateFormForSubmit(emptyPortfolioForm());
    assert.ok(errors.length >= 3);
    assert.ok(errors.some((e) => /Full name/i.test(e)));
  });

  function completeAbout(personal = {}) {
    return {
      fullName: 'A Coach',
      professionalTitle: 'Wellness Coach',
      yearsExperience: '5+ years coaching',
      background: 'I help families build daily habits',
      uniqueApproach: 'Small steps, clear accountability',
      qualifications: 'Certified wellness coach',
      languages: ['English'],
      ...personal,
    };
  }

  it('accepts a minimal complete submit payload (app-hydrated fields)', () => {
    const form = normalizeFormJson({
      personal: completeAbout(),
      center: {
        centerName: 'Valley Center',
        businessPhone: '9876543210',
      },
      mediaBrand: { websiteDisplayName: 'A Coach Wellness' },
      goalsConsent: { accuracyConfirmed: true, publishAuthorized: 'yes' },
    });
    assert.deepEqual(validateFormForSubmit(form, { hasClub: true }), []);
  });

  it('does not require club name when coach has no club', () => {
    const form = normalizeFormJson({
      personal: completeAbout(),
      center: { businessPhone: '9876543210' },
      mediaBrand: { websiteDisplayName: 'A Coach Wellness' },
      goalsConsent: { accuracyConfirmed: true, publishAuthorized: 'yes' },
    });
    assert.deepEqual(validateFormForSubmit(form, { hasClub: false }), []);
  });

  it('requires club name when coach has a club', () => {
    const form = normalizeFormJson({
      personal: completeAbout(),
      center: { businessPhone: '9876543210' },
      mediaBrand: { websiteDisplayName: 'A Coach Wellness' },
      goalsConsent: { accuracyConfirmed: true, publishAuthorized: 'yes' },
    });
    const errors = validateFormForSubmit(form, { hasClub: true });
    assert.ok(errors.some((e) => /Wellness center name/i.test(e)));
  });

  it('requires Profile-hydrated About fields for publish', () => {
    const form = normalizeFormJson({
      personal: { fullName: 'A Coach', professionalTitle: 'Wellness Coach' },
      center: { businessPhone: '9876543210' },
      mediaBrand: { websiteDisplayName: 'A Coach Wellness' },
      goalsConsent: { accuracyConfirmed: true, publishAuthorized: 'yes' },
    });
    const errors = validateFormForSubmit(form, { hasClub: false });
    assert.ok(errors.some((e) => /Years of experience/i.test(e)));
    assert.ok(errors.some((e) => /About me/i.test(e)));
    assert.ok(!errors.some((e) => /believe in/i.test(e)));
    assert.ok(!errors.some((e) => /Qualifications/i.test(e)));
    assert.ok(errors.some((e) => /Languages/i.test(e)));
  });

  it('defaults empty offerings to the 6 Wellness University programs', () => {
    const form = emptyPortfolioForm();
    assert.equal(form.services.offerings.length, 6);
    assert.ok(!form.services.offerings.some((o) => /extra income|product cost/i.test(o)));
  });

  it('lists admin-editable statuses', () => {
    assert.equal(isAdminEditableStatus(SUBMISSION_STATUS.NEW), true);
    assert.equal(isAdminEditableStatus(SUBMISSION_STATUS.DRAFT), false);
  });

  it('keeps only real HH:mm clock times (drops legacy AM/PM text)', () => {
    assert.equal(normalizeClockTime('09:30'), '09:30');
    assert.equal(normalizeClockTime('19:00:00'), '19:00');
    assert.equal(normalizeClockTime('07:00 AM'), '');
    assert.equal(normalizeClockTime('07:00 PM'), '');
    assert.equal(formatClockTimeLabel('09:30'), '09:30 AM');
    assert.equal(formatClockTimeLabel('19:00'), '07:00 PM');
    const form = normalizeFormJson({
      timings: { openingTime: '07:00 AM', closingTime: '07:00 PM' },
    });
    assert.equal(form.timings.openingTime, '');
    assert.equal(form.timings.closingTime, '');
  });
});
