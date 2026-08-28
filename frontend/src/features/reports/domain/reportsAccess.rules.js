/**
 * Who may open the Reports module (nav + page).
 * Product: common module for every signed-in user when ff.reports-module is on.
 * Role is not used for access; callers still check the feature flag.
 *
 * @param {string|null|undefined} _role
 * @returns {boolean}
 */
export function canAccessReportsModule(_role) {
  return true;
}
