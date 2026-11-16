/**
 * Home membership card under the welcome photo card.
 * Premium (30 days) and the free trial (14 days) share one layout.
 * Lengths match the server plan windows used to compute days left.
 */

export const HOME_TRIAL_LENGTH_DAYS = 14;
export const HOME_PREMIUM_PERIOD_DAYS = 30;
/** Card turns red when this many days, or fewer, remain. Includes the ending day. */
export const HOME_ENDING_SOON_DAYS = 2;

/**
 * @param {unknown} value
 * @returns {string}
 */
function endTimeLabel(value) {
  const when = typeof value === 'string' ? value.trim() : '';
  if (!when) return '';
  return /IST/i.test(when) ? when : `${when} (IST)`;
}

/**
 * @param {number} days
 * @param {number} period
 * @returns {number}
 */
function remainingPercent(days, period) {
  const span = Math.max(period, days, 1);
  return Math.max(0, Math.min(100, Math.round((days / span) * 100)));
}

/**
 * @param {{
 *   premium?: boolean,
 *   trial?: boolean,
 *   daysLeft?: number|null,
 *   expiresAtDisplay?: string|null,
 * }} input
 * @returns {{
 *   title: string,
 *   badge: string,
 *   daysLabel: string,
 *   endsOn: string,
 *   progressPercent: number,
 *   urgent: boolean,
 * }|null}
 */
export function buildHomePlanStatus({
  premium = false,
  trial = false,
  daysLeft = null,
  expiresAtDisplay = null,
} = {}) {
  if (!premium && !trial) return null;

  const endsOn = endTimeLabel(expiresAtDisplay);
  const days = Number(daysLeft);
  const hasDays = daysLeft != null && daysLeft !== '' && Number.isFinite(days);
  if (!hasDays && !endsOn) return null;

  const period = premium ? HOME_PREMIUM_PERIOD_DAYS : HOME_TRIAL_LENGTH_DAYS;
  const safeDays = hasDays ? Math.max(0, days) : 0;
  let daysLabel = '';
  if (hasDays) {
    if (safeDays < 1) daysLabel = 'Ends today';
    else if (safeDays === 1) daysLabel = '1 day left';
    else daysLabel = `${safeDays} days left`;
  }

  return {
    title: premium ? 'Premium Active' : 'Free Trial Active',
    badge: premium ? 'Premium Active' : 'Trial Active',
    daysLabel,
    endsOn,
    progressPercent: hasDays ? remainingPercent(safeDays, period) : 0,
    urgent: hasDays && safeDays <= HOME_ENDING_SOON_DAYS,
  };
}
