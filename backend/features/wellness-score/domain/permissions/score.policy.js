/**
 * Admin-only access for wellness score configuration.
 */
import { ValidationError } from '../../../../shared/lib/ValidationError.js';

const ADMIN_ROLES = new Set(['admin', 'developer']);

/**
 * @param {{ Role?: string }|null|undefined} userRow
 * @returns {boolean}
 */
export function isWellnessScoreAdmin(userRow) {
  if (!userRow?.Role) return false;
  return ADMIN_ROLES.has(String(userRow.Role).toLowerCase());
}

/**
 * @param {{ Role?: string }|null|undefined} userRow
 */
export function assertWellnessScoreAdmin(userRow) {
  if (!isWellnessScoreAdmin(userRow)) {
    throw new ValidationError(403, 'Wellness Score Setup is restricted to admin and developer roles.');
  }
}
