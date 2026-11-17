/**
 * Run: node --test frontend/src/features/user/domain/loginOtpChallenge.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  LOGIN_OTP_CHALLENGE_KEY,
  LOGIN_OTP_CHALLENGE_TTL_MS,
  clearLoginOtpChallenge,
  loadLoginOtpChallenge,
  normalizeLoginOtpChallenge,
  saveLoginOtpChallenge,
} from './loginOtpChallenge.js';

function memoryStorage(seed = {}) {
  const map = new Map(Object.entries(seed));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: (k) => { map.delete(k); },
  };
}

describe('normalizeLoginOtpChallenge', () => {
  it('keeps a fresh phone challenge', () => {
    const now = 1_700_000_000_000;
    const out = normalizeLoginOtpChallenge({
      email: '9876543210',
      countryDial: '+91',
      phoneRecipient: '+919876543210',
      termsAccepted: true,
      sentAt: now - 60_000,
    }, now);
    assert.equal(out?.phoneRecipient, '+919876543210');
    assert.equal(out?.termsAccepted, true);
    assert.equal(out?.activeChannel, 'phone');
  });

  it('drops expired challenges past OTP TTL', () => {
    const now = 1_700_000_000_000;
    const out = normalizeLoginOtpChallenge({
      email: '9876543210',
      countryDial: '+91',
      phoneRecipient: '+919876543210',
      sentAt: now - LOGIN_OTP_CHALLENGE_TTL_MS - 1,
    }, now);
    assert.equal(out, null);
  });
});

describe('save / load / clear login OTP challenge', () => {
  it('round-trips through storage so mobile-web reload can restore Enter OTP', () => {
    const storage = memoryStorage();
    const now = 1_700_000_000_000;
    saveLoginOtpChallenge({
      email: '9876543210',
      countryDial: '+91',
      phoneRecipient: '+919876543210',
      termsAccepted: true,
      sentAt: now,
    }, storage);

    const loaded = loadLoginOtpChallenge(storage, now + 1_000);
    assert.equal(loaded?.email, '9876543210');
    assert.equal(loaded?.phoneRecipient, '+919876543210');
    assert.equal(storage.getItem(LOGIN_OTP_CHALLENGE_KEY) != null, true);

    clearLoginOtpChallenge(storage);
    assert.equal(loadLoginOtpChallenge(storage, now), null);
  });

  it('clears corrupt storage instead of crashing', () => {
    const storage = memoryStorage({ [LOGIN_OTP_CHALLENGE_KEY]: '{not-json' });
    assert.equal(loadLoginOtpChallenge(storage), null);
    assert.equal(storage.getItem(LOGIN_OTP_CHALLENGE_KEY), null);
  });
});
