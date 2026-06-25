/**
 * shared/lib/storage.js
 *
 * Canonical local-persistence wrapper for the Wellness Valley PWA.
 * All feature code MUST use this module instead of calling `localStorage`
 * directly (claude.md §2.5).
 *
 * Strategy:
 *  - Primary:  window.localStorage (synchronous, always available in browser/CRA).
 *  - Fallback: no-op (SSR / test environments without a DOM).
 *
 * When @capacitor/preferences is added in future, swap the primary here — no
 * call-site changes required.
 *
 * Public API:
 *   storage.get(key)        → string | null
 *   storage.set(key, value) → void
 *   storage.remove(key)     → void
 */

const STORAGE_UNAVAILABLE = typeof window === 'undefined' || !window.localStorage;

const storage = {
  /**
   * Read a stored string value.
   * @param {string} key
   * @returns {string|null}
   */
  get(key) {
    if (STORAGE_UNAVAILABLE) return null;
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },

  /**
   * Persist a string value.
   * @param {string} key
   * @param {string} value – must be a non-empty string; silently ignored otherwise.
   */
  set(key, value) {
    if (STORAGE_UNAVAILABLE) return;
    if (typeof value !== 'string' || value.length === 0) return;
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // Quota exceeded or private-browsing restriction — degrade silently.
    }
  },

  /**
   * Remove a stored key.
   * @param {string} key
   */
  remove(key) {
    if (STORAGE_UNAVAILABLE) return;
    try {
      window.localStorage.removeItem(key);
    } catch {
      // ignore
    }
  },
};

export default storage;
