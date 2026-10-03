/**
 * Activity Report hide / unhide — domain rules.
 *
 * Hide is global (IsHidden on the member). Hiding never deletes
 * team_table users or activity records.
 *
 * Who may hide: whoever can open Activity (nav page `activity-report`).
 * Profile role and coach-team Sponsor / Co-Sponsor seat are not the gate.
 */

/**
 * @param {{ activityAvailable?: boolean }} args
 * @returns {boolean}
 */
export function canManageActivityReportHiddenUsers({ activityAvailable = false } = {}) {
  return activityAvailable === true;
}

/**
 * Remove hidden member IDs from a report audience list.
 * Hidden users stay excluded regardless of date/attendance/education filters.
 *
 * @param {Array<number|string>} userIds
 * @param {Array<number|string>} hiddenIds
 * @returns {number[]}
 */
export function excludeHiddenActivityReportUserIds(userIds = [], hiddenIds = []) {
  const source = Array.isArray(userIds) ? userIds : [];
  if (!Array.isArray(hiddenIds) || hiddenIds.length === 0) {
    return source.map(Number).filter((id) => Number.isFinite(id));
  }
  const hidden = new Set(
    hiddenIds.map(Number).filter((id) => Number.isFinite(id)),
  );
  return source
    .map(Number)
    .filter((id) => Number.isFinite(id) && !hidden.has(id));
}

/**
 * Stable cache token so report caches bust when the global hidden set changes.
 * @param {Array<number|string>} hiddenIds
 * @returns {string}
 */
export function activityReportHiddenCacheToken(hiddenIds = []) {
  if (!Array.isArray(hiddenIds) || hiddenIds.length === 0) return 'none';
  return hiddenIds
    .map(Number)
    .filter((id) => Number.isFinite(id))
    .sort((a, b) => a - b)
    .join(',');
}
