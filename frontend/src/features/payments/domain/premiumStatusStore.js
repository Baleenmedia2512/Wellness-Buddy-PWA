/**
 * Shared Premium answer per member, so the Home header and My Profile do not
 * each ask the server on every screen change. Pure: loader and clock are injected.
 */

export const PREMIUM_STATUS_TTL_MS = 5 * 60 * 1000;

/**
 * @param {{
 *   loadStatus: (userId: string) => Promise<boolean|null>,
 *   hasPending?: (userId: string) => boolean,
 *   now?: () => number,
 * }} deps loadStatus answers true/false, or null when the server could not be reached
 */
export function createPremiumStatusStore({ loadStatus, hasPending = () => false, now = Date.now }) {
  const entries = new Map();
  const inflight = new Map();
  const listeners = new Map();

  const keyOf = (userId) => String(userId ?? '').trim();

  function emit(key, premium) {
    const set = listeners.get(key);
    if (set) set.forEach((listener) => listener(premium));
  }

  function get(userId) {
    return entries.get(keyOf(userId))?.premium === true;
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
    if (!force && fresh && !hasPending(key)) return Promise.resolve(entry.premium);
    if (!force && inflight.has(key)) return inflight.get(key);

    let promise;
    promise = (async () => {
      try {
        const answer = await loadStatus(key);
        if (answer === null) return entry?.premium === true; // Offline: keep what we knew.
        entries.set(key, { premium: answer, checkedAt: now() });
        emit(key, answer);
        return answer;
      } catch {
        return entry?.premium === true;
      } finally {
        if (inflight.get(key) === promise) inflight.delete(key);
      }
    })();
    inflight.set(key, promise);
    return promise;
  }

  return { get, subscribe, load };
}
