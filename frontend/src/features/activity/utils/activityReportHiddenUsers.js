/**
 * Frontend helpers for Activity Report hide / unhide eligibility.
 */
import {
  isAdminLikeRole,
  normalizeAppRole,
  ROLE_COACH,
  ROLE_UPLINE,
} from '../../../shared/constants/roles.js';

/**
 * True when the signed-in user may see Hide User / Unhide controls.
 * Matches backend: admin, developer, coach, upline, or elevated coach-like
 * report access (sponsor / co-coach with team scope).
 *
 * @param {{
 *   userRole?: string|null,
 *   effectiveRole?: string|null,
 *   showTeamScope?: boolean,
 * }} args
 * @returns {boolean}
 */
export function canManageActivityReportHiddenUsers({
  userRole = null,
  effectiveRole = null,
  showTeamScope = false,
} = {}) {
  if (isAdminLikeRole(userRole)) return true;
  const profile = normalizeAppRole(userRole);
  if (profile === ROLE_COACH || profile === ROLE_UPLINE) return true;

  const apiRole = String(effectiveRole || '').toLowerCase();
  if (apiRole === 'admin' || apiRole === 'coach') return true;

  // Sponsor / co-coach lead seats keep Mine/Direct/Full UI via showTeamScope.
  return Boolean(showTeamScope);
}
