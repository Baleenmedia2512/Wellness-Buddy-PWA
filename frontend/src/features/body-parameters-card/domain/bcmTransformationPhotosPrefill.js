/**
 * When to reload profile Left/Centre/Right photos into the BCM form.
 * Photos live on team_table — not on body_parameters_cards.
 */

/**
 * @param {{ activated?: boolean, userId?: number|string|null }|null|undefined} status
 * @returns {number|null} member UserId to prefill, or null
 */
export function resolvePhoneStatusPhotoPrefillUserId(status) {
  if (!status || status.activated) return null;
  const id = Number(status.userId);
  return Number.isFinite(id) && id > 0 ? id : null;
}

/**
 * @param {{ userId?: number|string|null }|null|undefined} existingCard
 * @returns {number|null}
 */
export function resolveEditCardPhotoPrefillUserId(existingCard) {
  const id = Number(existingCard?.userId);
  return Number.isFinite(id) && id > 0 ? id : null;
}
