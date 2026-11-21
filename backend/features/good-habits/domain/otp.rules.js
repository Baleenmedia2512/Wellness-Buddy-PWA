/**
 * Task by Coach — coach email OTP gate (pure).
 * Apps ≥ GOOD_HABIT_COACH_OTP_MIN_VERSION must verify before insert.
 * Missing / older version → legacy immediate save (§5.1).
 */
import { DateTime } from 'luxon';
import { isAtLeastVersion } from '../../app-version/domain/version.rules.js';
import { IANA_IST } from '../../../shared/lib/datetime/index.js';

/** First app version that requires coach OTP before persisting a habit. */
/** Matches the app build that ships the OTP UI (`frontend/src/config/version.js`). */
export const GOOD_HABIT_COACH_OTP_MIN_VERSION = '3.5.6';

export const GOOD_HABIT_OTP_CONTACT_TYPE = 'good_habit_coach';

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
 * End of the current IST calendar day (23:59:59.999 Asia/Kolkata).
 * @param {Date|string|number} [now]
 * @returns {DateTime}
 */
export function goodHabitOtpEndOfIstDay(now = new Date()) {
  return DateTime.fromJSDate(now instanceof Date ? now : new Date(now))
    .setZone(IANA_IST)
    .endOf('day');
}

/**
 * Auth OTP `ExpiresAt` wall string (IST digits; compared as IST in verify).
 * Valid until 11:59:59.999 PM IST the same day the code was sent.
 * @param {Date|string|number} [now]
 * @returns {string}
 */
export function goodHabitOtpExpiryIst(now = new Date()) {
  return goodHabitOtpEndOfIstDay(now).toFormat('yyyy-MM-dd HH:mm:ss.SSS');
}

/**
 * Pending-payload expiry as real UTC ISO (compared with Date.now()).
 * @param {Date|string|number} [now]
 * @returns {string}
 */
export function goodHabitOtpExpiryUtcIso(now = new Date()) {
  return goodHabitOtpEndOfIstDay(now).toUTC().toISO();
}

/**
 * Human label for emails / API (IST).
 * @param {Date|string|number} [now]
 * @returns {string}
 */
export function goodHabitOtpExpiryLabelIst(now = new Date()) {
  return `${goodHabitOtpEndOfIstDay(now).toFormat('d MMM yyyy')}, 11:59:59 PM IST`;
}
