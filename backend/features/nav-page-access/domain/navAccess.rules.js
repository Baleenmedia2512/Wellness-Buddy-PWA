/**
 * Pure rules for role → main-nav page access matrix.
 * Matrix values live in DB; this module validates/normalizes and resolves access.
 */

export const NAV_PAGE_KEYS = Object.freeze([
  'home',
  'dashboard',
  'activity-report',
  'enrollment',
  'counselling',
  'physical-club',
  'testimonials',
  'reports',
  'broadcast',
  'create-event',
  'event-check-in',
  'paid-features',
  'map-business',
  'go-premium',
]);

/**
 * Roles stored in the matrix.
 * UI labels: Customer / Sponsor / System Admin / Admin / Developer.
 * `system_admin` is a normal account column. Admin and Developer still own this screen.
 */
export const MATRIX_ROLES = Object.freeze(['user', 'coach', 'system_admin', 'admin', 'developer']);

/** Roles a released app already sends. `system_admin` may be omitted. */
const REQUIRED_MATRIX_ROLES = Object.freeze(['user', 'coach', 'admin', 'developer']);

const ALL_PAGES_ON = Object.freeze(
  Object.fromEntries(NAV_PAGE_KEYS.map((k) => [k, true])),
);

const CUSTOMER_DEFAULT = Object.freeze({
  home: true,
  dashboard: true,
  'activity-report': false,
  enrollment: true,
  counselling: false,
  'physical-club': false,
  testimonials: true,
  reports: false,
  broadcast: true,
  'create-event': true,
  'event-check-in': false,
  'paid-features': true,
  'map-business': true,
  'go-premium': false,
});

/** Sponsor keeps every existing page. Check-in stays off until an admin turns it on. */
const SPONSOR_DEFAULT = Object.freeze({
  ...ALL_PAGES_ON,
  'event-check-in': false,
});

/** System Admin matches Customer, plus Check-in. */
const SYSTEM_ADMIN_DEFAULT = Object.freeze({
  ...CUSTOMER_DEFAULT,
  'event-check-in': true,
});

/** Default matrix when DB row is missing. Check-in starts on for System Admin, Admin, and Developer. */
export const DEFAULT_NAV_ACCESS_MATRIX = Object.freeze({
  user: { ...CUSTOMER_DEFAULT },
  coach: { ...SPONSOR_DEFAULT },
  system_admin: { ...SYSTEM_ADMIN_DEFAULT },
  admin: { ...ALL_PAGES_ON },
  developer: { ...ALL_PAGES_ON },
});

/**
 * Map account Role → matrix key.
 * `upline` shares the Sponsor (`coach`) row.
 * `system_admin` keeps its own row, including when that account has downline members.
 * A Customer (`user`) who has own downline members (CoachId = them) uses the
 * Sponsor row — Community ID / joint coach-team seat alone does not.
 * Unknown / empty → `user` (Customer).
 *
 * @param {string|null|undefined} role
 * @param {{ hasSponsorTeam?: boolean }} [extras]
 * @returns {'user'|'coach'|'system_admin'|'admin'|'developer'}
 */
export function resolveMatrixRole(role, extras = {}) {
  const r = String(role || '').trim().toLowerCase();
  if (r === 'admin') return 'admin';
  if (r === 'developer') return 'developer';
  if (r === 'system_admin' || r === 'system admin' || r === 'systemadmin') return 'system_admin';
  if (r === 'coach' || r === 'upline') return 'coach';
  if (extras.hasSponsorTeam) return 'coach';
  return 'user';
}

/**
 * Normalize one role's page map: only known keys, boolean values.
 * Missing keys default to `false` (deny).
 *
 * @param {unknown} pages
 * @returns {Record<string, boolean>}
 */
export function normalizePageMap(pages) {
  const src = pages && typeof pages === 'object' && !Array.isArray(pages) ? pages : {};
  const out = {};
  for (const key of NAV_PAGE_KEYS) {
    out[key] = Boolean(src[key]);
  }
  return out;
}

/**
 * Read-path matrix. Keys saved in JSON keep their boolean.
 * A page added after that save (no key yet) uses the role default,
 * so BroadCast appears without a manual migration.
 *
 * @param {unknown} matrix
 * @returns {Record<string, Record<string, boolean>>}
 */
export function matrixWithDefaultsForNewPages(matrix) {
  const src = matrix && typeof matrix === 'object' && !Array.isArray(matrix) ? matrix : {};
  const seeded = {};
  for (const role of MATRIX_ROLES) {
    const roleSrc = src[role] && typeof src[role] === 'object' && !Array.isArray(src[role])
      ? src[role]
      : null;
    const defaults = DEFAULT_NAV_ACCESS_MATRIX[role];
    if (!roleSrc) {
      seeded[role] = { ...defaults };
      continue;
    }
    const merged = {};
    for (const key of NAV_PAGE_KEYS) {
      merged[key] = Object.prototype.hasOwnProperty.call(roleSrc, key)
        ? roleSrc[key]
        : defaults[key];
    }
    seeded[role] = merged;
  }
  return normalizeMatrix(seeded);
}

