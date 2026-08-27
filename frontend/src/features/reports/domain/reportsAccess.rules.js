/**
 * Who may open the Reports module (nav + page).
 * Product: coach / upline analytics — not for regular leaf members.
 */
export const REPORTS_ACCESS_ROLES = Object.freeze(
  new Set(['coach', 'coccoach', 'co-coach', 'upline', 'admin', 'developer']),
);

/**
 * @param {string|null|undefined} role
 * @returns {boolean}
 */
export function canAccessReportsModule(role) {
  const r = String(role || '').trim().toLowerCase();
  return REPORTS_ACCESS_ROLES.has(r);
}
