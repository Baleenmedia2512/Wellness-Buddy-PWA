/**
 * Activity Report hide / unhide — domain rules.
 *
 * Hide is global (IsHidden on the member). Hiding never deletes
 * team_table users or activity records.
 */

/** Roles that may hide/unhide members in Activity Report. */
export const ACTIVITY_REPORT_HIDE_ROLES = Object.freeze([
  'admin',
  'developer',
  'coach',
  'upline',
]);

/**
 * Lead seats that map to product "Sponsor" / "Co-Coach".
 * @type {ReadonlyArray<'sponsor'|'co-sponsor'>}
 */
export const ACTIVITY_REPORT_HIDE_LEAD_SEATS = Object.freeze([
  'sponsor',
  'co-sponsor',
]);

/**
 * @param {string|null|undefined} role
 * @returns {string}
 */
export function normalizeActivityReportViewerRole(role) {
  const r = String(role || '').trim().toLowerCase();
  if (r === 'member' || r === 'customer') return 'user';
  return r;
}

/**
 * Eligible when profile role is admin/developer/coach/upline, or the viewer
 * holds a sponsor / co-sponsor (co-coach) lead seat.
 *
 * @param {{ role?: string|null, leadSeat?: string|null }} args
 * @returns {boolean}
 */
export function canManageActivityReportHiddenUsers({ role = null, leadSeat = null } = {}) {
  const normalized = normalizeActivityReportViewerRole(role);
  if (ACTIVITY_REPORT_HIDE_ROLES.includes(normalized)) return true;
  const seat = String(leadSeat || '').toLowerCase();
  return ACTIVITY_REPORT_HIDE_LEAD_SEATS.includes(seat);
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
