/**
 * AI food-analysis access — pure domain rules (no I/O).
 *
 * Eligible: leaf downline members (under a coach, not a leader role, no own
 * team members) plus admin/developer staff (for testing/ops).
 *
 * Time windows: admin-configured AI Credits availability only (breakfast /
 * lunch / dinner enabled + start/end). No separate hardcoded meal times.
 *
 * Legacy note (§5.1): when `appVersion` is missing/unknown, callers may skip
 * these gates so older clients without X-App-Version keep prior credit-only
 * behaviour. Versioned clients (current app) always enforce.
 */
import { IANA_IST, timeOfDayInTimezone } from '../../../shared/lib/datetime/index.js';
import {
  DEFAULT_AVAILABILITY_WINDOWS,
  evaluateAiAvailability,
} from './availability.rules.js';

/** Roles that must never use AI food analysis (team leaders). */
export const AI_FOOD_LEADER_ROLES = Object.freeze(
  new Set(['coach', 'upline', 'coccoach', 'co-coach']),
);

/** Staff roles that may use AI food analysis (bypass leaf/CoachId checks). */
export const AI_FOOD_STAFF_ROLES = Object.freeze(
  new Set(['admin', 'developer']),
);

/**
 * @deprecated Prefer admin availability windows via evaluateAiAvailability.
 * Kept as aliases of admin lunch/dinner defaults for older imports/tests.
 */
export const AI_FOOD_ANALYSIS_WINDOW = Object.freeze({
  start: DEFAULT_AVAILABILITY_WINDOWS.lunch.start,
  end: DEFAULT_AVAILABILITY_WINDOWS.lunch.end,
});

/** @deprecated See AI_FOOD_ANALYSIS_WINDOW */
export const AI_FOOD_DINNER_WINDOW = Object.freeze({
  start: DEFAULT_AVAILABILITY_WINDOWS.dinner.start,
  end: DEFAULT_AVAILABILITY_WINDOWS.dinner.end,
});

/** @deprecated Prefer DEFAULT_AVAILABILITY_WINDOWS / evaluateAiAvailability */
export const AI_FOOD_ANALYSIS_WINDOWS = Object.freeze([
  AI_FOOD_ANALYSIS_WINDOW,
  AI_FOOD_DINNER_WINDOW,
]);

/**
 * First app version that receives leaf-member + window enforcement.
 * Missing / older → legacy (no leaf/window) while older binaries remain supported.
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
  // Admin / developer may use AI for testing and ops (still subject to time window).
  if (AI_FOOD_STAFF_ROLES.has(r)) return true;
  if (AI_FOOD_LEADER_ROLES.has(r)) return false;
  if (hasDownlineMembers === true) return false;
  const coachNum = Number(coachId);
  if (!Number.isFinite(coachNum) || coachNum <= 0) return false;
  return true;
}

/**
 * Inclusive start/end check for one explicit window in a given IANA timezone.
 * Callers must pass the window — there is no implicit hardcoded meal time.
 *
 * @param {Date|string|number} [now]
 * @param {string} [timezoneIana]
 * @param {{ start?: string, end?: string }|null} [window]
 * @returns {boolean}
 */
export function isWithinAiFoodAnalysisWindow(
  now = new Date(),
  timezoneIana = IANA_IST,
  window = null,
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
 * True when now falls in any of the given windows.
 * Empty / missing list → closed (no hardcoded fallback).
 *
 * @param {Date|string|number} [now]
 * @param {string} [timezoneIana]
 * @param {Array<{ start?: string, end?: string }>|null|undefined} [windows]
 * @returns {boolean}
 */
export function isWithinAnyAiFoodAnalysisWindow(
  now = new Date(),
  timezoneIana = IANA_IST,
  windows = null,
) {
  if (!Array.isArray(windows) || windows.length === 0) return false;
  return windows.some((w) => isWithinAiFoodAnalysisWindow(now, timezoneIana, w));
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
 * Window open = admin AI Credits availability (enabled slots + start/end).
 *
 * @param {{
 *   role?: string|null,
 *   hasDownlineMembers?: boolean,
 *   coachId?: number|string|null,
 *   now?: Date|string|number,
 *   timezoneIana?: string,
 *   availabilityWindows?: object|null,
 *   availableInWindow?: boolean|null,
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
  availabilityWindows = null,
  availableInWindow = null,
} = {}) {
  const eligible = isEligibleAiFoodAnalysisMember({ role, hasDownlineMembers, coachId });

  let windowOpen;
  if (typeof availableInWindow === 'boolean') {
    windowOpen = availableInWindow;
  } else {
    const avail = evaluateAiAvailability({
      now,
      timezoneIana: timezoneIana || IANA_IST,
      availabilityWindows,
    });
    windowOpen = Boolean(avail.availableInWindow);
  }

  if (!eligible) {
    return {
      eligible: false,
      windowOpen,
      allowed: false,
      reason: 'not_eligible_downline',
    };
  }
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
