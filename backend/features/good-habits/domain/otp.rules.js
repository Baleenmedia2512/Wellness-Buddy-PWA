/**
 * Task by Coach — coach notify helpers (pure).
 *
 * Product (current): immediate save + score; coach gets email with Reject (no OTP).
 * OTP helpers remain for older clients that still call /otp until those apps are retired.
 */
import { DateTime } from 'luxon';
import { IANA_IST } from '../../../shared/lib/datetime/index.js';

/** @deprecated OTP gate retired — Reject-email flow replaced it. Kept for older APKs. */
export const GOOD_HABIT_COACH_OTP_MIN_VERSION = '3.5.6';

export const GOOD_HABIT_OTP_CONTACT_TYPE = 'good_habit_coach';

/**
 * OTP is no longer required for any app version (save + Reject email instead).
 * @param {string|null|undefined} _appVersion
 * @returns {boolean}
 */
export function requiresGoodHabitCoachOtp(_appVersion) {
  return false;
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
