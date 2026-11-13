/**
 * Run: node --test backend/features/payments/__tests__/premiumPricing.rules.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  PREMIUM_GST_RATE,
  applyPremiumGst,
  resolvePremiumQuote,
  listPremiumPayableTotals,
  isAllowedPremiumTotal,
  parsePremiumPricingFromEnv,
} from '../domain/premiumPricing.rules.js';

describe('applyPremiumGst', () => {
  it('adds 18% GST on the base', () => {
    assert.deepEqual(applyPremiumGst(199, PREMIUM_GST_RATE), {
      baseAmount: 199,
      gstAmount: 35.82,
      totalAmount: 234.82,
      gstRate: 0.18,
    });
    assert.equal(applyPremiumGst(999).totalAmount, 1178.82);
  });
});

describe('resolvePremiumQuote', () => {
  it('prices each Community Position', () => {
    assert.equal(resolvePremiumQuote('pc').totalAmount, 234.82);
    assert.equal(resolvePremiumQuote('ASSOCIATE').baseAmount, 199);
    assert.equal(resolvePremiumQuote('sv').baseAmount, 299);
    assert.equal(resolvePremiumQuote('WT').baseAmount, 499);
    assert.equal(resolvePremiumQuote('awt').baseAmount, 499);
    assert.equal(resolvePremiumQuote('GET').baseAmount, 699);
    assert.equal(resolvePremiumQuote('GET 2500').baseAmount, 699);
    assert.equal(resolvePremiumQuote('MILL').baseAmount, 899);
    assert.equal(resolvePremiumQuote('MILL 7500').baseAmount, 899);
    assert.equal(resolvePremiumQuote('GET TEAM').positionCode, 'GET');
    assert.equal(resolvePremiumQuote('2500 get team').positionCode, 'GET 2500');
    assert.equal(resolvePremiumQuote('MILL TEAM').positionCode, 'MILL');
    assert.equal(resolvePremiumQuote('PT').baseAmount, 999);
  });

  it('rejects missing or unknown levels', () => {
    assert.equal(resolvePremiumQuote(''), null);
    assert.equal(resolvePremiumQuote(null), null);
    assert.equal(resolvePremiumQuote('WORLD TEAM'), null);
  });
});

describe('listPremiumPayableTotals', () => {
  it('lists distinct GST totals used for confirm', () => {
    const totals = listPremiumPayableTotals();
    assert.ok(totals.includes(234.82));
    assert.ok(totals.includes(352.82));
    assert.ok(totals.includes(588.82));
    assert.ok(totals.includes(824.82));
    assert.ok(totals.includes(1060.82));
    assert.ok(totals.includes(1178.82));
    assert.equal(isAllowedPremiumTotal(234.82), true);
    assert.equal(isAllowedPremiumTotal(199), false);
  });
});

describe('parsePremiumPricingFromEnv', () => {
  it('keeps defaults when env is empty', () => {
    const pricing = parsePremiumPricingFromEnv({});
    assert.equal(pricing.gstRate, 0.18);
    assert.equal(pricing.bases.SV, 299);
  });

  it('overrides bases and GST from env without code changes', () => {
    const pricing = parsePremiumPricingFromEnv({
      PREMIUM_GST_RATE: '0.18',
      PREMIUM_LEVEL_BASES: JSON.stringify({ SV: 350, PT: 1200 }),
    });
    assert.equal(pricing.bases.SV, 350);
    assert.equal(pricing.bases.PT, 1200);
    assert.equal(pricing.bases.PC, 199);
    assert.equal(resolvePremiumQuote('SV', pricing).baseAmount, 350);
    assert.equal(resolvePremiumQuote('SV', pricing).totalAmount, 413);
  });

  it('ignores invalid JSON and keeps defaults', () => {
    const pricing = parsePremiumPricingFromEnv({
      PREMIUM_LEVEL_BASES: '{not-json',
      PREMIUM_GST_RATE: '2',
    });
    assert.equal(pricing.bases.SV, 299);
    assert.equal(pricing.gstRate, 0.18);
  });
});
