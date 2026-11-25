import { apiFetch } from '../../../shared/services/apiFetch.js';

const PENDING_KEY = 'wv.pendingPortfolioSiteOrder';

function storage() {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function savePendingPortfolioSiteOrder({ userId, orderId }) {
  try {
    storage()?.setItem(PENDING_KEY, JSON.stringify({
      userId: String(userId),
      orderId: String(orderId),
      startedAt: Date.now(),
    }));
  } catch {
    // ignore
  }
}

function clearPending() {
  try {
    storage()?.removeItem(PENDING_KEY);
  } catch {
    // ignore
  }
}

function readPending(userId) {
  try {
    const raw = storage()?.getItem(PENDING_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.orderId || String(parsed.userId) !== String(userId)) return null;
    if (Date.now() - Number(parsed.startedAt || 0) > 2 * 60 * 60 * 1000) {
      clearPending();
      return null;
    }
    return parsed;
  } catch {
    clearPending();
    return null;
  }
}

/**
 * @param {string|number} userId
 */
export async function fetchPortfolioSiteCredits(userId) {
  try {
    const response = await apiFetch(
      `/api/coach-portfolio/site-credits?userId=${encodeURIComponent(userId)}`,
    );
    const body = await response.json().catch(() => ({}));
    if (!response.ok || !body?.data) {
      throw new Error(body?.message || 'Could not load website credits');
    }
    return body.data;
  } catch (err) {
    // Missing deploy / network — caller treats as zero credits.
    const wrapped = new Error(
      /Failed to fetch|NetworkError|Load failed|404/i.test(String(err?.message || ''))
        ? 'Could not load website credits'
        : (err?.message || 'Could not load website credits'),
    );
    wrapped.cause = err;
    throw wrapped;
  }
}

/**
 * @param {{ userId: string|number, orderId: string }} input
 */
export async function confirmPortfolioSiteOrder({ userId, orderId }) {
  const response = await apiFetch('/api/payments/confirm-portfolio-site-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, orderId }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body?.data) return null;
  return body.data;
}

/**
 * @param {string|number} userId
 * @returns {Promise<object|null>}
 */
export async function confirmPendingPortfolioSiteOrder(userId) {
  const pending = readPending(userId);
  if (!pending) return null;
  const answer = await confirmPortfolioSiteOrder({
    userId,
    orderId: pending.orderId,
  });
  if (!answer) return null;
  if (answer.paid === true || String(answer.status || '').toUpperCase() === 'PAID') {
    clearPending();
  } else if (['EXPIRED', 'CANCELLED', 'FAILED', 'TERMINATED'].includes(
    String(answer.status || '').toUpperCase(),
  )) {
    clearPending();
  }
  return answer;
}
