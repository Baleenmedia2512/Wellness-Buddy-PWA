/**
 * Consent gate rules — pure domain (no I/O).
 * Current form version must match frontend/src/features/user/domain/consent.js
 */

export const CURRENT_CONSENT_VERSION = '2026-07-31';

export const CONSENT_REQUIRED_MESSAGE =
  'You must accept the User Consent Form before using Wellness Valley.';

export const CONSENT_DECLINED_MESSAGE =
  'You did not agree to the User Consent Form. You cannot use Wellness Valley’s health and coaching features.';

/**
 * @param {{ consentAccepted?: boolean, consentVersion?: string }} input
 * @returns {boolean}
 */
export function hasValidConsentAcceptance(input = {}) {
  return input.consentAccepted === true
    && String(input.consentVersion || '') === CURRENT_CONSENT_VERSION;
}

/**
 * @param {{ ConsentAcceptedAt?: string|null, consentAcceptedAt?: string|null }|null|undefined} row
 * @returns {boolean}
 */
export function isConsentRecorded(row) {
  if (!row || typeof row !== 'object') return false;
  const at = row.ConsentAcceptedAt ?? row.consentAcceptedAt ?? null;
  return at != null && String(at).trim() !== '';
}

/**
 * Fields to set on team_table when creating a user who has just consented.
 * @param {string} acceptedAtUtc — ISO / DB timestamp from nowUtc()
 * @param {{ version?: string, ipAddress?: string|null, deviceInfo?: string|null }} [meta]
 */
export function consentInsertFields(acceptedAtUtc, meta = {}) {
  const version = typeof meta === 'string'
    ? meta
    : (meta.version || CURRENT_CONSENT_VERSION);
  const ipAddress = typeof meta === 'string' ? null : (meta.ipAddress || null);
  const deviceInfo = typeof meta === 'string' ? null : (meta.deviceInfo || null);
  return {
    ConsentAcceptedAt: acceptedAtUtc,
    ConsentVersion: version,
    ConsentIpAddress: ipAddress ? String(ipAddress).slice(0, 64) : null,
    ConsentDeviceInfo: deviceInfo ? String(deviceInfo).slice(0, 500) : null,
  };
}
