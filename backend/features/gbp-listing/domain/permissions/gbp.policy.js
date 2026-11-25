/**
 * Admin/developer gate for Google Maps Listing ops queue.
 */
import { ValidationError } from '../../../../shared/lib/ValidationError.js';

const ADMIN_ROLES = new Set(['admin', 'developer']);

export function isGbpAdmin(userRow) {
  if (!userRow?.Role) return false;
  return ADMIN_ROLES.has(String(userRow.Role).toLowerCase());
}

export function assertGbpAdmin(userRow) {
  if (!isGbpAdmin(userRow)) {
    throw new ValidationError(
      403,
      'Google Maps Listing admin is restricted to admin and developer roles.',
    );
  }
}
