/**
 * Run: node --test backend/shared/lib/__tests__/smtp-mail.test.js
 */
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTransactionalMail,
  listSmtpTransportAttempts,
  smtpCredentials,
  smtpFromAddress,
} from '../smtp-mail.js';

const KEYS = ['SMTP_USER', 'SMTP_PASS', 'SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE'];

describe('smtp-mail transports', () => {
  const saved = {};

  beforeEach(() => {
    for (const key of KEYS) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  it('strips spaces from Gmail app passwords', () => {
    process.env.SMTP_USER = '  coach@gmail.com  ';
    process.env.SMTP_PASS = 'abcd efgh ijkl mnop';
    assert.deepEqual(smtpCredentials(), {
      user: 'coach@gmail.com',
      pass: 'abcdefghijklmnop',
    });
  });

  it('uses Gmail service first when SMTP_HOST is unset (local path)', () => {
    process.env.SMTP_USER = 'coach@gmail.com';
    process.env.SMTP_PASS = 'secret';
    const attempts = listSmtpTransportAttempts();
    assert.equal(attempts[0].name, 'gmail-service');
    assert.equal(attempts[0].options.service, 'gmail');
    assert.equal(attempts[1].name, 'gmail-587');
    assert.equal(attempts[1].options.host, 'smtp.gmail.com');
    assert.equal(attempts[1].options.port, 587);
    assert.equal(attempts[1].options.secure, false);
  });

  it('uses SMTP_HOST only when set (no Gmail retry list)', () => {
    process.env.SMTP_USER = 'mail@wellnessvalley.in';
    process.env.SMTP_PASS = 'secret';
    process.env.SMTP_HOST = 'mail.wellnessvalley.in';
    process.env.SMTP_PORT = '465';
    const attempts = listSmtpTransportAttempts();
    assert.equal(attempts.length, 1);
    assert.equal(attempts[0].name, 'custom');
    assert.equal(attempts[0].options.host, 'mail.wellnessvalley.in');
    assert.equal(attempts[0].options.port, 465);
    assert.equal(attempts[0].options.secure, true);
  });

  it('from address matches SMTP_USER', () => {
    process.env.SMTP_USER = 'coach@gmail.com';
    assert.equal(smtpFromAddress(), '"Wellness Valley" <coach@gmail.com>');
  });

  it('omits attachments when OTP callers pass none (local signup path)', () => {
    process.env.SMTP_USER = 'coach@gmail.com';
    const mail = buildTransactionalMail({
      to: 'sponsor@example.com',
      subject: 'OTP',
      text: '1234',
    });
    assert.equal(mail.from, '"Wellness Valley" <coach@gmail.com>');
    assert.equal(mail.text, '1234');
    assert.equal(mail.attachments, undefined);
  });

  it('includes attachments for Transformation coach email', () => {
    process.env.SMTP_USER = 'noreply@wellnessvalley.in';
    const attachments = [{ filename: 'before.jpg', content: Buffer.from('x') }];
    const mail = buildTransactionalMail({
      to: 'coach@example.com',
      subject: 'Approve',
      text: 'otp',
      html: '<p>otp</p>',
      attachments,
    });
    assert.equal(mail.from, '"Wellness Valley" <noreply@wellnessvalley.in>');
    assert.equal(mail.attachments, attachments);
  });
});
