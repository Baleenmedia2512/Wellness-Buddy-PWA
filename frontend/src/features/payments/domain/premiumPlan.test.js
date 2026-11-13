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
  it('formats rupee amounts', () => {
    assert.equal(formatPremiumPlanAmount(199), '199');
    assert.equal(formatPremiumPlanAmount(234.82), '234.82');
  });

  it('normalizes a server quote', () => {
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
        gstAmount: 53.82,
        gstRate: 0.18,
        amount: 352.82,
      },
    );
    assert.equal(normalizePremiumQuote(null), null);
  });
});
