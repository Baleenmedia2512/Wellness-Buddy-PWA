/**
 * Run: node --test frontend/src/features/payments/domain/pendingPremiumOrder.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  PENDING_PREMIUM_ORDER_TTL_MS,
  parsePendingPremiumOrder,
  shouldKeepPendingPremiumOrder,
} from './pendingPremiumOrder.js';

const NOW = 1_800_000_000_000;

describe('parsePendingPremiumOrder', () => {
  it('reads a fresh pending order', () => {
    const raw = JSON.stringify({ userId: 42, orderId: 'premium_42_abc', startedAt: NOW - 1000 });
    assert.deepEqual(parsePendingPremiumOrder(raw, NOW), {
      userId: '42',
      orderId: 'premium_42_abc',
      startedAt: NOW - 1000,
    });
  });

  it('drops an order older than a day', () => {
    const raw = JSON.stringify({
      userId: 42,
      orderId: 'premium_42_abc',
      startedAt: NOW - PENDING_PREMIUM_ORDER_TTL_MS - 1,
    });
    assert.equal(parsePendingPremiumOrder(raw, NOW), null);
  });

  it('drops broken or empty storage', () => {
    assert.equal(parsePendingPremiumOrder('', NOW), null);
    assert.equal(parsePendingPremiumOrder('{nope', NOW), null);
    assert.equal(parsePendingPremiumOrder(null, NOW), null);
    assert.equal(parsePendingPremiumOrder(JSON.stringify({ userId: 1 }), NOW), null);
  });
});

describe('shouldKeepPendingPremiumOrder', () => {
  it('keeps checking only while Cashfree is still waiting for payment', () => {
    assert.equal(shouldKeepPendingPremiumOrder({ premium: false, status: 'ACTIVE' }), true);
    assert.equal(shouldKeepPendingPremiumOrder({ premium: false, status: 'EXPIRED' }), false);
    assert.equal(shouldKeepPendingPremiumOrder({ premium: false, status: 'PAID' }), false);
    assert.equal(shouldKeepPendingPremiumOrder({ premium: true, status: 'PAID' }), false);
  });
});
