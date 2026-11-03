/**
 * Run: node --test backend/features/wallet/__tests__/wallet.rules.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  canAttemptWalletOtp,
  formatWalletAmount,
  isValidWalletOtp,
  isWalletOtpExpired,
  parseWalletAmount,
  sanitizePeopleSearchQuery,
  toPublicCashRequest,
  uniqueWalletIdentity,
  wellnessValleyEmail,
  walletOtpExpiresAt,
  walletOtpLockedBody,
  WALLET_OTP_LOCKED_CODE,
  WALLET_OTP_MAX_ATTEMPTS,
  WALLET_OTP_MINUTES,
} from '../domain/wallet.rules.js';

describe('uniqueWalletIdentity', () => {
  it('gives each user one wallet identity from their user id', () => {
    assert.deepEqual(uniqueWalletIdentity(42), { userId: 42 });
    assert.deepEqual(uniqueWalletIdentity('42'), { userId: 42 });
    assert.equal(uniqueWalletIdentity(0), null);
    assert.equal(uniqueWalletIdentity('x'), null);
  });
});

describe('parseWalletAmount', () => {
  it('accepts rupees with two decimals', () => {
    assert.equal(parseWalletAmount('100'), 100);
    assert.equal(parseWalletAmount('99.5'), 99.5);
    assert.equal(parseWalletAmount(10.99), 10.99);
  });

  it('rejects empty, zero, negative, and huge amounts', () => {
    assert.equal(parseWalletAmount(''), null);
    assert.equal(parseWalletAmount('0'), null);
    assert.equal(parseWalletAmount(-1), null);
    assert.equal(parseWalletAmount('100000.01'), null);
  });
});

describe('wellnessValleyEmail', () => {
  it('accepts a profile email already stored in Wellness Valley', () => {
    assert.equal(wellnessValleyEmail('member@gmail.com'), 'member@gmail.com');
    assert.equal(wellnessValleyEmail('  a@b.co  '), 'a@b.co');
  });

  it('rejects missing or invalid emails', () => {
    assert.equal(wellnessValleyEmail(''), null);
    assert.equal(wellnessValleyEmail('not-an-email'), null);
    assert.equal(wellnessValleyEmail('name only'), null);
  });
});

describe('wallet OTP', () => {
  it('accepts a 4-digit code', () => {
    assert.equal(isValidWalletOtp('1234'), true);
    assert.equal(isValidWalletOtp('12'), false);
    assert.equal(isValidWalletOtp('abcd'), false);
  });

  it('expires after the configured minutes', () => {
    const now = new Date('2026-10-30T10:00:00.000Z');
    const expires = walletOtpExpiresAt(now);
    assert.equal(expires.getTime() - now.getTime(), WALLET_OTP_MINUTES * 60 * 1000);
    assert.equal(isWalletOtpExpired(expires, now), false);
    assert.equal(isWalletOtpExpired(expires, new Date(expires.getTime() + 1)), true);
  });

  it('stops attempts after the max', () => {
    assert.equal(canAttemptWalletOtp(0), true);
    assert.equal(canAttemptWalletOtp(WALLET_OTP_MAX_ATTEMPTS - 1), true);
    assert.equal(canAttemptWalletOtp(WALLET_OTP_MAX_ATTEMPTS), false);
  });

  it('returns a locked body after five failed attempts', () => {
    const body = walletOtpLockedBody();
    assert.equal(body.ok, false);
    assert.equal(body.error.code, WALLET_OTP_LOCKED_CODE);
    assert.match(body.error.message, /5 attempts used/);
  });
});

describe('toPublicCashRequest', () => {
  it('never includes the OTP hash', () => {
    const publicRequest = toPublicCashRequest({
      Id: 9,
      Amount: 50,
      ApproverId: 3,
      Status: 'pending',
      OtpHash: 'secret-hash',
      OtpExpiresAt: '2026-10-30T10:30:00.000Z',
      RequestedAt: '2026-10-30T10:00:00.000Z',
    }, {
      approverName: 'Priya',
      approverEmail: 'priya@gmail.com',
    });
    assert.equal(publicRequest.amountLabel, formatWalletAmount(50));
    assert.equal(publicRequest.approverName, 'Priya');
    assert.equal(publicRequest.emailSent, false);
    assert.equal('OtpHash' in publicRequest, false);
    assert.equal(JSON.stringify(publicRequest).includes('secret-hash'), false);
  });

  it('marks emailSent only after OtpSentAt is set', () => {
    const waiting = toPublicCashRequest({
      Id: 9,
      Amount: 50,
      ApproverId: 3,
      Status: 'pending',
      OtpExpiresAt: '2026-10-30T10:30:00.000Z',
      RequestedAt: '2026-10-30T10:00:00.000Z',
    });
    const sent = toPublicCashRequest({
      Id: 9,
      Amount: 50,
      ApproverId: 3,
      Status: 'pending',
      OtpSentAt: '2026-10-30T10:00:02.000Z',
      OtpExpiresAt: '2026-10-30T10:30:00.000Z',
      RequestedAt: '2026-10-30T10:00:00.000Z',
    });
    assert.equal(waiting.emailSent, false);
    assert.equal(sent.emailSent, true);
  });
});

describe('sanitizePeopleSearchQuery', () => {
  it('strips filter-breaking characters', () => {
    assert.equal(sanitizePeopleSearchQuery('  Priya, (A)_x  '), 'Priya A x');
  });
});
