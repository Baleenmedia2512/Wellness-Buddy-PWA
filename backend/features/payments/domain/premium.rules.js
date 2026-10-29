/**
 * Premium checkout rules. Pure: no env, clock, or network.
 * One Go Premium tap creates one Cashfree order at the server price.
 */

const ORDER_ID_MAX = 45;

/**
 * @param {unknown} raw
 * @returns {number|null}
 */
export function parsePremiumAmount(raw) {
  const amount = Number(raw);
  if (!Number.isFinite(amount)) return null;
  const rounded = Math.round(amount * 100) / 100;
  if (rounded < 1 || rounded > 100000) return null;
  return rounded;
}

/**
 * @param {unknown} envName
 * @returns {string}
 */
export function cashfreeApiBase(envName) {
  return String(envName || '').trim().toLowerCase() === 'production'
    ? 'https://api.cashfree.com'
    : 'https://sandbox.cashfree.com';
}

/**
 * @param {unknown} envName
 * @returns {'sandbox'|'production'}
 */
export function cashfreeCheckoutMode(envName) {
  return String(envName || '').trim().toLowerCase() === 'production'
    ? 'production'
    : 'sandbox';
}

/**
 * Cashfree customer_phone is a 10-digit Indian mobile number.
 * @param {unknown} raw
 * @returns {string|null}
 */
export function normalizeIndianPhone(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
  if (digits.length === 10) return digits;
  return null;
}

/**
 * @param {unknown} userId
 * @param {number} nowMs
 * @returns {string}
 */
export function buildPremiumOrderId(userId, nowMs) {
  const id = String(userId).replace(/\D/g, '') || '0';
  const stamp = Number(nowMs).toString(36);
  const orderId = `premium_${id}_${stamp}`.slice(0, ORDER_ID_MAX);
  return orderId;
}

/**
 * @param {unknown} raw
 * @returns {string|null}
 */
export function sanitizeReturnUrl(raw) {
  if (typeof raw !== 'string') return null;
  const value = raw.trim();
  if (!/^https?:\/\//i.test(value)) return null;
  if (value.length > 400) return null;
  let host = '';
  try {
    host = new URL(value).hostname.toLowerCase();
  } catch {
    return null;
  }
  if (host === 'localhost' || host === '127.0.0.1' || host === '[::1]') return null;
  return value;
}

/**
 * @param {{ userId: number|string, phone10: string, customerName?: string|null, amount: number, returnUrl?: string|null, nowMs: number }} input
 */
export function buildPremiumOrderPayload(input) {
  const name = String(input.customerName || '').trim().slice(0, 100);
  const payload = {
    order_amount: input.amount,
    order_currency: 'INR',
    order_id: buildPremiumOrderId(input.userId, input.nowMs),
    customer_details: {
      customer_id: `user_${input.userId}`,
      customer_phone: input.phone10,
    },
    order_note: 'Wellness Valley Premium',
  };
  if (name) payload.customer_details.customer_name = name;
  if (input.returnUrl) {
    payload.order_meta = { return_url: input.returnUrl };
  }
  return payload;
}
