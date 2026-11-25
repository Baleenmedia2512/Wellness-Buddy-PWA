export const PORTFOLIO_FLAG = 'ff.coach-portfolio';

/**
 * Must match backend PORTFOLIO_SITE_SLOTS_MIN (next-release APP_VERSION).
 * Apps at/above this use ₹399/yr site credits; older keep events-trial gate.
 */
export const PORTFOLIO_SITE_SLOTS_MIN = '3.5.7';

/**
 * @param {string} version
 * @returns {[number, number, number]|null}
 */
function parseSemverParts(version) {
  const match = String(version || '').trim().match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/**
 * @param {string|null|undefined} appVersion
 * @param {string} minVersion
 * @returns {boolean}
 */
export function isAtLeastAppVersion(appVersion, minVersion) {
  const a = parseSemverParts(appVersion);
  const b = parseSemverParts(minVersion);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i += 1) {
    if (a[i] > b[i]) return true;
    if (a[i] < b[i]) return false;
  }
  return true;
}

/**
 * True when this build uses per-site yearly credits (hub open; pay to create).
 * @param {string|null|undefined} appVersion — pass APP_VERSION.VERSION from the app.
 */
export function usesPortfolioSiteSlots(appVersion) {
  return isAtLeastAppVersion(appVersion, PORTFOLIO_SITE_SLOTS_MIN);
}

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
