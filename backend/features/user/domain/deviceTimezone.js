/**
 * Resolve a client-reported IANA timezone for automatic profile sync.
 * Invalid or empty values fall back to Asia/Kolkata.
 */
import { assertIanaTimezone, IANA_IST } from '../../../shared/lib/datetime/index.js';

/**
 * @param {unknown} raw - Device timezone from client (may be missing/invalid).
 * @returns {string} Valid IANA timezone (defaults to Asia/Kolkata).
 */
export function resolveDeviceTimezoneIana(raw) {
  if (raw == null) return IANA_IST;
  const trimmed = String(raw).trim();
  if (!trimmed) return IANA_IST;
  try {
    return assertIanaTimezone(trimmed);
  } catch {
    return IANA_IST;
  }
}

/**
 * @param {unknown} raw
 * @returns {boolean} True when the client sent a timezone field (including empty string).
 */
export function hasDeviceTimezoneInput(raw) {
  return raw !== undefined && raw !== null;
}
