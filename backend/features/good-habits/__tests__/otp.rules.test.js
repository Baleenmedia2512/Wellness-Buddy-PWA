import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DateTime } from 'luxon';
import {
  GOOD_HABIT_COACH_OTP_MIN_VERSION,
  requiresGoodHabitCoachOtp,
  goodHabitOtpRecipientKey,
  goodHabitOtpExpiryIst,
  goodHabitOtpExpiryUtcIso,
  goodHabitOtpExpiryLabelIst,
} from '../domain/otp.rules.js';
import {
  buildGoodHabitOtpEmail,
  buildGoodHabitOtpWhatsAppText,
  buildGoodHabitPhotoAttachment,
} from '../domain/otpEmail.rules.js';
import { IANA_IST } from '../../../shared/lib/datetime/index.js';

describe('requiresGoodHabitCoachOtp (§5.1)', () => {
  it('requires OTP for apps at or above min version', () => {
    assert.equal(GOOD_HABIT_COACH_OTP_MIN_VERSION, '3.5.6');
    assert.equal(requiresGoodHabitCoachOtp('3.5.6'), true);
    assert.equal(requiresGoodHabitCoachOtp('3.5.7'), true);
    assert.equal(requiresGoodHabitCoachOtp('4.0.0'), true);
  });

  it('keeps legacy immediate save for older / missing / invalid version', () => {
    assert.equal(requiresGoodHabitCoachOtp('3.5.5'), false);
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

describe('goodHabitOtp end-of-IST-day expiry', () => {
  it('expires at 23:59:59.999 IST on the send day (5pm IST example)', () => {
    // 2026-11-19 17:00 IST = 2026-11-19 11:30 UTC
    const sentAt = new Date('2026-11-19T11:30:00.000Z');
    assert.equal(goodHabitOtpExpiryIst(sentAt), '2026-11-19 23:59:59.999');

    const utcIso = goodHabitOtpExpiryUtcIso(sentAt);
    const endUtc = DateTime.fromISO(utcIso);
    assert.equal(endUtc.isValid, true);
    assert.equal(
      endUtc.setZone(IANA_IST).toFormat('yyyy-MM-dd HH:mm:ss.SSS'),
      '2026-11-19 23:59:59.999',
    );
    assert.match(goodHabitOtpExpiryLabelIst(sentAt), /11:59/i);
    assert.match(goodHabitOtpExpiryLabelIst(sentAt), /IST/);
  });

  it('rolls to the next IST calendar day after midnight IST', () => {
    // 2026-11-19 23:30 IST = 2026-11-19 18:00 UTC → still same IST day
    const beforeMidnight = new Date('2026-11-19T18:00:00.000Z');
    assert.equal(goodHabitOtpExpiryIst(beforeMidnight), '2026-11-19 23:59:59.999');

    // 2026-11-20 00:15 IST = 2026-11-19 18:45 UTC → next IST day
    const afterMidnight = new Date('2026-11-19T18:45:00.000Z');
    assert.equal(goodHabitOtpExpiryIst(afterMidnight), '2026-11-20 23:59:59.999');
  });
});

describe('buildGoodHabitOtpEmail', () => {
  it('includes OTP, member, photo cid, end-of-day copy, and WhatsApp share', () => {
    const mail = buildGoodHabitOtpEmail({
      otp: '4821',
      memberName: 'Avinash',
      memberPhone: '9876543210',
      coachName: 'Yasheer',
      expiresLabel: '19 Nov 2026, 11:59:59 PM IST',
    });
    assert.match(mail.subject, /Avinash/);
    assert.match(mail.text, /4821/);
    assert.match(mail.text, /11:59:59 PM IST/);
    assert.doesNotMatch(mail.text, /expires in \d+ minutes/i);
    assert.doesNotMatch(mail.text, /Logged at/);
    assert.match(mail.html, /cid:task-by-coach/);
    assert.match(mail.html, /4821/);
    assert.match(mail.html, /Share code on WhatsApp/);
    assert.match(mail.html, /wa\.me\/919876543210/);
    assert.match(mail.whatsappUrl, /919876543210/);
    assert.match(mail.whatsappUrl, /4821/);
  });

  it('still offers WhatsApp share without a phone (picker URL)', () => {
    const mail = buildGoodHabitOtpEmail({
      otp: '1234',
      memberName: 'Avinash',
      memberPhone: null,
    });
    assert.match(mail.html, /Share code on WhatsApp/);
    assert.match(mail.whatsappUrl, /api\.whatsapp\.com\/send/);
    assert.match(mail.whatsappUrl, /1234/);
  });
});

describe('buildGoodHabitOtpWhatsAppText', () => {
  it('prefills member chat message with the code', () => {
    assert.equal(
      buildGoodHabitOtpWhatsAppText({ otp: '4821', memberName: 'Avinash' }),
      'Hi Avinash, your Wellness Valley Task by Coach verification code is 4821.',
    );
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
