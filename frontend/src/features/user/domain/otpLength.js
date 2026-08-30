/** Email (SMTP) vs SMS (MDT) OTP lengths — keep in sync with backend otp-length.rules.js */

export const EMAIL_OTP_LENGTH = 4;
export const SMS_OTP_LENGTH = 6;

export const EMAIL_OTP_REGEX = /^\d{4}$/;
export const SMS_OTP_REGEX = /^\d{6}$/;

export function isValidEmailOtp(otp) {
  return EMAIL_OTP_REGEX.test(String(otp ?? '').trim());
}

export function isValidSmsOtp(otp) {
  return SMS_OTP_REGEX.test(String(otp ?? '').trim());
}

/**
 * Extract exactly `length` digits from pasted/autofill text.
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
