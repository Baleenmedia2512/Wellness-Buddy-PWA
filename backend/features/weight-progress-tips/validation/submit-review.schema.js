/**
 * submit-review.schema.js
 * Input validation for POST /api/weight-progress-tips/submit-review.
 *
 * Business rules:
 *   - followedPlan = true  → proofType + proofImageBase64 required
 *   - followedPlan = false → reason required; if reason = 'Other' → reasonOther required
 */
import { ValidationError } from '../../../shared/lib/ValidationError.js';

export const VALID_PROOF_TYPES = [
  'Meal Photo',
  'Workout Photo',
  'Water Tracking Screenshot',
  'Progress Photo',
  'Other',
];

export const VALID_REASONS = [
  'Missed Meals',
  'Busy Schedule',
  'Travel',
  'Forgot Tracking',
  'Lack of Motivation',
  'Medical Issue',
  'Other',
];

const VALID_GOAL_MODES = ['loss', 'gain', 'maintain'];

/**
 * Validate and normalise the submit-review request body.
 *
 * @param {object} body  Raw request body from the HTTP handler.
 * @returns {object}     Normalised, type-safe payload ready for the handler.
 * @throws {ValidationError}
 */
export function validateSubmitReview(body = {}) {
  const {
    userId,
    weightRecordId,
    goalMode,
    weightChange,
    followedPlan,
    proofType,
    proofImageBase64,
    reason,
    reasonOther,
    nutritionSnapshot,
  } = body;

  // ── Required base fields ──────────────────────────────────────────────────
  if (!userId) {
    throw new ValidationError(400, 'Missing required field: userId');
  }
  if (!weightRecordId) {
    throw new ValidationError(400, 'Missing required field: weightRecordId');
  }
  const parsedWeightRecordId = parseInt(weightRecordId, 10);
  if (!Number.isFinite(parsedWeightRecordId) || parsedWeightRecordId <= 0) {
    throw new ValidationError(400, 'weightRecordId must be a positive integer');
  }
  if (!goalMode || !VALID_GOAL_MODES.includes(goalMode)) {
    throw new ValidationError(400, `goalMode must be one of: ${VALID_GOAL_MODES.join(', ')}`);
  }
  if (weightChange == null || !Number.isFinite(parseFloat(weightChange))) {
    throw new ValidationError(400, 'weightChange must be a valid number');
  }
  if (followedPlan == null || typeof followedPlan !== 'boolean') {
    throw new ValidationError(400, 'followedPlan must be a boolean (true or false)');
  }

  // ── YES path constraints ──────────────────────────────────────────────────
  if (followedPlan === true) {
    if (!proofType || !VALID_PROOF_TYPES.includes(proofType)) {
      throw new ValidationError(
        400,
        `proofType is required when followedPlan is true. Allowed: ${VALID_PROOF_TYPES.join(', ')}`,
      );
    }
    if (!proofImageBase64) {
      throw new ValidationError(400, 'proofImageBase64 is required when followedPlan is true');
    }
  }

  // ── NO path constraints ───────────────────────────────────────────────────
  if (followedPlan === false) {
    if (!reason || !VALID_REASONS.includes(reason)) {
      throw new ValidationError(
        400,
        `reason is required when followedPlan is false. Allowed: ${VALID_REASONS.join(', ')}`,
      );
    }
    if (reason === 'Other' && !reasonOther?.trim()) {
      throw new ValidationError(400, 'reasonOther is required when reason is "Other"');
    }
  }

  return {
    userId: parseInt(userId, 10),
    weightRecordId: parsedWeightRecordId,
    goalMode,
    weightChange: parseFloat(weightChange),
    followedPlan,
    proofType: followedPlan ? (proofType || null) : null,
    proofImageBase64: followedPlan ? (proofImageBase64 || null) : null,
    reason: !followedPlan ? (reason || null) : null,
    reasonOther: (!followedPlan && reason === 'Other') ? (reasonOther?.trim() || null) : null,
    nutritionSnapshot: nutritionSnapshot || null,
  };
}
