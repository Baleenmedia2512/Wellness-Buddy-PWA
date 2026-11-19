/**
 * Show the Premium success popup once, for the member who just paid.
 * Pure: no storage or network.
 */

/**
 * @param {unknown} stored Saved member id, if any
 * @param {unknown} userId Signed-in member
 * @returns {boolean}
 */
export function shouldShowPremiumSuccess(stored, userId) {
  const saved = String(stored ?? '').trim();
  const id = String(userId ?? '').trim();
  return saved !== '' && saved === id;
}
