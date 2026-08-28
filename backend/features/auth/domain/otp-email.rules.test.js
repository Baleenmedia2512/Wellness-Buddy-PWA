/**
 * Run: node --test backend/features/auth/domain/otp-email.rules.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildSignInOtpEmail, buildSponsorOtpEmail } from './otp-email.rules.js';

function looksLikeSpamBait(s) {
  return /[\u{1F300}-\u{1FAFF}🔐🌿⏰🔒🤝]/u.test(s)
    || /otp/i.test(s)
    || /urgent|winner|free money/i.test(s)
    || /linear-gradient|dashed/i.test(s);
}

describe('buildSignInOtpEmail', () => {
  it('is plain transactional copy with matching text and html', () => {
    const mail = buildSignInOtpEmail('482193', { expiresMinutes: 5 });
    assert.equal(mail.subject, 'Wellness Valley sign-in code');
    assert.match(mail.text, /482193/);
    assert.match(mail.html, /482193/);
    assert.match(mail.text, /5 minutes/);
    assert.equal(looksLikeSpamBait(mail.subject), false);
    assert.equal(looksLikeSpamBait(mail.text), false);
    assert.equal(looksLikeSpamBait(mail.html), false);
  });
});

describe('buildSponsorOtpEmail', () => {
  it('is plain transactional copy without marketing markup', () => {
    const mail = buildSponsorOtpEmail({
      otp: '119900',
      memberName: 'Adithya',
      expiresHours: 24,
    });
    assert.equal(mail.subject, 'Wellness Valley team code');
    assert.match(mail.text, /Adithya/);
    assert.match(mail.text, /119900/);
    assert.match(mail.html, /119900/);
    assert.equal(looksLikeSpamBait(mail.subject), false);
    assert.equal(looksLikeSpamBait(mail.text), false);
    assert.equal(looksLikeSpamBait(mail.html), false);
  });
});
