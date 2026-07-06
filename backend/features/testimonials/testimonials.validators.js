/**
 * testimonials.validators.js â€” Input validation for the testimonials feature.
 * Uses the same manual-validation pattern as other features in this codebase.
 *
 * Partial submission is allowed:
 *   - beforeImageBase64 + beforeWeightKg + goalType + durationText â†’ status: 'incomplete'
 *   - Adding afterImageBase64 + afterWeightKg (on submit or edit)  â†’ status: 'pending' + email coach
 */
import { ValidationError } from '../../shared/lib/ValidationError.js';

const GOAL_TYPES = ['loss', 'gain'];
const MAX_DURATION_LEN = 100;
const MAX_BASE64_SIZE = 1.5 * 1024 * 1024; // 1.5 MB base64 â‰ˆ 1 MB binary

function validateBase64Image(value, fieldName) {
  if (!value || typeof value !== 'string') throw new ValidationError(400, `${fieldName} is required`);
  if (value.length > MAX_BASE64_SIZE) throw new ValidationError(422, `${fieldName} exceeds 1 MB limit`);
}

function validateOptionalBase64Image(value, fieldName) {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') throw new ValidationError(422, `${fieldName} must be a string`);
  if (value.length > MAX_BASE64_SIZE) throw new ValidationError(422, `${fieldName} exceeds 1 MB limit`);
  return value;
}

function validateWeight(value, fieldName) {
  const n = parseFloat(value);
  if (isNaN(n) || n <= 0 || n > 500) throw new ValidationError(422, `${fieldName} must be a positive number â‰¤ 500`);
  return n;
}

/**
 * Validate payload for POST /api/testimonials/submit
 * After photo + weight are optional â€” omitting them creates an 'incomplete' record.
 */
export function validateSubmitTestimonial(body) {
  if (!body) throw new ValidationError(400, 'Request body is missing');

  const { userId, beforeImageBase64, afterImageBase64, beforeWeightKg, afterWeightKg, goalType, durationText } = body;

  if (!userId) throw new ValidationError(400, 'userId is required');
  const userIdN = parseInt(userId, 10);
  if (isNaN(userIdN) || userIdN < 1) throw new ValidationError(400, 'userId must be a valid integer');

  validateBase64Image(beforeImageBase64, 'beforeImageBase64');

  const afterImage = validateOptionalBase64Image(afterImageBase64, 'afterImageBase64');
  const hasAfter   = !!afterImage;

  const before = validateWeight(beforeWeightKg, 'beforeWeightKg');
  const after  = hasAfter ? validateWeight(afterWeightKg, 'afterWeightKg') : null;

  if (!goalType || !GOAL_TYPES.includes(goalType)) {
    throw new ValidationError(422, `goalType must be one of: ${GOAL_TYPES.join(', ')}`);
  }
  if (!durationText || String(durationText).trim() === '') throw new ValidationError(400, 'durationText is required');
  if (String(durationText).trim().length > MAX_DURATION_LEN) {
    throw new ValidationError(422, `durationText must be â‰¤ ${MAX_DURATION_LEN} characters`);
  }

  return {
    userId:              userIdN,
    beforeImageBase64,
    afterImageBase64:    afterImage,
    beforeWeightKg:      before,
    afterWeightKg:       after,
    goalType,
    durationText:        String(durationText).trim(),
    hasAfter,
  };
}

/**
 * Validate payload for POST /api/testimonials/verify-otp
 */
export function validateVerifyOtp(body) {
  if (!body) throw new ValidationError(400, 'Request body is missing');

  const { testimonialId, otp } = body;

  if (!testimonialId) throw new ValidationError(400, 'testimonialId is required');
  const idN = parseInt(testimonialId, 10);
  if (isNaN(idN) || idN < 1) throw new ValidationError(400, 'testimonialId must be a valid integer');

  if (!otp || typeof otp !== 'string') throw new ValidationError(400, 'otp is required');
  if (!/^\d{6}$/.test(otp.trim())) throw new ValidationError(422, 'otp must be a 6-digit number');

  return { testimonialId: idN, otp: otp.trim() };
}

/**
 * Validate payload for POST /api/testimonials/edit
 * All fields optional â€” only provided ones are updated.
 * If afterImageBase64 + afterWeightKg are now present, status upgrades to 'pending'.
 */
export function validateEditTestimonial(body) {
  if (!body) throw new ValidationError(400, 'Request body is missing');

  const { userId, beforeImageBase64, afterImageBase64, beforeWeightKg, afterWeightKg, goalType, durationText } = body;

  if (!userId) throw new ValidationError(400, 'userId is required');
  const userIdN = parseInt(userId, 10);
  if (isNaN(userIdN) || userIdN < 1) throw new ValidationError(400, 'userId must be a valid integer');

  const result = { userId: userIdN };

  if (beforeImageBase64 !== undefined) {
    validateBase64Image(beforeImageBase64, 'beforeImageBase64');
    result.beforeImageBase64 = beforeImageBase64;
  }
  const afterImage = validateOptionalBase64Image(afterImageBase64, 'afterImageBase64');
  if (afterImage !== undefined) result.afterImageBase64 = afterImage;

  if (beforeWeightKg !== undefined) result.beforeWeightKg = validateWeight(beforeWeightKg, 'beforeWeightKg');
  if (afterWeightKg  !== undefined) result.afterWeightKg  = validateWeight(afterWeightKg,  'afterWeightKg');

  if (goalType !== undefined) {
    if (!GOAL_TYPES.includes(goalType)) throw new ValidationError(422, `goalType must be one of: ${GOAL_TYPES.join(', ')}`);
    result.goalType = goalType;
  }
  if (durationText !== undefined) {
    if (String(durationText).trim() === '') throw new ValidationError(422, 'durationText cannot be empty');
    if (String(durationText).trim().length > MAX_DURATION_LEN) throw new ValidationError(422, `durationText must be â‰¤ ${MAX_DURATION_LEN} characters`);
    result.durationText = String(durationText).trim();
  }

  return result;
}

/**
 * Validate query params for GET /api/testimonials/list-for-coach
 */
export function validateListForCoach(query) {
  const { coachId } = query || {};
  if (!coachId) throw new ValidationError(400, 'coachId is required');
  const coachIdN = parseInt(coachId, 10);
  if (isNaN(coachIdN) || coachIdN < 1) throw new ValidationError(400, 'coachId must be a valid integer');
  return { coachId: coachIdN };
}

/**
 * Validate query params for GET /api/testimonials/my-testimonial
 */
export function validateMyTestimonial(query) {
  const { userId } = query || {};
  if (!userId) throw new ValidationError(400, 'userId is required');
  const userIdN = parseInt(userId, 10);
  if (isNaN(userIdN) || userIdN < 1) throw new ValidationError(400, 'userId must be a valid integer');
  return { userId: userIdN };
}
