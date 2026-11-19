/**
 * Profile height change OTP — first set free; later changes need OTP.
 * Mirrors backend HEIGHT_CHANGE_OTP_FLAG / version routing.
 */
export const HEIGHT_CHANGE_OTP_FLAG = 'ff.height-change-otp';

export const HEIGHT_MIN_CM = 50;
export const HEIGHT_MAX_CM = 198;

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
 * Saved height in range → lock field (pencil + OTP to change).
 * @param {unknown} height
 * @returns {boolean}
 */
export function isHeightLocked(height) {
  const n = parseHeightCm(height);
  if (n == null) return false;
  return n >= HEIGHT_MIN_CM && n <= HEIGHT_MAX_CM;
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
 * @returns {{ valid: boolean, value: number|null, message: string }}
 */
export function validateHeightCm(value) {
  const n = parseHeightCm(value);
  if (n == null || n < HEIGHT_MIN_CM || n > HEIGHT_MAX_CM) {
    return {
      valid: false,
      value: null,
      message: `Please enter a valid height (${HEIGHT_MIN_CM} - ${HEIGHT_MAX_CM} cm).`,
    };
  }
  return { valid: true, value: n, message: '' };
}
