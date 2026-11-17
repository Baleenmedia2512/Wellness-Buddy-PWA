/**
 * Task by Coach — coach email OTP gate (pure).
 * Apps ≥ GOOD_HABIT_COACH_OTP_MIN_VERSION must verify before insert.
 * Missing / older version → legacy immediate save (§5.1).
 */
import { isAtLeastVersion } from '../../app-version/domain/version.rules.js';

/** First app version that requires coach OTP before persisting a habit. */
export const GOOD_HABIT_COACH_OTP_MIN_VERSION = '3.5.7';

export const GOOD_HABIT_OTP_CONTACT_TYPE = 'good_habit_coach';
export const GOOD_HABIT_OTP_TTL_MINUTES = 20;

/**
 * @param {string|null|undefined} appVersion
 * @returns {boolean}
 */
export function requiresGoodHabitCoachOtp(appVersion) {
  return isAtLeastVersion(appVersion, GOOD_HABIT_COACH_OTP_MIN_VERSION) === true;
}

/**
 * OTP recipient key (not a real email) — scoped per member pending attempt.
 * @param {number|string} userId
 * @param {string} otpKey
 */
export function goodHabitOtpRecipientKey(userId, otpKey) {
  return `good-habit:${Number(userId)}:${String(otpKey || '').trim()}`;
}

/**
 * @param {number} [minutesFromNow]
 * @returns {string} IST wall datetime for auth OTP ExpiresAt
 */
export function goodHabitOtpExpiryIst(minutesFromNow = GOOD_HABIT_OTP_TTL_MINUTES) {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const expiresAt = new Date(now.getTime() + istOffset + minutesFromNow * 60 * 1000);
  return expiresAt.toISOString().replace('T', ' ').replace('Z', '').substring(0, 23);
}
