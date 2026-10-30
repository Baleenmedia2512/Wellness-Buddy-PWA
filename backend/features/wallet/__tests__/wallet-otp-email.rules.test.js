/**
 * Run: node --test backend/features/wallet/__tests__/wallet-otp-email.rules.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildWalletCashOtpEmail } from '../domain/wallet-otp-email.rules.js';

describe('buildWalletCashOtpEmail', () => {
  it('uses the green template with only the simple four lines', () => {
    const mail = buildWalletCashOtpEmail({
      otp: '4321',
      requesterName: 'Ramesh',
      amountLabel: '250.00',
      expiresMinutes: 30,
    });
    assert.match(mail.subject, /Ramesh/);
    assert.equal(
      mail.text,
      [
        'Wellness Valley',
        '',
        'Ramesh wants to add ₹250.00 to their Wellness Valley wallet.',
        '',
        'Share this 4-digit code with them. It expires in 30 minutes.',
        '',
        'Approval code: 4321',
      ].join('\n'),
    );
    assert.match(mail.html, /Wellness Valley/);
    assert.match(mail.html, /Wallet approval code/);
    assert.match(mail.html, /Ramesh wants to add ₹250.00 to their Wellness Valley wallet/);
    assert.match(mail.html, /Share this 4-digit code with them. It expires in 30 minutes/);
    assert.match(mail.html, /Approval code/);
    assert.match(mail.html, /4 3 2 1/);
    assert.match(mail.html, /#15803d/);
    assert.equal(mail.html.includes('unique Wellness Valley wallet'), false);
    assert.equal(mail.html.includes('If you were not expecting this'), false);
    assert.equal(mail.html.includes('Add to my wallet'), false);
  });

  it('escapes HTML in names', () => {
    const mail = buildWalletCashOtpEmail({
      otp: '1111',
      requesterName: '<script>x</script>',
      amountLabel: '10.00',
    });
    assert.equal(mail.html.includes('<script>'), false);
    assert.match(mail.html, /&lt;script&gt;/);
  });
});
