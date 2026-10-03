/**
 * Client-side nav page access helpers (mirror backend navAccess.rules).
 * Fail-open when matrix is null/undefined (load failure / flag off).
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

export const MATRIX_ROLES = Object.freeze(['user', 'coach', 'admin', 'developer']);

export const NAV_PAGE_LABELS = Object.freeze({
  home: 'Home',
  dashboard: 'Diary',
  'activity-report': 'Activity',
  enrollment: 'Programmes',
  counselling: 'BCM',
  'physical-club': 'Club',
  testimonials: 'Transformation',
  reports: 'Reports',
});

export const MATRIX_ROLE_LABELS = Object.freeze({
  user: 'Customer',
  coach: 'Sponsor',
  admin: 'Admin',
  developer: 'Developer',
});

const ALL_ON = Object.freeze(Object.fromEntries(NAV_PAGE_KEYS.map((k) => [k, true])));

/**
 * @param {Record<string, boolean>|null|undefined} pages
 * @param {string} pageKey
 * @returns {boolean}
 */
export function canAccessNavPage(pages, pageKey) {
  if (!NAV_PAGE_KEYS.includes(pageKey)) return false;
  // Fail-open until config loads
  if (pages == null) return true;
  return Boolean(pages[pageKey]);
}

/**
 * @param {Record<string, boolean>|null|undefined} pages
 * @returns {string[]}
 */
export function allowedNavPageKeys(pages) {
  if (pages == null) return [...NAV_PAGE_KEYS];
  return NAV_PAGE_KEYS.filter((k) => Boolean(pages[k]));
}

/**
 * Pick a safe fallback page when the requested target is denied.
 * Prefers home, then first allowed page, else home.
 *
 * @param {string} targetPage
 * @param {Record<string, boolean>|null|undefined} pages
 * @returns {string|null} null = allow target; string = redirect to that page
 */
export function resolveNavTargetOrFallback(targetPage, pages) {
  if (canAccessNavPage(pages, targetPage)) return null;
  if (canAccessNavPage(pages, 'home')) return 'home';
  const allowed = allowedNavPageKeys(pages);
  return allowed[0] || 'home';
}

/**
 * Normalize admin matrix for editor state.
 * @param {unknown} matrix
 * @returns {Record<string, Record<string, boolean>>}
 */
export function normalizeNavAccessMatrix(matrix) {
  const src = matrix && typeof matrix === 'object' && !Array.isArray(matrix) ? matrix : {};
  const out = {};
  for (const role of MATRIX_ROLES) {
    const roleSrc = src[role] && typeof src[role] === 'object' ? src[role] : {};
    out[role] = {};
    for (const key of NAV_PAGE_KEYS) {
      out[role][key] = Boolean(roleSrc[key]);
    }
  }
  return out;
}

export function allNavPagesAllowed() {
  return { ...ALL_ON };
}
