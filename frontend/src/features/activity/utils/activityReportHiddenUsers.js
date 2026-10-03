/**
 * Frontend helpers for Activity Report hide / unhide eligibility.
 * Matches backend: hide follows Activity page access, not role or team seat.
 */

/**
 * True when the signed-in user may see Hide User / Unhide controls.
 *
 * @param {{ activityAvailable?: boolean }} args
 * @returns {boolean}
 */
export function canManageActivityReportHiddenUsers({
  activityAvailable = false,
} = {}) {
  return activityAvailable === true;
}
