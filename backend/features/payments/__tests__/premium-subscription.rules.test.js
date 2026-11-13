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

  it('extends from the current expiry when still active', () => {
    assert.equal(
      computeExtendedExpiresYmd({ currentExpiresYmd: '2026-12-13', todayYmd: '2026-11-20' }),
      '2027-01-12',
    );
  });

  it('treats the expiry day as still premium', () => {
    assert.deepEqual(
      resolvePremiumMembership({ expiresAtYmd: '2026-12-13', todayYmd: '2026-12-13' }),
      {
        premium: true,
        daysLeft: 0,
        expiresAt: '2026-12-13',
        showExpiryWarning: true,
      },
    );
  });

  it('drops to normal the day after expiry', () => {
    assert.deepEqual(
      resolvePremiumMembership({ expiresAtYmd: '2026-12-13', todayYmd: '2026-12-14' }),
      {
        premium: false,
        daysLeft: 0,
        expiresAt: '2026-12-13',
        showExpiryWarning: false,
      },
    );
  });

  it('warns when two or fewer days remain', () => {
    assert.equal(
      resolvePremiumMembership({ expiresAtYmd: '2026-12-13', todayYmd: '2026-12-11' }).showExpiryWarning,
      true,
    );
    assert.equal(
      resolvePremiumMembership({ expiresAtYmd: '2026-12-13', todayYmd: '2026-12-10' }).showExpiryWarning,
      false,
    );
    assert.equal(
      resolvePremiumMembership({ expiresAtYmd: '2026-12-13', todayYmd: '2026-12-10' }).daysLeft,
      3,
    );
  });
});
