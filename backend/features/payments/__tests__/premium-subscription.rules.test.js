/**
 * Run: node --test backend/features/payments/__tests__/premium-subscription.rules.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  PREMIUM_PERIOD_DAYS,
  addPremiumCalendarDays,
  computeExtendedExpiresYmd,
  resolvePremiumMembership,
} from '../domain/premium-subscription.rules.js';

describe('premium subscription window', () => {
  it('adds 30 calendar days from the pay day', () => {
    assert.equal(addPremiumCalendarDays('2026-11-13', PREMIUM_PERIOD_DAYS), '2026-12-13');
  });

  it('starts a new window from today when expired or missing', () => {
    assert.equal(
      computeExtendedExpiresYmd({ currentExpiresYmd: null, todayYmd: '2026-11-13' }),
      '2026-12-13',
    );
    assert.equal(
      computeExtendedExpiresYmd({ currentExpiresYmd: '2026-11-01', todayYmd: '2026-11-13' }),
      '2026-12-13',
    );
  });

  it('extends from the current expiry when still active by clock', () => {
    assert.equal(
      computeExtendedExpiresYmd({
        currentExpiresYmd: '2026-12-13',
        currentExpiresMs: Date.parse('2026-12-13T10:00:00.000Z'),
        nowMs: Date.parse('2026-11-20T10:00:00.000Z'),
        todayYmd: '2026-11-20',
      }),
      '2027-01-12',
    );
  });

  it('starts from today when the clock has already passed expiry', () => {
    assert.equal(
      computeExtendedExpiresYmd({
        currentExpiresYmd: '2026-11-13',
        currentExpiresMs: Date.parse('2026-11-13T04:56:42.000Z'),
        nowMs: Date.parse('2026-11-13T10:42:00.000Z'),
        todayYmd: '2026-11-13',
      }),
      '2026-12-13',
    );
  });

  it('stays premium before the exact expiry instant', () => {
    assert.deepEqual(
      resolvePremiumMembership({
        expiresAtYmd: '2026-11-13',
        expiresAtMs: Date.parse('2026-11-13T04:56:42.000Z'),
        nowMs: Date.parse('2026-11-13T04:00:00.000Z'),
        todayYmd: '2026-11-13',
      }),
      {
        premium: true,
        daysLeft: 0,
        expiresAt: '2026-11-13',
        showExpiryWarning: true,
      },
    );
  });

  it('drops premium after the exact expiry instant even on the same day', () => {
    assert.deepEqual(
      resolvePremiumMembership({
        expiresAtYmd: '2026-11-13',
        expiresAtMs: Date.parse('2026-11-13T04:56:42.000Z'),
        nowMs: Date.parse('2026-11-13T10:42:00.000Z'),
        todayYmd: '2026-11-13',
      }),
      {
        premium: false,
        daysLeft: 0,
        expiresAt: '2026-11-13',
        showExpiryWarning: false,
      },
    );
  });

  it('warns when two or fewer days remain and still active', () => {
    assert.equal(
      resolvePremiumMembership({
        expiresAtYmd: '2026-12-13',
        expiresAtMs: Date.parse('2026-12-13T18:29:59.000Z'),
        nowMs: Date.parse('2026-12-11T10:00:00.000Z'),
        todayYmd: '2026-12-11',
      }).showExpiryWarning,
      true,
    );
    assert.equal(
      resolvePremiumMembership({
        expiresAtYmd: '2026-12-13',
        expiresAtMs: Date.parse('2026-12-13T18:29:59.000Z'),
        nowMs: Date.parse('2026-12-10T10:00:00.000Z'),
        todayYmd: '2026-12-10',
      }).daysLeft,
      3,
    );
  });
});
