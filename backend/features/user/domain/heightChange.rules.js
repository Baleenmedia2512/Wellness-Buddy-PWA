/**
 * Profile height change rules — first set free; later changes need OTP.
 * Pure — no I/O.
 *
 * Legacy (not breaking): appVersion < HEIGHT_CHANGE_OTP_MIN_APP_VERSION or
 * missing version still applies height on POST /api/user/profile.
 * 3.5.0+ with the flag ON strips differing height updates and uses
 * POST /api/user/height/request-otp + verify-otp.
 */
import { isAtLeastVersion } from '../../app-version/domain/version.rules.js';

export const HEIGHT_CHANGE_OTP_FLAG = 'ff.height-change-otp';
export const HEIGHT_CHANGE_OTP_MIN_APP_VERSION = '3.5.0';
export const HEIGHT_CHANGE_OTP_MIN_CM = 50;
export const HEIGHT_CHANGE_OTP_MAX_CM = 198;

/**
 * @param {unknown} value
 * @returns {number|null}
 */
export function parseHeightCm(value) {
  if (value == null || value === '') return null;
  const n = typeof value === 'number' ? value : parseFloat(String(value).trim());
  if (!Number.isFinite(n)) return null;
  return n;
}

/**
 * True when the account already has a saved height in the allowed range.
 * @param {unknown} height
 * @param {{ min?: number, max?: number }} [opts]
 * @returns {boolean}
 */
export function isHeightLocked(height, {
  min = HEIGHT_CHANGE_OTP_MIN_CM,
  max = HEIGHT_CHANGE_OTP_MAX_CM,
} = {}) {
  const n = parseHeightCm(height);
  if (n == null) return false;
  return n >= min && n <= max;
}

/**
 * @param {unknown} a
 * @param {unknown} b
 * @returns {boolean}
 */
export function heightsDiffer(a, b) {
  const left = parseHeightCm(a);
  const right = parseHeightCm(b);
  if (left == null || right == null) return left !== right;
  return Math.abs(left - right) > 0.01;
}

/**
 * @param {unknown} value
 * @param {{ min?: number, max?: number }} [opts]
 * @returns {{ valid: boolean, value: number|null, message: string }}
 */
export function validateHeightCm(value, {
  min = HEIGHT_CHANGE_OTP_MIN_CM,
  max = HEIGHT_CHANGE_OTP_MAX_CM,
} = {}) {
  const n = parseHeightCm(value);
  if (n == null) {
    return { valid: false, value: null, message: `Please enter a valid height (${min} - ${max} cm).` };
  }
  if (n < min || n > max) {
    return { valid: false, value: null, message: `Please enter a valid height (${min} - ${max} cm).` };
  }
  return { valid: true, value: n, message: '' };
}

/**
 * New Profile clients skip applying a *changed* height on POST /api/user/profile
 * when a height is already locked. First-time set and unchanged values still apply.
 *
 * @param {{
 *   flagEnabled?: boolean,
 *   appVersion?: string|null,
 *   existingHeight?: unknown,
 *   newHeight?: unknown,
 *   minAppVersion?: string,
 * }} args
 * @returns {boolean}
 */
export function shouldDeferHeightChangeToOtp({
  flagEnabled = false,
  appVersion = null,
  existingHeight = null,
  newHeight = null,
  minAppVersion = HEIGHT_CHANGE_OTP_MIN_APP_VERSION,
} = {}) {
  if (!flagEnabled) return false;
  if (isAtLeastVersion(appVersion, minAppVersion) !== true) return false;
  if (newHeight == null || newHeight === '') return false;
  if (!isHeightLocked(existingHeight)) return false;
  return heightsDiffer(existingHeight, newHeight);
}

/**
 * Mask email for API responses (keep domain).
 * @param {string} email
 * @returns {string}
 */
export function maskEmailForDisplay(email) {
  const raw = String(email || '').trim().toLowerCase();
  const at = raw.indexOf('@');
  if (at < 1) return '***';
  const local = raw.slice(0, at);
  const domain = raw.slice(at + 1);
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}***@${domain}`;
}

/**
 * @param {string} phone
 * @returns {string}
 */
export function maskPhoneForDisplay(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length < 4) return '****';
  return `***${digits.slice(-4)}`;
}
