/**
 * Admin/developer gate for Coach Website portfolio access management.
 */
import { ValidationError } from '../../../../shared/lib/ValidationError.js';

const ADMIN_ROLES = new Set(['admin', 'developer']);

/**
 * @param {{ Role?: string|null }|null|undefined} userRow
 * @returns {boolean}
 */
export function isPortfolioAdmin(userRow) {
  if (!userRow?.Role) return false;
  return ADMIN_ROLES.has(String(userRow.Role).toLowerCase());
}

/**
 * @param {{ Role?: string|null }|null|undefined} userRow
 */
export function assertPortfolioAdmin(userRow) {
  if (!isPortfolioAdmin(userRow)) {
    throw new ValidationError(
      403,
      'Coach Website access is restricted to admin and developer roles.',
    );
  }
}
