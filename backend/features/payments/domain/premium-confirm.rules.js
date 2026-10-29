/**
 * Rules for deciding that a Premium Cashfree order is really paid.
 * Pure: no env, clock, or network.
 */

const ORDER_ID_PATTERN = /^premium_(\d+)_[a-z0-9]+$/;

/**
 * Premium order ids are `premium_<userId>_<stamp>` (see buildPremiumOrderId).
 * @param {unknown} orderId
 * @returns {number|null}
 */
export function parsePremiumOrderUserId(orderId) {
  const match = ORDER_ID_PATTERN.exec(String(orderId || ''));
  if (!match) return null;
  const userId = Number(match[1]);
  return Number.isSafeInteger(userId) && userId > 0 ? userId : null;
}

/**
 * @param {unknown} order Cashfree GET /pg/orders/{id} body
 * @returns {string}
 */
export function cashfreeOrderStatus(order) {
  return String(order?.order_status || '').trim().toUpperCase();
}

/**
 * True only when Cashfree says PAID, the order belongs to this member,
 * and at least the current Premium price was paid.
 * @param {unknown} order Cashfree order body
 * @param {{ userId: number, amount: number }} expected
 * @returns {boolean}
 */
export function isPremiumOrderPaid(order, expected) {
  if (!order || typeof order !== 'object') return false;
  if (cashfreeOrderStatus(order) !== 'PAID') return false;
  if (parsePremiumOrderUserId(order.order_id) !== expected.userId) return false;
  if (String(order.customer_details?.customer_id || '') !== `user_${expected.userId}`) return false;
  const paidPaise = Math.round(Number(order.order_amount) * 100);
  const neededPaise = Math.round(Number(expected.amount) * 100);
  if (!Number.isFinite(paidPaise) || !Number.isFinite(neededPaise)) return false;
  return paidPaise >= neededPaise;
}
