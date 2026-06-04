/**
 * inactivity-rules.js — Pure business logic for user inactivity detection.
 * Per claude.md §3.1: domain layer is pure, no I/O.
 * 
 * @module backend/features/idle-cleanup/domain/inactivity-rules
 */

/**
 * Threshold for considering a user inactive (in days).
 * Reduced from 31 days to 7 days per product requirement.
 */
export const INACTIVITY_THRESHOLD_DAYS = 7;

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
 * 
 * @example
 * // User last active 8 days ago
 * isUserIdle(new Date('2026-05-27T00:00:00Z'), new Date('2026-06-04T00:00:00Z'))
 * // => true
 * 
 * @example
 * // User last active 6 days ago
 * isUserIdle(new Date('2026-05-29T00:00:00Z'), new Date('2026-06-04T00:00:00Z'))
 * // => false
 */
export function isUserIdle(lastActiveAt, now = new Date()) {
  // Edge case 1: null/undefined LastActiveAt → never logged in → idle
  if (!lastActiveAt) {
    return true;
  }

  // Normalize to Date object
  const lastActiveDate = lastActiveAt instanceof Date ? lastActiveAt : new Date(lastActiveAt);
  
  // Edge case 2: invalid date
  if (isNaN(lastActiveDate.getTime())) {
    return true; // treat invalid data as idle (defensive)
  }

  // Edge case 3: future timestamp (clock skew) → NOT idle (defensive)
  if (lastActiveDate > now) {
    return false;
  }

  // Calculate elapsed days (timezone-independent millisecond math)
  const elapsedMs = now - lastActiveDate;
  const elapsedDays = elapsedMs / (1000 * 60 * 60 * 24);

  return elapsedDays >= INACTIVITY_THRESHOLD_DAYS;
}

/**
 * Gets the cutoff timestamp for idle detection.
 * Users with LastActiveAt before this timestamp are considered idle.
 * 
 * @param {Date} [now=new Date()] - Current timestamp (injected for testability)
 * @returns {Date} Cutoff timestamp (now - INACTIVITY_THRESHOLD_DAYS)
 * 
 * @example
 * getInactivityCutoff(new Date('2026-06-04T00:00:00Z'))
 * // => Date('2026-05-28T00:00:00Z')
 */
export function getInactivityCutoff(now = new Date()) {
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - INACTIVITY_THRESHOLD_DAYS);
  return cutoff;
}
