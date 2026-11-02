/**
 * Cashfree Payment Gateway order create. Server only.
 */
import logger from '../../../shared/lib/logger.js';

function cashfreeError(response, data) {
  const detail = String(data.message || '').trim().slice(0, 180);
  const timedOut = response.status === 504;
  const error = new Error(
    detail || (timedOut
      ? 'Cashfree timed out. Try Pay Now again.'
      : 'Cashfree could not start the payment'),
  );
  error.status = response.status >= 400 && response.status < 500 ? 422 : 502;
  error.cashfreeStatus = response.status;
  return error;
}

async function postCreateOrder({ apiBase, clientId, clientSecret, payload }) {
  const response = await fetch(`${apiBase}/pg/orders`, {
    method: 'POST',
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'x-api-version': '2025-01-01',
      'x-client-id': clientId,
      'x-client-secret': clientSecret,
      'x-idempotency-key': String(payload.order_id || ''),
    },
    body: JSON.stringify(payload),
  });

  let data = {};
  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok || !data.payment_session_id) {
    logger.warn('Cashfree order create failed', {
      status: response.status,
      code: data.code || null,
      message: data.message || null,
    });
    throw cashfreeError(response, data);
  }

  return {
    orderId: data.order_id || payload.order_id,
    paymentSessionId: data.payment_session_id,
  };
}

/**
 * Read one order back from Cashfree so payment is confirmed server to server.
 * @param {{ apiBase: string, clientId: string, clientSecret: string, orderId: string }} input
 * @returns {Promise<object>} Cashfree order body
 */
export async function fetchCashfreeOrder({ apiBase, clientId, clientSecret, orderId }) {
  const response = await fetch(`${apiBase}/pg/orders/${encodeURIComponent(orderId)}`, {
    method: 'GET',
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      'x-api-version': '2025-01-01',
      'x-client-id': clientId,
      'x-client-secret': clientSecret,
    },
  });

  let data = {};
  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    logger.warn('Cashfree order read failed', {
      status: response.status,
      code: data.code || null,
      message: data.message || null,
    });
    const error = new Error(
      response.status === 404
        ? 'Payment order not found'
        : 'Cashfree could not confirm the payment',
    );
    error.status = response.status >= 400 && response.status < 500 ? 422 : 502;
    throw error;
  }

  return data;
}

/**
 * @param {{ apiBase: string, clientId: string, clientSecret: string, payload: object }} input
 */
export async function createCashfreeOrder(input) {
  try {
    return await postCreateOrder(input);
  } catch (error) {
    if (error?.cashfreeStatus !== 504) throw error;
    logger.warn('Cashfree order create retrying after timeout');
    return postCreateOrder(input);
  }
}
