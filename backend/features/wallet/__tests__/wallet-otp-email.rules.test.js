/**
 * Run: node --test backend/features/wallet/__tests__/wallet-otp-email.rules.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildWalletCashOtpEmail,
  buildWalletOtpWhatsAppUrl,
  normalizeWhatsAppPhone,
} from '../domain/wallet-otp-email.rules.js';

describe('normalizeWhatsAppPhone', () => {
  it('normalises India 10-digit numbers for wa.me', () => {
    assert.equal(normalizeWhatsAppPhone('9876543210'), '919876543210');
    assert.equal(normalizeWhatsAppPhone('+91 98765 43210'), '919876543210');
    assert.equal(normalizeWhatsAppPhone('09876543210'), '919876543210');
    assert.equal(normalizeWhatsAppPhone(''), null);
    assert.equal(normalizeWhatsAppPhone('123'), null);
  });
});

describe('buildWalletOtpWhatsAppUrl', () => {
  it('builds a chat link with prefilled OTP text', () => {
    const url = buildWalletOtpWhatsAppUrl({
      phone: '9876543210',
      otp: '4321',
      amountLabel: '250',
      requesterName: 'Ramesh',
    });
    assert.match(url, /^https:\/\/wa\.me\/919876543210\?text=/);
    const text = decodeURIComponent(url.split('text=')[1]);
    assert.match(text, /4321/);
    assert.match(text, /Ramesh/);
    assert.match(text, /250/);
  });

  it('returns null when phone is missing', () => {
    assert.equal(
      buildWalletOtpWhatsAppUrl({ phone: '', otp: '4321', amountLabel: '10' }),
      null,
    );
  });
});

describe('buildWalletCashOtpEmail', () => {
  it('uses a neat green template with clear payment copy and no time expiry', () => {
    const mail = buildWalletCashOtpEmail({
      otp: '4321',
      requesterName: 'Ramesh',
      amountLabel: '2,00,001',
    });
    assert.match(mail.subject, /Ramesh/);
    assert.equal(
      mail.text,
      [
        'Wellness Valley',
        '',
        'Ramesh has paid you the amount below by CASH, UPI, or CARD.',
        'If this is correct, please share the approval code below with them.',
        '',
        'Amount: ₹2,00,001',
        '',
        'Approval code: 4321',
      ].join('\n'),
    );
    assert.match(mail.html, /Wellness Valley/);
    assert.match(mail.html, /Wallet approval code/);
    assert.match(mail.html, /Ramesh/);
    assert.match(mail.html, /has paid you the amount below by CASH, UPI, or CARD/);
    assert.match(mail.html, /If this is correct, please share the approval code below with them/);
    assert.match(mail.html, /Approval code/);
    assert.match(mail.html, /4 3 2 1/);
    assert.match(mail.html, /#15803d/);
    assert.equal(mail.html.includes('Share code on WhatsApp'), false);
    assert.equal(mail.html.includes('expires'), false);
    assert.equal(mail.text.includes('expires'), false);
    assert.equal(mail.html.includes('unique Wellness Valley wallet'), false);
    assert.equal(mail.html.includes('If you were not expecting this'), false);
    assert.equal(mail.html.includes('Add to my wallet'), false);
  });

  it('adds a WhatsApp button when the requester has a phone number', () => {
    const mail = buildWalletCashOtpEmail({
      otp: '7930',
      requesterName: 'Ramesh',
      amountLabel: '200',
      requesterPhone: '9876543210',
    });
    assert.match(mail.html, /Share code on WhatsApp/);
    assert.match(mail.html, /https:\/\/wa\.me\/919876543210\?text=/);
    assert.match(mail.text, /Share on WhatsApp: https:\/\/wa\.me\/919876543210\?text=/);
    assert.match(mail.whatsappUrl, /7930/);
  });

  it('escapes HTML in names', () => {
    const mail = buildWalletCashOtpEmail({
      otp: '1111',
      requesterName: '<script>x</script>',
      amountLabel: '10',
    });
    assert.equal(mail.html.includes('<script>'), false);
    assert.match(mail.html, /&lt;script&gt;/);
  });
});
