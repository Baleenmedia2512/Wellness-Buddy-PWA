/**
 * Run: node --test frontend/src/features/wallet/domain/wallet.rules.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCashAddedMessage,
  extractWalletOtp,
  formatWalletAmount,
  isValidWalletOtp,
  isWalletOtpLockedError,
  parseWalletAmount,
  WALLET_OTP_LOCKED_CODE,
} from './wallet.rules.js';

describe('wallet amount', () => {
  it('parses and formats rupees', () => {
    assert.equal(parseWalletAmount('250'), 250);
    assert.equal(formatWalletAmount(250), '250.00');
    assert.equal(parseWalletAmount('0'), null);
  });
});

describe('buildCashAddedMessage', () => {
  it('says successfully added with rupees', () => {
    assert.equal(buildCashAddedMessage(11), 'Successfully added ₹11.00');
    assert.equal(buildCashAddedMessage('11'), 'Successfully added ₹11.00');
    assert.equal(buildCashAddedMessage(0), null);
  });
});

describe('isWalletOtpLockedError', () => {
  it('locks after five failed attempts', () => {
    assert.equal(isWalletOtpLockedError({ code: WALLET_OTP_LOCKED_CODE }), true);
    assert.equal(isWalletOtpLockedError({ message: '5 attempts used. Send a new request.' }), true);
    assert.equal(isWalletOtpLockedError({ message: 'Incorrect code. 4 attempts left.' }), false);
  });
});

describe('wallet OTP', () => {
  it('extracts a 4-digit code from paste text', () => {
    assert.equal(isValidWalletOtp('4321'), true);
    assert.equal(extractWalletOtp('Your OTP is 4321'), '4321');
    assert.equal(extractWalletOtp('12'), null);
  });
});
