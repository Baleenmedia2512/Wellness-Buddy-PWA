/**
 * check-progress.schema.js — Input validation for weight progress check API.
 */
import { ValidationError } from '../../../shared/lib/ValidationError.js';

export function validateCheckProgress(query) {
  const userId = query?.userId;
  const currentWeightId = query?.currentWeightId;

  if (!userId) {
    throw new ValidationError(400, 'Missing required parameter: userId');
  }

  return {
    userId: parseInt(userId, 10),
    currentWeightId: currentWeightId ? parseInt(currentWeightId, 10) : null,
  };
}