/**
 * Normalize full matrix; fill missing roles from defaults.
 * Missing page keys default to false (deny). Saves use this path.
 *
 * @param {unknown} matrix
 * @returns {Record<string, Record<string, boolean>>}
 */
export function normalizeMatrix(matrix) {
  const src = matrix && typeof matrix === 'object' && !Array.isArray(matrix) ? matrix : {};
  const out = {};
  for (const role of MATRIX_ROLES) {
    out[role] = normalizePageMap(src[role] ?? DEFAULT_NAV_ACCESS_MATRIX[role]);
  }
  return out;
}

/**
 * Validate PUT body matrix. Throws ValidationError-shaped { status, message } via caller.
 *
 * @param {unknown} matrix
 * @returns {{ ok: true, matrix: Record<string, Record<string, boolean>> } | { ok: false, message: string }}
 */
export function validateMatrixInput(matrix) {
  if (!matrix || typeof matrix !== 'object' || Array.isArray(matrix)) {
    return { ok: false, message: 'matrix must be an object keyed by role' };
  }
  for (const role of REQUIRED_MATRIX_ROLES) {
    if (matrix[role] == null) {
      return { ok: false, message: `matrix missing role: ${role}` };
    }
    if (typeof matrix[role] !== 'object' || Array.isArray(matrix[role])) {
      return { ok: false, message: `matrix.${role} must be an object of pageKey → boolean` };
    }
  }
  if (
    matrix.system_admin != null
    && (typeof matrix.system_admin !== 'object' || Array.isArray(matrix.system_admin))
  ) {
    return { ok: false, message: 'matrix.system_admin must be an object of pageKey → boolean' };
  }
  return { ok: true, matrix: normalizeMatrix(matrix) };
}

/**
 * Older Admin Config saves omit `system_admin`. Keep the stored column.
 * A save that includes the key replaces it.
 *
 * @param {unknown} incoming
 * @param {Record<string, Record<string, boolean>>} validatedMatrix
 * @param {Record<string, Record<string, boolean>>|null|undefined} storedMatrix
 * @returns {Record<string, Record<string, boolean>>}
 */
export function mergeOmittedSystemAdmin(incoming, validatedMatrix, storedMatrix) {
  const sent = incoming
    && typeof incoming === 'object'
    && !Array.isArray(incoming)
    && Object.prototype.hasOwnProperty.call(incoming, 'system_admin');
  if (sent) return validatedMatrix;
  const kept = storedMatrix?.system_admin ?? validatedMatrix.system_admin;
  return { ...validatedMatrix, system_admin: normalizePageMap(kept) };
}

/**
 * Older Admin Config saves omit `event-check-in`. Keep the stored value
 * (or the role default) instead of turning the new page off.
 *
 * @param {unknown} incoming
 * @param {Record<string, Record<string, boolean>>} validatedMatrix
 * @param {Record<string, Record<string, boolean>>|null|undefined} storedMatrix
 * @returns {Record<string, Record<string, boolean>>}
 */
export function mergeOmittedCheckInPage(incoming, validatedMatrix, storedMatrix) {
  const out = { ...validatedMatrix };
  for (const role of MATRIX_ROLES) {
    const incomingRole = incoming?.[role];
    const sent = incomingRole
      && typeof incomingRole === 'object'
      && !Array.isArray(incomingRole)
      && Object.prototype.hasOwnProperty.call(incomingRole, 'event-check-in');
    if (sent) continue;
    const kept = storedMatrix?.[role]?.['event-check-in'];
    out[role] = {
      ...out[role],
      'event-check-in': kept == null
        ? Boolean(DEFAULT_NAV_ACCESS_MATRIX[role]?.['event-check-in'])
        : Boolean(kept),
    };
  }
  return out;
}

/**
 * @param {Record<string, Record<string, boolean>>} matrix
 * @param {string|null|undefined} role
 * @param {{ hasSponsorTeam?: boolean }} [extras]
 * @returns {Record<string, boolean>}
 */
export function pagesForRole(matrix, role, extras = {}) {
  const key = resolveMatrixRole(role, extras);
  const normalized = normalizeMatrix(matrix);
  return normalized[key];
}

/**
 * @param {Record<string, boolean>} pageMap
 * @param {string} pageKey
 * @returns {boolean}
 */
export function canAccessPage(pageMap, pageKey) {
  if (!NAV_PAGE_KEYS.includes(pageKey)) return false;
  return Boolean(pageMap?.[pageKey]);
}

/**
 * Fail-open map: all known pages allowed (pre-feature / load-failure behaviour).
 * @returns {Record<string, boolean>}
 */
export function allPagesAllowed() {
  return { ...ALL_PAGES_ON };
}

/**
 * Ordered list of allowed page keys.
 * @param {Record<string, boolean>} pageMap
 * @returns {string[]}
 */

export function allowedPageKeys(pageMap) {
  return NAV_PAGE_KEYS.filter((k) => Boolean(pageMap?.[k]));
}
