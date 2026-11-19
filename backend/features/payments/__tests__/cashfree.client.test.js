/**
 * Run: node --test backend/features/payments/__tests__/cashfree.client.test.js
 */
import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createCashfreeOrder } from '../data/cashfree.client.js';

const payload = {
  order_id: 'premium_1_test',
  order_amount: 199,
  order_currency: 'INR',
  customer_details: { customer_id: 'user_1', customer_phone: '9999999999' },
};

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

describe('createCashfreeOrder', () => {
  it('retries once after a Cashfree 504 and then succeeds', async () => {
    let attempts = 0;
    const fetchMock = mock.fn(async () => {
      attempts += 1;
      if (attempts === 1) {
        return jsonResponse(504, {});
      }
      return jsonResponse(200, {
        order_id: payload.order_id,
        payment_session_id: 'session_ok',
      });
    });
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchMock;
    try {
      const created = await createCashfreeOrder({
        apiBase: 'https://sandbox.cashfree.com',
        clientId: 'TEST',
        clientSecret: 'secret',
        payload,
      });
      assert.equal(created.paymentSessionId, 'session_ok');
      assert.equal(fetchMock.mock.calls.length, 2);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
