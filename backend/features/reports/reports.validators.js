/**
 * reports.validators.js — Input validation for the Reports feature.
 */
import { ValidationError } from '../../shared/lib/ValidationError.js';

/**
 * Validate and normalise query params for GET downline-weight-status.
 * @param {{ coachId?: string }} raw
 * @returns {{ coachId: number }}
 */
export function validateDownlineWeightStatus(raw) {
  const coachId = parseInt(raw?.coachId, 10);
  if (!coachId || isNaN(coachId) || coachId <= 0) {
    throw new ValidationError('coachId must be a positive integer', 400);
  }
  return { coachId };
}
