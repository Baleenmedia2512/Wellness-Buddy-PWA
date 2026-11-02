/**
 * bcmContactPhone.rules.js — pure phone matching for BCM device contacts.
 */

/**
 * Digits-only phone for matching (compare last 10 when long enough).
 * @param {string|null|undefined} phone
 * @returns {string}
 */
export function normalizePhoneDigits(phone) {
  return String(phone || '').replace(/\D/g, '');
}

/**
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
export function phonesMatch(a, b) {
  const da = normalizePhoneDigits(a);
  const db = normalizePhoneDigits(b);
  if (!da || !db) return false;
  if (da === db) return true;
  const n = Math.min(10, da.length, db.length);
  if (n < 8) return false;
  return da.slice(-n) === db.slice(-n);
}
