/**
 * inactivity-rules.js — Pure business logic for user inactivity detection.
 * Per claude.md §3.1: domain layer is pure, no I/O.
 *
 * Product (ADR-0007): idle users stay Active. After ≥7 days idle, the next
 * app use notifies the coach by email — we do not auto-set Status=Inactive.
 *
 * @module backend/features/idle-cleanup/domain/inactivity-rules
 */

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/**
 * Threshold for considering a user idle (in days).
 * Used for coach return-notify (not for auto-deactivation).
 */
export const INACTIVITY_THRESHOLD_DAYS = 7;

/**
 * Elapsed whole days since last activity (floor). Null/invalid → null.
 *
 * @param {Date|string|null|undefined} lastActiveAt
 * @param {Date} [now]
 * @returns {number|null}
 */
export function idleDaysSince(lastActiveAt, now = new Date()) {
  if (!lastActiveAt) return null;
  const lastActiveDate = lastActiveAt instanceof Date ? lastActiveAt : new Date(lastActiveAt);
  if (Number.isNaN(lastActiveDate.getTime())) return null;
  if (lastActiveDate > now) return 0;
  return Math.floor((now - lastActiveDate) / MS_PER_DAY);
}

/**
 * True when a returning user should trigger a one-shot coach email.
 *
 * Unlike {@link isUserIdle}, missing/invalid timestamps do NOT notify —
 * there is no proven idle gap to report.
 *
 * @param {Date|string|null|undefined} lastActiveAt
 * @param {Date} [now]
 * @returns {boolean}
 */
export function shouldNotifyCoachOnReturn(lastActiveAt, now = new Date()) {
  const days = idleDaysSince(lastActiveAt, now);
  return days !== null && days >= INACTIVITY_THRESHOLD_DAYS;
}

/**
 * Determines if a user is idle based on their last activity timestamp.
 * Pure function: given inputs, returns output. No side effects.
 *
 * Business rules:
 * 1. If LastActiveAt is null/undefined, user is considered idle (never logged in after creation).
 * 2. If LastActiveAt is >= 7 days ago, user is idle.
 * 3. If LastActiveAt is in the future (clock skew), treat as NOT idle (defensive).
 * 4. Calculation is timezone-independent: uses elapsed milliseconds.
 *
 * @param {Date|string|null} lastActiveAt - User's last activity timestamp (UTC)
 * @param {Date} [now=new Date()] - Current timestamp (injected for testability)
 * @returns {boolean} True if user is idle, false otherwise
 */
export function isUserIdle(lastActiveAt, now = new Date()) {
  // Edge case 1: null/undefined LastActiveAt → never logged in → idle
  if (!lastActiveAt) {
    return true;
  }

  // Normalize to Date object
  const lastActiveDate = lastActiveAt instanceof Date ? lastActiveAt : new Date(lastActiveAt);

  // Edge case 2: invalid date
  if (Number.isNaN(lastActiveDate.getTime())) {
    return true; // treat invalid data as idle (defensive)
  }

  // Edge case 3: future timestamp (clock skew) → NOT idle (defensive)
  if (lastActiveDate > now) {
    return false;
  }

  const elapsedDays = (now - lastActiveDate) / MS_PER_DAY;
  return elapsedDays >= INACTIVITY_THRESHOLD_DAYS;
}

/**
 * Cutoff timestamp for idle detection queries.
 * Users with LastActiveAt before this timestamp are considered idle.
 *
 * @param {Date} [now=new Date()]
 * @returns {Date}
 */
export function getInactivityCutoff(now = new Date()) {
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - INACTIVITY_THRESHOLD_DAYS);
  return cutoff;
}
