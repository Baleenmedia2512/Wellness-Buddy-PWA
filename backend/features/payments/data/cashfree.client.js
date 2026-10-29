/**
 * Cashfree Payment Gateway order create. Server only.
 * @param {{ apiBase: string, clientId: string, clientSecret: string, payload: object }} input
 */
export async function createCashfreeOrder({ apiBase, clientId, clientSecret, payload }) {
  const response = await fetch(`${apiBase}/pg/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-version': '2025-01-01',
      'x-client-id': clientId,
      'x-client-secret': clientSecret,
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
    const error = new Error('Cashfree could not start the payment');
    error.status = response.status >= 400 && response.status < 500 ? 422 : 502;
    throw error;
  }

  return {
    orderId: data.order_id || payload.order_id,
    paymentSessionId: data.payment_session_id,
  };
}
