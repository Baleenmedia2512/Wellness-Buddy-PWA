/**
 * Unit tests — height-change OTP email copy.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildHeightChangeOtpEmail } from '../domain/heightChangeOtpEmail.rules.js';

describe('buildHeightChangeOtpEmail', () => {
  it('includes code and new height', () => {
    const mail = buildHeightChangeOtpEmail({ otp: '4821', newHeightCm: 175 });
    assert.match(mail.subject, /height/i);
    assert.match(mail.text, /4821/);
    assert.match(mail.text, /175 cm/);
    assert.match(mail.html, /4821/);
    assert.match(mail.html, /175 cm/);
  });
});
