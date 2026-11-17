/**
 * Shared Premium answer per member, so the Home header and My Profile do not
 * each ask the server on every screen change. Pure: loader and clock are injected.
 */
import {
  applyEntitlementFreshness,
  blankEntitlement,
  reduceEntitlement,
  snapshotFromStored,
} from './entitlementSnapshot.js';

export const PREMIUM_STATUS_TTL_MS = 5 * 60 * 1000;

/** @typedef {{
 *   premium: boolean,
 *   daysLeft: number|null,
 *   expiresAt: string|null,
 *   expiresAtDisplay: string|null,
 *   showExpiryWarning: boolean,
 * }} PremiumMembershipStatus */

export const INACTIVE_PREMIUM_STATUS = Object.freeze({
  premium: false,
  daysLeft: null,
  expiresAt: null,
  expiresAtDisplay: null,
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
      expiresAtDisplay: null,
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
    expiresAtDisplay: typeof raw.expiresAtDisplay === 'string' && raw.expiresAtDisplay.trim()
      ? raw.expiresAtDisplay.trim()
      : null,
    showExpiryWarning: raw.showExpiryWarning === true,
  };
}

/**
 * @param {{
 *   loadStatus: (userId: string) => Promise<PremiumMembershipStatus|boolean|null>,
 *   hasPending?: (userId: string) => boolean,
 *   now?: () => number,
 *   recall?: (userId: string) => PremiumMembershipStatus|null,
 *   remember?: (userId: string, status: PremiumMembershipStatus) => void,
 * }} deps loadStatus answers membership, true/false, or null when unreachable.
 * recall/remember keep the last answer across app restarts so the first paint
 * is not the non-premium theme.
 */
export function createPremiumStatusStore({
  loadStatus,
  hasPending = () => false,
  now = Date.now,
  recall = () => null,
  remember = () => {},
}) {
  const entries = new Map();
  const inflight = new Map();
  const listeners = new Map();

  const keyOf = (userId) => String(userId ?? '').trim();

  function emit(key, status) {
    const set = listeners.get(key);
    if (set) set.forEach((listener) => listener(status));
  }

  function recalled(key) {
    if (!key) return blankEntitlement();
    try {
      const saved = recall(key);
      if (saved && typeof saved === 'object') return snapshotFromStored(saved);
    } catch {
      // A bad saved answer must not block the live check.
    }
    return blankEntitlement();
  }

  function storedStatus(key) {
    return entries.get(key)?.status || recalled(key);
  }

  function getStatus(userId) {
    const key = keyOf(userId);
    return applyEntitlementFreshness(storedStatus(key), now());
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
    const shown = entry ? applyEntitlementFreshness(entry.status, now()) : null;
    if (
      !force
      && fresh
      && !hasPending(key)
      && entry.status.reportLoaded === true
      && shown
      && shown.premium === entry.status.premium
    ) {
      return Promise.resolve(shown.premium === true);
    }

    const execute = () => (async () => {
      const prior = storedStatus(key);
      try {
        const answer = await loadStatus(key);
        const reduced = reduceEntitlement(prior, answer);
        if (!reduced.write) {
          emit(key, prior);
          return applyEntitlementFreshness(prior, now()).premium === true;
        }
        const status = { ...reduced.status, confirmedAt: now() };
        entries.set(key, { status, checkedAt: now() });
        try { remember(key, status); } catch { /* storage full or blocked */ }
        emit(key, status);
        return applyEntitlementFreshness(status, now()).premium === true;
      } catch {
        emit(key, prior);
        return applyEntitlementFreshness(prior, now()).premium === true;
      }
    })();

    // One check per member at a time. A payment refresh waits for the
    // check already in flight, then reads the server again.
    let promise;
    if (inflight.has(key)) {
      if (!force) return inflight.get(key);
      const previous = inflight.get(key);
      promise = previous.then(execute, execute);
    } else {
      promise = execute();
    }
    inflight.set(key, promise);
    promise.finally(() => {
      if (inflight.get(key) === promise) inflight.delete(key);
    });
    return promise;
  }

  function applyReport(userId, report) {
    const key = keyOf(userId);
    if (!key || !report) return getStatus(userId);
    const reduced = reduceEntitlement(storedStatus(key), {
      entitlementPacket: true,
      premiumConfirmed: false,
      reportConfirmed: true,
      report,
    });
    if (!reduced.write) return getStatus(key);
    const status = { ...reduced.status, confirmedAt: now() };
    entries.set(key, { status, checkedAt: now() });
    try { remember(key, status); } catch { /* storage full or blocked */ }
    emit(key, status);
    return getStatus(key);
  }

  return { get, getStatus, subscribe, load, applyReport };
}
