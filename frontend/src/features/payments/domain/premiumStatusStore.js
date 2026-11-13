/**
 * Shared Premium answer per member, so the Home header and My Profile do not
 * each ask the server on every screen change. Pure: loader and clock are injected.
 */

export const PREMIUM_STATUS_TTL_MS = 5 * 60 * 1000;

/** @typedef {{
 *   premium: boolean,
 *   daysLeft: number|null,
 *   expiresAt: string|null,
 *   showExpiryWarning: boolean,
 * }} PremiumMembershipStatus */

export const INACTIVE_PREMIUM_STATUS = Object.freeze({
  premium: false,
  daysLeft: null,
  expiresAt: null,
  showExpiryWarning: false,
});

/**
 * @param {unknown} raw
 * @returns {PremiumMembershipStatus}
 */
export function normalizePremiumMembershipStatus(raw) {
  if (raw === true) {
    return {
      premium: true,
      daysLeft: null,
      expiresAt: null,
      showExpiryWarning: false,
    };
  }
  if (!raw || typeof raw !== 'object') return { ...INACTIVE_PREMIUM_STATUS };
  return {
    premium: raw.premium === true,
    daysLeft: Number.isFinite(Number(raw.daysLeft)) ? Number(raw.daysLeft) : null,
    expiresAt: typeof raw.expiresAt === 'string' && raw.expiresAt.trim()
      ? raw.expiresAt.trim()
      : null,
    showExpiryWarning: raw.showExpiryWarning === true,
  };
}

/**
 * @param {{
 *   loadStatus: (userId: string) => Promise<PremiumMembershipStatus|boolean|null>,
 *   hasPending?: (userId: string) => boolean,
 *   now?: () => number,
 * }} deps loadStatus answers membership, true/false, or null when unreachable
 */
export function createPremiumStatusStore({ loadStatus, hasPending = () => false, now = Date.now }) {
  const entries = new Map();
  const inflight = new Map();
  const listeners = new Map();

  const keyOf = (userId) => String(userId ?? '').trim();

  function emit(key, status) {
    const set = listeners.get(key);
    if (set) set.forEach((listener) => listener(status));
  }

  function getStatus(userId) {
    return entries.get(keyOf(userId))?.status || { ...INACTIVE_PREMIUM_STATUS };
  }

  function get(userId) {
    return getStatus(userId).premium === true;
  }

  function subscribe(userId, listener) {
    const key = keyOf(userId);
    if (!key) return () => {};
    if (!listeners.has(key)) listeners.set(key, new Set());
    listeners.get(key).add(listener);
    return () => listeners.get(key)?.delete(listener);
  }

  /**
   * @param {string|number|null} userId
   * @param {{ force?: boolean }} [options] force skips the saved answer
   * @returns {Promise<boolean>}
   */
  function load(userId, { force = false } = {}) {
    const key = keyOf(userId);
    if (!key) return Promise.resolve(false);

    const entry = entries.get(key);
    const fresh = entry && now() - entry.checkedAt < PREMIUM_STATUS_TTL_MS;
    if (!force && fresh && !hasPending(key)) return Promise.resolve(entry.status.premium);
    if (!force && inflight.has(key)) return inflight.get(key);

    let promise;
    promise = (async () => {
      try {
        const answer = await loadStatus(key);
        if (answer === null) return entry?.status?.premium === true;
        const status = normalizePremiumMembershipStatus(answer);
        entries.set(key, { status, checkedAt: now() });
        emit(key, status);
        return status.premium;
      } catch {
        return entry?.status?.premium === true;
      } finally {
        if (inflight.get(key) === promise) inflight.delete(key);
      }
    })();
    inflight.set(key, promise);
    return promise;
  }

  return { get, getStatus, subscribe, load };
}
