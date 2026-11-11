/**
 * Run: node --test frontend/src/features/wallet/domain/wallet.rules.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCashAddedMessage,
  extractWalletOtp,
  formatWalletAmount,
  interpolateWalletBalance,
  isValidWalletOtp,
  isWalletOtpLockedError,
  parseWalletAmount,
  resolveWalletRechargeGuide,
  WALLET_OTP_LOCKED_CODE,
} from './wallet.rules.js';

describe('wallet amount', () => {
  it('parses and formats rupees in Indian style without decimals', () => {
    assert.equal(parseWalletAmount('250'), 250);
    assert.equal(formatWalletAmount(250), '250');
    assert.equal(formatWalletAmount(200001), '2,00,001');
    assert.equal(formatWalletAmount(1000), '1,000');
    assert.equal(formatWalletAmount(99.6), '100');
    assert.equal(parseWalletAmount('0'), null);
  });

  it('interpolates Balance for the count-up animation', () => {
    assert.equal(interpolateWalletBalance(100, 108, 0), 100);
    assert.equal(interpolateWalletBalance(100, 108, 1), 108);
    assert.equal(interpolateWalletBalance(100, 108, 0.5), 107);
  });
});

describe('buildCashAddedMessage', () => {
  it('says successfully added with rupees', () => {
    assert.equal(buildCashAddedMessage(11), 'Successfully added ₹11');
    assert.equal(buildCashAddedMessage('11'), 'Successfully added ₹11');
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

describe('resolveWalletRechargeGuide', () => {
  it('walks amount → person → send → otp', () => {
    assert.equal(resolveWalletRechargeGuide({}).phase, 'amount');
    assert.equal(resolveWalletRechargeGuide({ amount: '50' }).phase, 'person');
    assert.equal(
      resolveWalletRechargeGuide({ amount: '50', selected: { userId: 1 } }).phase,
      'send',
    );
    assert.equal(resolveWalletRechargeGuide({ pending: { id: 9 } }).phase, 'otp');
    assert.equal(
      resolveWalletRechargeGuide({ pending: { id: 9 }, otpLocked: true }).phase,
      'locked',
    );
  });
});
