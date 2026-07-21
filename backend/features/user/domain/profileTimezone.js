/**
 * Profile timezone resolution — pure helper, no I/O.
 */
import { IANA_IST } from '../../../shared/lib/datetime/index.js';

/**
 * Resolve a stored timezone value for API responses.
 * Falls back to Asia/Kolkata when missing or empty.
 *
 * @param {string|null|undefined} raw
 * @returns {string} IANA timezone identifier
 */
export function resolveProfileTimezone(raw) {
  const value = raw == null ? '' : String(raw).trim();
  return value || IANA_IST;
}
