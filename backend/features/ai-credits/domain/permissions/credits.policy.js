/**
 * Admin/developer gate for AI credits configuration.
 */
import { ValidationError } from '../../../../shared/lib/ValidationError.js';

const ADMIN_ROLES = new Set(['admin', 'developer']);

export function isAiCreditsAdmin(userRow) {
  if (!userRow?.Role) return false;
  return ADMIN_ROLES.has(String(userRow.Role).toLowerCase());
}

export function assertAiCreditsAdmin(userRow) {
  if (!isAiCreditsAdmin(userRow)) {
    throw new ValidationError(403, 'AI Credits Setup is restricted to admin and developer roles.');
  }
}
