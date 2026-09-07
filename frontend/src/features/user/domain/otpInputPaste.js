import { extractOtpFromText } from './otpLength.js';

/** Input types that deliver a full OTP string (paste, SMS autofill, drag-drop). */
export const OTP_BULK_INPUT_TYPES = new Set([
  'insertFromPaste',
  'insertReplacementText',
  'insertFromDrop',
]);

/**
 * @param {string | undefined | null} inputType
 * @returns {boolean}
 */
export function isOtpBulkInputType(inputType) {
  return OTP_BULK_INPUT_TYPES.has(inputType);
}

/**
 * Normalize pasted/autofill text into up to `length` digits.
 * @param {string} raw
 * @param {number} length
 * @returns {string}
 */
export function resolveOtpDigits(raw, length) {
  const extracted = extractOtpFromText(raw, length);
  if (extracted) return extracted;
  return String(raw ?? '').replace(/\D/g, '').slice(0, length);
}
