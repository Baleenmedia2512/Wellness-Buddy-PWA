/**
 * @file Canonical user role identifiers used across the app.
 * Centralizing these prevents typos and stringly-typed role checks
 * scattered across features.
 *
 * DB / product roles (CLAUDE.md): user | coach | upline | admin | developer.
 * UI label for `user` is "Customer".
 */

/** @typedef {'admin'|'developer'|'coach'|'upline'|'user'|'member'|'guest'} Role */

/** Administrative super-user. */
export const ROLE_ADMIN = 'admin';

/** Engineering / QA role with admin-like tooling access. */
export const ROLE_DEVELOPER = 'developer';

/** Coach who manages a team of members. */
export const ROLE_COACH = 'coach';

/** Hierarchy manager above coaches. */
export const ROLE_UPLINE = 'upline';

/** Default end-user (UI: Customer). Canonical DB value. */
export const ROLE_USER = 'user';

/** Legacy alias — prefer ROLE_USER. */
export const ROLE_MEMBER = 'member';

/** Unauthenticated visitor. */
export const ROLE_GUEST = 'guest';

/** Roles persisted on team_table.Role / returned by session APIs. */
export const KNOWN_APP_ROLES = [
  ROLE_USER,
  ROLE_COACH,
  ROLE_UPLINE,
  ROLE_ADMIN,
  ROLE_DEVELOPER,
];

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
  [ROLE_USER]: 1,
  [ROLE_COACH]: 2,
  [ROLE_UPLINE]: 2,
  [ROLE_ADMIN]: 3,
  [ROLE_DEVELOPER]: 3,
};

/**
 * Normalize a server/client role string to a known app role.
 * Empty / unknown → `user` (Customer). Never elevates.
 * @param {string|null|undefined} role
 * @returns {string}
 */
export function normalizeAppRole(role) {
  const r = String(role || '').trim().toLowerCase();
  if (r === 'member' || r === 'customer') return ROLE_USER;
  if (KNOWN_APP_ROLES.includes(r)) return r;
  return ROLE_USER;
}

/**
 * Returns true when `role` has at least the privilege of `minRole`.
 * @param {Role|string|null|undefined} role
 * @param {Role} minRole
 * @returns {boolean}
 */
export function hasAtLeastRole(role, minRole) {
  const a = ROLE_RANK[/** @type {Role} */ (normalizeAppRole(role))] ?? -1;
  const b = ROLE_RANK[minRole] ?? Infinity;
  return a >= b;
}

/** Roles that see admin tooling (FAB, setup screens). */
export const ADMIN_LIKE_ROLES = [ROLE_ADMIN, ROLE_DEVELOPER];

/**
 * @param {string|null|undefined} role
 * @returns {boolean}
 */
export function isAdminLikeRole(role) {
  return ADMIN_LIKE_ROLES.includes(normalizeAppRole(role));
}
