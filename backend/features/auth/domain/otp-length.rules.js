/**
 * OTP length rules — email (SMTP) vs phone (MDT SMS).
 * Pure — no I/O.
 */

export const EMAIL_OTP_LENGTH = 4;
export const SMS_OTP_LENGTH = 4;

export const EMAIL_OTP_REGEX = /^\d{4}$/;
export const SMS_OTP_REGEX = /^\d{4}$/;

/** Generate a 4-digit email OTP in range 1000–9999. */
export function generateEmailOtp() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

/** Generate a 4-digit SMS OTP in range 1000–9999 (same length as email OTP). */
export function generateSmsOtp() {
  return generateEmailOtp();
}

export function generateOtpForContactType(contactType) {
  return contactType === 'phone' ? generateSmsOtp() : generateEmailOtp();
}

export function isValidEmailOtp(otp) {
  return EMAIL_OTP_REGEX.test(String(otp ?? '').trim());
}

export function isValidSmsOtp(otp) {
  return SMS_OTP_REGEX.test(String(otp ?? '').trim());
}

export function isValidOtpForContactType(otp, contactType) {
  return contactType === 'phone' ? isValidSmsOtp(otp) : isValidEmailOtp(otp);
}

export function otpLengthForContactType(contactType) {
  return contactType === 'phone' ? SMS_OTP_LENGTH : EMAIL_OTP_LENGTH;
}

export function otpValidationMessageForContactType(contactType) {
  const len = otpLengthForContactType(contactType);
  const channel = contactType === 'phone' ? 'SMS' : 'email';
  return `Enter the ${len}-digit code sent to your ${channel}`;
}

/**
 * Extract exactly `length` digits from pasted/autofill text.
 * Handles plain codes, whitespace, and prose such as "Your OTP is 1234".
 * @param {string} raw
 * @param {number} [length=EMAIL_OTP_LENGTH]
 * @returns {string|null}
 */
export function extractOtpFromText(raw, length = EMAIL_OTP_LENGTH) {
  const text = String(raw ?? '');
  if (!text.trim()) return null;

  const exactRun = text.match(new RegExp(`(?:^|\\D)(\\d{${length}})(?:\\D|$)`));
  if (exactRun?.[1]) return exactRun[1];

  const digitsOnly = text.replace(/\D/g, '');
  if (digitsOnly.length >= length) return digitsOnly.slice(0, length);
  return null;
}
