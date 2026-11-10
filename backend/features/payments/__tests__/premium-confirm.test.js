/**
 * Run: node --test backend/features/payments/__tests__/premium-confirm.test.js
 */
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  parsePremiumOrderUserId,
  isPremiumOrderPaid,
} from '../domain/premium-confirm.rules.js';
import { confirmPremiumOrder, getPremiumStatus } from '../api/confirm-order.handler.js';

const paidOrder = (overrides = {}) => ({
  order_id: 'premium_42_abc123',
  order_status: 'PAID',
  order_amount: 199,
  customer_details: { customer_id: 'user_42' },
  ...overrides,
});

describe('parsePremiumOrderUserId', () => {
  it('reads the member id from a Premium order id', () => {
    assert.equal(parsePremiumOrderUserId('premium_42_abc123'), 42);
  });
  it('rejects anything that is not a Premium order id', () => {
    assert.equal(parsePremiumOrderUserId('order_42_abc'), null);
    assert.equal(parsePremiumOrderUserId('premium_x_abc'), null);
    assert.equal(parsePremiumOrderUserId('premium_0_abc'), null);
    assert.equal(parsePremiumOrderUserId(''), null);
    assert.equal(parsePremiumOrderUserId(null), null);
  });
});

describe('isPremiumOrderPaid', () => {
  const expected = { userId: 42, amount: 199 };
  it('accepts a PAID order for this member at the Premium price', () => {
    assert.equal(isPremiumOrderPaid(paidOrder(), expected), true);
  });
  it('rejects orders that are not PAID', () => {
    assert.equal(isPremiumOrderPaid(paidOrder({ order_status: 'ACTIVE' }), expected), false);
    assert.equal(isPremiumOrderPaid(paidOrder({ order_status: 'EXPIRED' }), expected), false);
  });
  it('rejects another member or a short payment', () => {
    assert.equal(isPremiumOrderPaid(paidOrder({ customer_details: { customer_id: 'user_7' } }), expected), false);
    assert.equal(isPremiumOrderPaid(paidOrder({ order_id: 'premium_7_abc123' }), expected), false);
    assert.equal(isPremiumOrderPaid(paidOrder({ order_amount: 1 }), expected), false);
  });
});

describe('confirmPremiumOrder', () => {
  beforeEach(() => {
    process.env.CASHFREE_CLIENT_ID = 'TEST_ID';
    process.env.CASHFREE_CLIENT_SECRET = 'test_secret';
    process.env.CASHFREE_ENV = 'sandbox';
    process.env.CASHFREE_ORDER_AMOUNT = '199';
  });

  it('saves a confirmed payment and says premium', async () => {
    const saved = [];
    const result = await confirmPremiumOrder(
      { userId: 42, orderId: 'premium_42_abc123' },
      { fetchOrder: async () => paidOrder(), record: async (row) => { saved.push(row); } },
    );
    assert.equal(result.body.data.premium, true);
    assert.deepEqual(saved, [{ orderId: 'premium_42_abc123', userId: 42, amount: 199, mode: 'sandbox' }]);
  });

  it('does not save an order that is still unpaid', async () => {
    const saved = [];
    const result = await confirmPremiumOrder(
      { userId: 42, orderId: 'premium_42_abc123' },
      {
        fetchOrder: async () => paidOrder({ order_status: 'ACTIVE' }),
        record: async (row) => { saved.push(row); },
      },
    );
    assert.equal(result.body.data.premium, false);
    assert.equal(result.body.data.status, 'ACTIVE');
    assert.equal(saved.length, 0);
  });

  it('rejects an order id that belongs to another member', async () => {
    await assert.rejects(
      confirmPremiumOrder(
        { userId: 42, orderId: 'premium_7_abc123' },
        { fetchOrder: async () => paidOrder(), record: async () => {} },
      ),
      (error) => error.status === 400,
    );
  });

  it('records production payments with production mode', async () => {
    process.env.CASHFREE_ENV = 'production';
    const saved = [];
    await confirmPremiumOrder(
      { userId: 42, orderId: 'premium_42_abc123' },
      { fetchOrder: async () => paidOrder(), record: async (row) => { saved.push(row); } },
    );
    assert.equal(saved[0].mode, 'production');
  });
});

describe('getPremiumStatus', () => {
  it('returns premium true for a paid member', async () => {
    const result = await getPremiumStatus({ userId: 42 }, { hasPaid: async () => true });
    assert.equal(result.body.data.premium, true);
  });

  it('asks for the current Cashfree mode so sandbox tests never count on live', async () => {
    process.env.CASHFREE_ENV = 'production';
    let asked = null;
    await getPremiumStatus({ userId: 42 }, { hasPaid: async (args) => { asked = args; return false; } });
    assert.deepEqual(asked, { userId: 42, mode: 'production' });
  });

  it('answers not premium when the lookup fails instead of breaking the profile', async () => {
    const result = await getPremiumStatus({ userId: 42 }, {
      hasPaid: async () => { throw new Error('db down'); },
    });
    assert.equal(result.httpStatus, 200);
    assert.equal(result.body.data.premium, false);
  });

  it('requires a user id', async () => {
    await assert.rejects(getPremiumStatus({ userId: '' }), (error) => error.status === 400);
  });
});
