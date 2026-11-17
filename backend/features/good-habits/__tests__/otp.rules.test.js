import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  GOOD_HABIT_COACH_OTP_MIN_VERSION,
  requiresGoodHabitCoachOtp,
  goodHabitOtpRecipientKey,
} from '../domain/otp.rules.js';
import {
  buildGoodHabitOtpEmail,
  buildGoodHabitPhotoAttachment,
} from '../domain/otpEmail.rules.js';

describe('requiresGoodHabitCoachOtp (§5.1)', () => {
  it('requires OTP for apps at or above min version', () => {
    assert.equal(GOOD_HABIT_COACH_OTP_MIN_VERSION, '3.5.7');
    assert.equal(requiresGoodHabitCoachOtp('3.5.7'), true);
    assert.equal(requiresGoodHabitCoachOtp('3.5.8'), true);
    assert.equal(requiresGoodHabitCoachOtp('4.0.0'), true);
  });

  it('keeps legacy immediate save for older / missing / invalid version', () => {
    assert.equal(requiresGoodHabitCoachOtp('3.5.6'), false);
    assert.equal(requiresGoodHabitCoachOtp('3.5.0'), false);
    assert.equal(requiresGoodHabitCoachOtp(null), false);
    assert.equal(requiresGoodHabitCoachOtp(undefined), false);
    assert.equal(requiresGoodHabitCoachOtp(''), false);
    assert.equal(requiresGoodHabitCoachOtp('not-a-version'), false);
  });

  it('builds a stable recipient key', () => {
    assert.equal(
      goodHabitOtpRecipientKey(1065, 'abc123'),
      'good-habit:1065:abc123',
    );
  });
});

describe('buildGoodHabitOtpEmail', () => {
  it('includes OTP, member, and photo cid in html', () => {
    const mail = buildGoodHabitOtpEmail({
      otp: '4821',
      memberName: 'Avinash',
      coachName: 'Yasheer',
      expiresMinutes: 20,
    });
    assert.match(mail.subject, /Avinash/);
    assert.match(mail.text, /4821/);
    assert.doesNotMatch(mail.text, /Logged at/);
    assert.match(mail.html, /cid:task-by-coach/);
    assert.match(mail.html, /4821/);
    assert.doesNotMatch(mail.html, /Logged at/);
  });
});

describe('buildGoodHabitPhotoAttachment', () => {
  it('builds an inline jpeg attachment from a data URL', () => {
    const tiny = Buffer.from([0xff, 0xd8, 0xff, 0xd9]).toString('base64');
    const att = buildGoodHabitPhotoAttachment(`data:image/jpeg;base64,${tiny}`);
    assert.ok(att);
    assert.equal(att.cid, 'task-by-coach');
    assert.equal(att.contentDisposition, 'inline');
    assert.equal(att.contentType, 'image/jpeg');
    assert.ok(Buffer.isBuffer(att.content));
  });

  it('returns null for empty input', () => {
    assert.equal(buildGoodHabitPhotoAttachment(''), null);
    assert.equal(buildGoodHabitPhotoAttachment(null), null);
  });
});
