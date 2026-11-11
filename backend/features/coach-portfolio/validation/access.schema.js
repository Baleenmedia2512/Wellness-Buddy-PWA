import { ValidationError } from '../../../shared/lib/ValidationError.js';

/**
 * @param {unknown} raw
 * @returns {number}
 */
export function validateUserId(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) {
    throw new ValidationError(400, 'A valid userId is required');
  }
  return n;
}

/**
 * @param {unknown} raw
 * @returns {boolean}
 */
export function validatePaidFlag(raw) {
  if (typeof raw === 'boolean') return raw;
  if (raw === 'true' || raw === 1 || raw === '1') return true;
  if (raw === 'false' || raw === 0 || raw === '0') return false;
  throw new ValidationError(400, 'paid must be true or false');
}
