/**
 * Unit tests — height-change OTP email copy.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildHeightChangeOtpEmail } from '../domain/heightChangeOtpEmail.rules.js';

describe('buildHeightChangeOtpEmail', () => {
  it('includes code and from → to height', () => {
    const mail = buildHeightChangeOtpEmail({
      otp: '4821',
      currentHeightCm: 178,
      newHeightCm: 180,
    });
    assert.match(mail.subject, /height/i);
    assert.match(mail.text, /4821/);
    assert.match(mail.text, /from 178 cm to 180 cm/);
    assert.match(mail.html, /4821/);
    assert.match(mail.html, /178 cm/);
    assert.match(mail.html, /180 cm/);
  });
});
