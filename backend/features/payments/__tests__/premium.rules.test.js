/**
 * Run: node --test backend/features/payments/__tests__/premium.rules.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parsePremiumAmount,
  cashfreeApiBase,
  cashfreeCheckoutMode,
  normalizeIndianPhone,
  buildPremiumOrderId,
  sanitizeReturnUrl,
  buildPremiumOrderPayload,
} from '../domain/premium.rules.js';

describe('parsePremiumAmount', () => {
  it('accepts a rupee amount with two decimals', () => {
    assert.equal(parsePremiumAmount('99'), 99);
    assert.equal(parsePremiumAmount('99.5'), 99.5);
  });

  it('rejects empty, zero, and huge amounts', () => {
    assert.equal(parsePremiumAmount(''), null);
    assert.equal(parsePremiumAmount('0'), null);
    assert.equal(parsePremiumAmount('100000.01'), null);
  });
});

describe('cashfree hosts', () => {
  it('uses the sandbox host unless production is set', () => {
    assert.equal(cashfreeApiBase('sandbox'), 'https://sandbox.cashfree.com');
    assert.equal(cashfreeApiBase(''), 'https://sandbox.cashfree.com');
    assert.equal(cashfreeApiBase('production'), 'https://api.cashfree.com');
    assert.equal(cashfreeCheckoutMode('production'), 'production');
    assert.equal(cashfreeCheckoutMode('sandbox'), 'sandbox');
  });
});

describe('normalizeIndianPhone', () => {
  it('keeps a 10-digit mobile and strips country or trunk prefixes', () => {
    assert.equal(normalizeIndianPhone('9876543210'), '9876543210');
    assert.equal(normalizeIndianPhone('+91 98765 43210'), '9876543210');
    assert.equal(normalizeIndianPhone('09876543210'), '9876543210');
  });

  it('rejects numbers that are not an Indian mobile', () => {
    assert.equal(normalizeIndianPhone('12345'), null);
    assert.equal(normalizeIndianPhone(''), null);
  });
});

describe('buildPremiumOrderPayload', () => {
  it('builds one order at the server amount without a client price', () => {
    const payload = buildPremiumOrderPayload({
      userId: 42,
      phone10: '9876543210',
      customerName: 'Asha',
      amount: 99,
      returnUrl: 'https://app.example/profile',
      nowMs: 1_700_000_000_000,
    });
    assert.equal(payload.order_amount, 99);
    assert.equal(payload.order_currency, 'INR');
    assert.equal(payload.customer_details.customer_phone, '9876543210');
    assert.equal(payload.customer_details.customer_id, 'user_42');
    assert.equal(payload.order_meta.return_url, 'https://app.example/profile');
    assert.equal(payload.order_id, buildPremiumOrderId(42, 1_700_000_000_000));
    assert.ok(payload.order_id.length <= 45);
  });

  it('drops a return url that is not http or https', () => {
    assert.equal(sanitizeReturnUrl('javascript:alert(1)'), null);
    assert.equal(sanitizeReturnUrl('http://localhost:3001/profile'), null);
    const payload = buildPremiumOrderPayload({
      userId: 7,
      phone10: '9876543210',
      amount: 99,
      returnUrl: null,
      nowMs: 10,
    });
    assert.equal(payload.order_meta, undefined);
  });
});
