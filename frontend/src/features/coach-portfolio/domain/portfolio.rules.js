export const PORTFOLIO_FLAG = 'ff.coach-portfolio';

/**
 * @deprecated Visibility uses downline (fetchHasTeamMembers), not Role.
 * Kept for older imports / tests.
 */
export function isCoachPortfolioRole(role) {
  return String(role || '').trim().toLowerCase() === 'coach';
}

export function isPortfolioAdminRole(role) {
  const r = String(role || '').trim().toLowerCase();
  return r === 'admin' || r === 'developer';
}
