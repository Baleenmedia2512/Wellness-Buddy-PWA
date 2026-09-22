/**
 * Who may unregister (soft-delete) a nutrition centre.
 * Pure — no I/O.
 *
 * Allowed: owner, admin/developer, or the other person on the same
 * active coach / co-coach pair (My Club scope).
 */

function toId(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * @param {{ actorUserId: unknown, ownerUserId: unknown, role?: string|null, coachTeam?: { CoachId?: unknown, CoCoachId?: unknown }|null }} input
 * @returns {boolean}
 */
export function canUnregisterCenter({ actorUserId, ownerUserId, role, coachTeam } = {}) {
  const actor = toId(actorUserId);
  const owner = toId(ownerUserId);
  if (actor == null || owner == null) return false;

  const r = String(role || '').toLowerCase();
  if (r === 'admin' || r === 'developer') return true;
  if (actor === owner) return true;

  if (!coachTeam) return false;
  const pair = [toId(coachTeam.CoachId), toId(coachTeam.CoCoachId)].filter((id) => id != null);
  return pair.length === 2 && pair.includes(actor) && pair.includes(owner);
}
