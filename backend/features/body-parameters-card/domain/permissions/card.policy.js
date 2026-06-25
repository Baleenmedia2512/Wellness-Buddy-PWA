/**
 * card.policy.js — Authorization rules for Body Parameters Card.
 * Pure functions. No I/O.
 */

/**
 * Can this user create a body-parameters card?
 * Coaches (isCoach) and any authenticated user creating a card for themselves.
 *
 * @param {{ isCoach: boolean }} user
 * @returns {boolean}
 */
export function canCreateCard(user) {
  if (!user) return false;
  return true; // any authenticated user may create; coach-for-member is gated at UI
}

/**
 * Can the requestingUserId save the card data to their own profile?
 * Only allowed when the card's user_id matches the logged-in user.
 *
 * @param {number|null} cardUserId   - user_id stored on the card
 * @param {number}      requestingId - logged-in user's DB id
 * @returns {boolean}
 */
export function canSaveCardToProfile(cardUserId, requestingId) {
  if (!cardUserId || !requestingId) return false;
  return parseInt(cardUserId) === parseInt(requestingId);
}

/**
 * Public read (view card via share token) is always allowed — the token
 * itself is the capability. No auth required.
 *
 * @returns {true}
 */
export function canViewPublicCard() {
  return true;
}

/**
 * Can this coach search team-member phone numbers by prefix?
 * Requires a valid numeric coachId.
 *
 * @param {{ coachId: number|null }} ctx
 * @returns {boolean}
 */
export function canSearchTeamPhones({ coachId } = {}) {
  return Boolean(coachId && Number.isInteger(Number(coachId)) && Number(coachId) > 0);
}
