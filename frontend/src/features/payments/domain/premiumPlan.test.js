/**
 * Run: node --test frontend/src/features/payments/domain/premiumPlan.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatPremiumPlanAmount,
  normalizePremiumQuote,
} from './premiumPlan.js';

describe('premium plan display helpers', () => {
  it('formats rupee amounts rounded off without decimals', () => {
    assert.equal(formatPremiumPlanAmount(199), '199');
    assert.equal(formatPremiumPlanAmount(234.82), '235');
    assert.equal(formatPremiumPlanAmount(352.82), '353');
  });

  it('normalizes a server quote and rounds off amounts', () => {
    assert.deepEqual(
      normalizePremiumQuote({
        positionCode: 'SV',
        baseAmount: 299,
        gstAmount: 53.82,
        gstRate: 0.18,
        amount: 352.82,
      }),
      {
        positionCode: 'SV',
        baseAmount: 299,
        gstAmount: 54,
        gstRate: 0.18,
        amount: 353,
      },
    );
    assert.equal(normalizePremiumQuote(null), null);
  });
});
