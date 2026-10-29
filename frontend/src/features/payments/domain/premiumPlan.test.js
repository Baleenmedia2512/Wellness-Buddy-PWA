/**
 * Run: node --test frontend/src/features/payments/domain/premiumPlan.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PREMIUM_PLAN_AMOUNT, formatPremiumPlanAmount } from './premiumPlan.js';

describe('premium plan copy', () => {
  it('advertises 199 rupees', () => {
    assert.equal(PREMIUM_PLAN_AMOUNT, 199);
    assert.equal(formatPremiumPlanAmount(PREMIUM_PLAN_AMOUNT), '199');
  });
});
