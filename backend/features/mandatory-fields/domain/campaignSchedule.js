/**
 * Server-side mandatory campaign clock.
 * Day 0 is when an admin turns Required on (required_since).
 * Opening the app does not move this clock.
 * 24-hour steps, same as the existing grace window, not IST midnight.
 */

export const CAMPAIGN_BLOCK_DAY = 10;
export const CAMPAIGN_REMINDER_DAYS = Object.freeze([2, 4, 6, 8]);
const DAY_MS = 24 * 60 * 60 * 1000;

const REMINDER_BIT = Object.freeze({
  2: 1,
  4: 2,
  6: 4,
  8: 8,
});

export function reminderBit(day) {
  return REMINDER_BIT[day] || 0;
}

/**
 * Whole days since the campaign start. Negative elapsed time stays on day 0.
 * @param {Date|string|number} start
 * @param {Date|string|number} now
 * @returns {number}
 */
export function campaignDayIndex(start, now) {
  const started = new Date(start).getTime();
  const current = new Date(now).getTime();
  if (!Number.isFinite(started) || !Number.isFinite(current)) return 0;
  if (current <= started) return 0;
  return Math.floor((current - started) / DAY_MS);
}

export function campaignBlocksAccess(dayIndex) {
  return Number(dayIndex) >= CAMPAIGN_BLOCK_DAY;
}

/**
 * Campaign activation policy.
 * Required stays on: keep the existing server timestamp (resume).
 * Required turns on from off, or turns on for the first time: start at `now`.
 * An old deadline is not reused, including one that already passed day 10.
 * Required off: keep the stored timestamp for audit. It is not enforced.
 *
 * @param {{ wasRequired?: boolean, previousSince?: Date|string|null, required?: boolean, now?: Date }} input
 * @returns {{ requiredSince: Date|string|null, restarted: boolean }}
 */
export function nextRequiredSince({
  wasRequired = false,
  previousSince = null,
  required = false,
  now = new Date(),
} = {}) {
  const clock = now instanceof Date ? now : new Date(now);
  if (required !== true) {
    return { requiredSince: previousSince || null, restarted: false };
  }
  if (wasRequired === true) {
    return { requiredSince: previousSince || clock, restarted: false };
  }
  return { requiredSince: clock, restarted: true };
}

/**
 * Reminder slots that are due and not yet claimed.
 * @param {number} dayIndex
 * @param {number} sentMask
 * @returns {number[]}
 */
export function dueReminderDays(dayIndex, sentMask) {
  const mask = Number(sentMask) || 0;
  return CAMPAIGN_REMINDER_DAYS.filter((day) => dayIndex >= day && (mask & reminderBit(day)) === 0);
}
