/**
 * AI food-analysis access — pure domain rules (no I/O).
 *
 * Eligible: leaf downline members only (under a coach, not a leader role,
 * and with no team members of their own).
 *
 * Window: 12:00–16:00 in the business timezone (default IST).
 *
 * Legacy note (§5.1): when `appVersion` is missing/unknown, callers may skip
 * these gates so older clients without X-App-Version keep prior credit-only
 * behaviour. Versioned clients (current app) always enforce.
 */
import { IANA_IST, timeOfDayInTimezone } from '../../../shared/lib/datetime/index.js';

/** Roles that must never use AI food analysis (leaders / staff). */
export const AI_FOOD_LEADER_ROLES = Object.freeze(
  new Set(['coach', 'admin', 'developer', 'upline', 'coccoach', 'co-coach']),
);

/** AI food analysis availability window (inclusive), HH:MM:SS. */
export const AI_FOOD_ANALYSIS_WINDOW = Object.freeze({
  start: '12:00:00',
  end: '16:00:00',
});

/**
 * First app version that receives leaf-member + window enforcement.
 * Missing / older → legacy credit-only gate (see shouldEnforceAiFoodAccess).
 */
export const AI_FOOD_ACCESS_MIN_APP_VERSION = '3.4.7';

/**
 * @param {string|null|undefined} hhmmss
 * @returns {number|null} minutes since midnight
 */
export function timeStringToMinutes(hhmmss) {
  if (!hhmmss || typeof hhmmss !== 'string') return null;
  const parts = hhmmss.trim().split(':').map(Number);
  if (parts.length < 2 || parts.some((n) => Number.isNaN(n))) return null;
  const [h, m] = parts;
  return h * 60 + (m || 0);
}

/**
 * @param {{ role?: string|null, hasDownlineMembers?: boolean, coachId?: number|string|null }} input
 * @returns {boolean}
 */
export function isEligibleAiFoodAnalysisMember({
  role = null,
  hasDownlineMembers = false,
  coachId = null,
} = {}) {
  const r = String(role || 'user').trim().toLowerCase();
  if (AI_FOOD_LEADER_ROLES.has(r)) return false;
  if (hasDownlineMembers === true) return false;
  const coachNum = Number(coachId);
  if (!Number.isFinite(coachNum) || coachNum <= 0) return false;
  return true;
}

/**
 * Inclusive start/end check in a given IANA timezone (default IST).
 * @param {Date|string|number} [now]
 * @param {string} [timezoneIana]
 * @param {{ start?: string, end?: string }} [window]
 * @returns {boolean}
 */
export function isWithinAiFoodAnalysisWindow(
  now = new Date(),
  timezoneIana = IANA_IST,
  window = AI_FOOD_ANALYSIS_WINDOW,
) {
  if (!window?.start || !window?.end) return false;
  const startMin = timeStringToMinutes(window.start);
  const endMin = timeStringToMinutes(window.end);
  if (startMin == null || endMin == null) return false;

  const instant = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(instant.getTime())) return false;

  const wall = timeOfDayInTimezone(instant.toISOString(), timezoneIana || IANA_IST);
  const nowMin = timeStringToMinutes(wall);
  if (nowMin == null) return false;
  return nowMin >= startMin && nowMin <= endMin;
}

/**
 * Whether leaf/window gates apply for this client version.
 * Missing version → legacy (no leaf/window) while older binaries remain supported.
 *
 * @param {string|null|undefined} appVersion
 * @param {(a: string, b: string) => number} compareSemver
 * @returns {boolean}
 */
export function shouldEnforceAiFoodAccess(appVersion, compareSemver) {
  if (appVersion == null || String(appVersion).trim() === '') return false;
  if (typeof compareSemver !== 'function') return true;
  try {
    return compareSemver(String(appVersion).trim(), AI_FOOD_ACCESS_MIN_APP_VERSION) >= 0;
  } catch {
    return false;
  }
}

/**
 * Combined access decision (pure).
 *
 * @param {{
 *   role?: string|null,
 *   hasDownlineMembers?: boolean,
 *   coachId?: number|string|null,
 *   now?: Date|string|number,
 *   timezoneIana?: string,
 * }} opts
 * @returns {{
 *   eligible: boolean,
 *   windowOpen: boolean,
 *   allowed: boolean,
 *   reason: string|null,
 * }}
 */
export function evaluateAiFoodAnalysisAccess({
  role = null,
  hasDownlineMembers = false,
  coachId = null,
  now = new Date(),
  timezoneIana = IANA_IST,
} = {}) {
  const eligible = isEligibleAiFoodAnalysisMember({ role, hasDownlineMembers, coachId });
  if (!eligible) {
    return {
      eligible: false,
      windowOpen: isWithinAiFoodAnalysisWindow(now, timezoneIana),
      allowed: false,
      reason: 'not_eligible_downline',
    };
  }
  const windowOpen = isWithinAiFoodAnalysisWindow(now, timezoneIana);
  if (!windowOpen) {
    return {
      eligible: true,
      windowOpen: false,
      allowed: false,
      reason: 'outside_ai_window',
    };
  }
  return {
    eligible: true,
    windowOpen: true,
    allowed: true,
    reason: null,
  };
}
