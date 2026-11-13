/**
 * Run: node --test frontend/src/features/payments/domain/premiumExpiryBanner.rules.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildPremiumExpiryBannerLabel } from './premiumExpiryBanner.rules.js';

describe('premium expiry banner label', () => {
  it('includes days and time when both are present', () => {
    assert.equal(
      buildPremiumExpiryBannerLabel({
        daysLeft: 2,
        expiresAtDisplay: '15 Nov 2026, 4:56 AM',
      }),
      'Your current plan expires in 2 days (15 Nov 2026, 4:56 AM). Please recharge.',
    );
  });

  it('says today with time on the expiry day', () => {
    assert.equal(
      buildPremiumExpiryBannerLabel({
        daysLeft: 0,
        expiresAtDisplay: '13 Nov 2026, 4:56 AM',
      }),
      'Your current plan expires today (13 Nov 2026, 4:56 AM). Please recharge.',
    );
  });

  it('works without a time label', () => {
    assert.equal(
      buildPremiumExpiryBannerLabel({ daysLeft: 1 }),
      'Your current plan expires in 1 day. Please recharge.',
    );
  });
});
