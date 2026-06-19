/**
 * marathon.policy.js — Authorization rules for the Marathon Recognition Engine.
 *
 * Pure functions — no I/O. No imports from axios, pg, supabase, or react.
 */

/**
 * Only coaches, admins, and developers may create or manage marathons.
 *
 * @param {{ role: string }} param
 * @returns {boolean}
 */
export function canManageMarathon({ role }) {
  return role === 'coach' || role === 'admin' || role === 'developer';
}

/**
 * A coach may only generate cards for marathons they created.
 * Admins bypass this check.
 *
 * @param {{ requestingCoachId: number, marathonCoachId: number, role: string }} param
 * @returns {boolean}
 */
export function canGenerateCard({ requestingCoachId, marathonCoachId, role }) {
  if (role === 'admin' || role === 'developer') return true;
  return Number(requestingCoachId) === Number(marathonCoachId);
}

/**
 * Anyone holding a valid share token may read the public card snapshot.
 * Token validity (expiry) is enforced separately in the handler.
 *
 * @returns {boolean}
 */
export function canReadPublicCard() {
  return true;
}
