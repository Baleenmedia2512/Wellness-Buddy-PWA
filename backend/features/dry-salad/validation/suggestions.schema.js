/**
 * backend/features/dry-salad/validation/suggestions.schema.js
 */
import { ValidationError } from '../../../shared/lib/ValidationError.js';
import { normalizeDrySaladSlot } from '../domain/timeSlots.rules.js';

/**
 * @param {object} [query]
 * @returns {{ userId: string, slot: string|null }}
 */
export function validateSuggestionsQuery(query = {}) {
  if (!query?.userId) throw new ValidationError(400, 'userId is required');
  return {
    userId: String(query.userId),
    slot: normalizeDrySaladSlot(query.slot),
  };
}
