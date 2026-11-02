/**
 * Admin/developer gate for custom-food Excel export + nutrition fill-in.
 */
import { ValidationError } from '../../../../shared/lib/ValidationError.js';

const ADMIN_ROLES = new Set(['admin', 'developer']);

export function isNutritionKnowledgeAdmin(userRow) {
  if (!userRow?.Role) return false;
  return ADMIN_ROLES.has(String(userRow.Role).toLowerCase());
}

export function assertNutritionKnowledgeAdmin(userRow) {
  if (!isNutritionKnowledgeAdmin(userRow)) {
    throw new ValidationError(
      403,
      'Custom food export / nutrition fill-in is restricted to admin and developer roles.',
    );
  }
}
