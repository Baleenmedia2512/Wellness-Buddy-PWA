/**
 * Remember a started Premium payment so it can be confirmed later if the app
 * closes mid-payment. Pure: no storage, clock, or network.
 */

export const PENDING_PREMIUM_ORDER_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * @param {unknown} raw JSON text from storage
 * @param {number} nowMs
 * @returns {{ userId: string, orderId: string, startedAt: number }|null}
 */
export function parsePendingPremiumOrder(raw, nowMs) {
  if (typeof raw !== 'string' || !raw) return null;
  let value;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  const userId = String(value?.userId ?? '').trim();
  const orderId = String(value?.orderId ?? '').trim();
  const startedAt = Number(value?.startedAt);
  if (!userId || !orderId || !Number.isFinite(startedAt)) return null;
  if (nowMs - startedAt > PENDING_PREMIUM_ORDER_TTL_MS) return null;
  return { userId, orderId, startedAt };
}

/**
 * After the server answers, keep checking only while Cashfree still waits for payment.
 * @param {{ premium: boolean, status: string }} answer
 * @returns {boolean}
 */
export function shouldKeepPendingPremiumOrder(answer) {
  if (answer?.premium) return false;
  return String(answer?.status || '').toUpperCase() === 'ACTIVE';
}
