/**
 * Run: node --test backend/features/coach-portfolio/__tests__/publishOtpEmail.rules.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPublishEmailSummary,
  buildPublishOtpEmail,
} from '../domain/publishOtpEmail.rules.js';

describe('coach-portfolio publishOtpEmail.rules', () => {
  const form = {
    personal: {
      fullName: 'System Nitheesh',
      professionalTitle: 'Wellness Coach',
      profilePhoto: 'https://example.com/p.jpg',
    },
    center: {
      centerName: 'Wellness Valley Center',
      city: 'Chennai',
      locality: 'Kodambakkam',
      businessPhone: '9876543210',
      whatsapp: '9876543210',
    },
    timings: {
      workingDays: ['Mon', 'Tue', 'Wed'],
      openingTime: '07:00',
      closingTime: '20:00',
    },
    services: {
      offerings: ['Weight Management', 'Nutrition Coaching'],
    },
    mediaBrand: {
      websiteDisplayName: 'System',
      interiorPhotos: ['a', 'b', 'c'],
      activityPhotos: [],
      introVideoLink: 'https://example.com/v',
    },
  };

  it('builds a neat public path preview and summary fields', () => {
    const summary = buildPublishEmailSummary(form, { userId: 1 });
    assert.equal(summary.publicPath, '/coach/chennai/kodambakkam/system');
    assert.equal(summary.displayName, 'System');
    assert.equal(summary.media.interiorCount, 3);
    assert.equal(summary.media.introVideo, true);
    assert.equal(summary.offerings, undefined);
  });

  it('does not include default offerings / programs in the email body', () => {
    const mail = buildPublishOtpEmail({
      otp: '5650',
      form,
      userId: 1,
      userName: 'System Nitheesh',
    });
    assert.doesNotMatch(mail.html, /Offerings/i);
    assert.doesNotMatch(mail.html, /Weight Management/);
    assert.doesNotMatch(mail.text, /Offerings:/i);
    assert.doesNotMatch(mail.text, /default program/i);
  });

  it('builds HTML email with OTP box, path, and escaped coach name', () => {
    const mail = buildPublishOtpEmail({
      otp: '5650',
      form,
      userId: 1,
      userName: 'System Nitheesh',
    });
    assert.equal(mail.subject, 'Coach website publish - verification required');
    assert.match(mail.html, /Coach Website Publish - Verification Required/);
    assert.match(mail.html, /\/coach\/chennai\/kodambakkam\/system/);
    assert.match(mail.html, /5 6 5 0/);
    assert.match(mail.html, /Valid for 24 hours/);
    assert.match(mail.html, /Share code on WhatsApp/);
    assert.ok(mail.whatsappUrl.includes('api.whatsapp.com') || mail.whatsappUrl.includes('wa.me'));
    assert.match(mail.html, /System Nitheesh/);
    assert.match(mail.text, /Verification OTP: 5 6 5 0/);
    assert.doesNotMatch(mail.html, /<script/i);
  });

  it('builds coach-approval copy asking coach to share OTP with member', () => {
    const mail = buildPublishOtpEmail({
      otp: '5650',
      form,
      userId: 1,
      userName: 'System Nitheesh',
      forCoachApproval: true,
      coachName: 'Coach Priya',
      memberName: 'System Nitheesh',
      centerName: 'Kodambakkam Center',
    });
    assert.match(mail.subject, /System Nitheesh - website publish verification/);
    assert.match(mail.html, /requested to publish a website/);
    assert.match(mail.html, /Share the OTP with/);
    assert.match(mail.html, /Kodambakkam Center/);
    assert.match(mail.text, /Share the OTP with System Nitheesh if approved/);

    const mailWithMemberPhone = buildPublishOtpEmail({
      otp: '5650',
      form,
      userId: 1,
      userName: 'System Nitheesh',
      forCoachApproval: true,
      coachName: 'Coach Priya',
      memberName: 'System Nitheesh',
      memberPhone: '7695834209',
      centerName: 'Kodambakkam Center',
    });
    assert.match(mailWithMemberPhone.whatsappUrl, /^https:\/\/wa\.me\/917695834209\?text=/);
  });

  it('escapes HTML in coach-provided fields', () => {
    const mail = buildPublishOtpEmail({
      otp: '1234',
      form: {
        ...form,
        personal: {
          ...form.personal,
          fullName: '<script>alert(1)</script>',
        },
        mediaBrand: {
          ...form.mediaBrand,
          websiteDisplayName: 'Safe Name',
        },
      },
      userId: 9,
    });
    assert.doesNotMatch(mail.html, /<script>alert/);
    assert.match(mail.html, /&lt;script&gt;/);
  });
});
