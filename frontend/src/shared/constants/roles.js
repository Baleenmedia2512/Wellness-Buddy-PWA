/**
 * @file Canonical user role identifiers used across the app.
 * Centralizing these prevents typos and stringly-typed role checks
 * scattered across features.
 */

/** @typedef {'admin'|'coach'|'member'|'guest'} Role */

/** Administrative super-user. */
export const ROLE_ADMIN = 'admin';

/** Coach who manages a team of members. */
export const ROLE_COACH = 'coach';

/** Standard end-user. */
export const ROLE_MEMBER = 'member';

/** Unauthenticated visitor. */
export const ROLE_GUEST = 'guest';

/**
 * Ordered list of all roles, lowest -> highest privilege.
 * @type {Role[]}
 */
export const ALL_ROLES = [ROLE_GUEST, ROLE_MEMBER, ROLE_COACH, ROLE_ADMIN];

/**
 * Privilege ranking. Higher number === more privileged.
 * @type {Record<Role, number>}
 */
export const ROLE_RANK = {
  [ROLE_GUEST]: 0,
  [ROLE_MEMBER]: 1,
  [ROLE_COACH]: 2,
  [ROLE_ADMIN]: 3,
};

/**
 * Returns true when `role` has at least the privilege of `minRole`.
 * @param {Role|string|null|undefined} role
 * @param {Role} minRole
 * @returns {boolean}
 */
export function hasAtLeastRole(role, minRole) {
  const a = ROLE_RANK[/** @type {Role} */ (role)] ?? -1;
  const b = ROLE_RANK[minRole] ?? Infinity;
  return a >= b;
}
