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
]);

/** Roles stored in the matrix (UI labels Customer / Sponsor / Admin / Developer). */
export const MATRIX_ROLES = Object.freeze(['user', 'coach', 'admin', 'developer']);

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
});

/** Default matrix when DB row is missing. */
export const DEFAULT_NAV_ACCESS_MATRIX = Object.freeze({
  user: { ...CUSTOMER_DEFAULT },
  coach: { ...ALL_PAGES_ON },
  admin: { ...ALL_PAGES_ON },
  developer: { ...ALL_PAGES_ON },
});

/**
 * Map account Role → matrix key.
 * `upline` shares the Sponsor (`coach`) row.
 * A Customer (`user`) who has own downline members (CoachId = them) uses the
 * Sponsor row — Community ID / joint coach-team seat alone does not.
 * Unknown / empty → `user` (Customer).
 *
 * @param {string|null|undefined} role
 * @param {{ hasSponsorTeam?: boolean }} [extras]
 * @returns {'user'|'coach'|'admin'|'developer'}
 */
export function resolveMatrixRole(role, extras = {}) {
  const r = String(role || '').trim().toLowerCase();
  if (r === 'admin') return 'admin';
  if (r === 'developer') return 'developer';
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
 * Normalize full matrix; fill missing roles from defaults.
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
  for (const role of MATRIX_ROLES) {
    if (matrix[role] == null) {
      return { ok: false, message: `matrix missing role: ${role}` };
    }
    if (typeof matrix[role] !== 'object' || Array.isArray(matrix[role])) {
      return { ok: false, message: `matrix.${role} must be an object of pageKey → boolean` };
    }
  }
  return { ok: true, matrix: normalizeMatrix(matrix) };
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
