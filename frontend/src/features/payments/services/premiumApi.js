import { apiFetch } from '../../../shared/services/apiFetch.js';
import {
  parsePendingPremiumOrder,
  shouldKeepPendingPremiumOrder,
} from '../domain/pendingPremiumOrder.js';

const PENDING_KEY = 'wv.pendingPremiumOrder';

function storage() {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

/** Remember an order that Cashfree is about to take payment for. */
export function savePendingPremiumOrder({ userId, orderId }) {
  try {
    storage()?.setItem(PENDING_KEY, JSON.stringify({ userId, orderId, startedAt: Date.now() }));
  } catch {
    // Storage full or blocked: payment still works, only late confirm is lost.
  }
}

function clearPendingPremiumOrder() {
  try {
    storage()?.removeItem(PENDING_KEY);
  } catch {
    // ignore
  }
}

function readPendingPremiumOrder(userId) {
  const pending = parsePendingPremiumOrder(storage()?.getItem(PENDING_KEY), Date.now());
  if (!pending) {
    clearPendingPremiumOrder();
    return null;
  }
  return pending.userId === String(userId) ? pending : null;
}

/** Ask the server to check one order with Cashfree. Never throws. */
async function confirmPremiumOrder({ userId, orderId }) {
  try {
    const response = await apiFetch('/api/payments/confirm-premium-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, orderId }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || !body?.data) return null;
    return { premium: body.data.premium === true, status: String(body.data.status || '') };
  } catch {
    return null;
  }
}

/**
 * Confirm the payment this device started, if any.
 * @param {string|number} userId
 * @returns {Promise<boolean>} true when the server confirmed the payment
 */
export async function confirmPendingPremiumOrder(userId) {
  const pending = readPendingPremiumOrder(userId);
  if (!pending) return false;
  const answer = await confirmPremiumOrder({ userId, orderId: pending.orderId });
  if (!answer) return false; // Network problem: keep it and try next time.
  if (!shouldKeepPendingPremiumOrder(answer)) clearPendingPremiumOrder();
  return answer.premium;
}

/** True while this device has a started payment that is not confirmed yet. */
export function hasPendingPremiumOrder(userId) {
  return readPendingPremiumOrder(userId) != null;
}

/**
 * Does the server say this member has paid for Premium?
 * @param {string|number} userId
 * @returns {Promise<boolean|null>} null when the server could not be reached
 */
export async function fetchPremiumStatus(userId) {
  try {
    const response = await apiFetch(
      `/api/payments/premium-status?userId=${encodeURIComponent(userId)}`,
      { method: 'GET', cache: 'no-store' },
    );
    const body = await response.json().catch(() => ({}));
    if (!response.ok || typeof body?.data?.premium !== 'boolean') return null;
    return body.data.premium;
  } catch {
    return null;
  }
}
