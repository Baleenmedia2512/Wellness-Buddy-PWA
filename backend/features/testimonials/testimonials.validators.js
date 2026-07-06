/**
 * testimonials.validators.js — Input validation for the testimonials feature.
 * Uses the same manual-validation pattern as other features in this codebase.
 */
import { ValidationError } from '../../shared/lib/ValidationError.js';

const GOAL_TYPES = ['loss', 'gain'];
const MAX_DURATION_LEN = 100;
const MAX_BASE64_SIZE = 1.5 * 1024 * 1024; // 1.5 MB base64 encodes ~1 MB binary

/**
 * Validate payload for POST /api/testimonials/submit
 */
export function validateSubmitTestimonial(body) {
  if (!body) throw new ValidationError(400, 'Request body is missing');

  const {
    userId,
    beforeImageBase64,
    afterImageBase64,
    beforeWeightKg,
    afterWeightKg,
    goalType,
    durationText,
  } = body;

  if (!userId) throw new ValidationError(400, 'userId is required');
  const userIdN = parseInt(userId, 10);
  if (isNaN(userIdN) || userIdN < 1) throw new ValidationError(400, 'userId must be a valid integer');

  if (!beforeImageBase64 || typeof beforeImageBase64 !== 'string') {
    throw new ValidationError(400, 'beforeImageBase64 is required');
  }
  if (beforeImageBase64.length > MAX_BASE64_SIZE) {
    throw new ValidationError(422, 'Before image exceeds 1 MB limit');
  }

  if (!afterImageBase64 || typeof afterImageBase64 !== 'string') {
    throw new ValidationError(400, 'afterImageBase64 is required');
  }
  if (afterImageBase64.length > MAX_BASE64_SIZE) {
    throw new ValidationError(422, 'After image exceeds 1 MB limit');
  }

  const before = parseFloat(beforeWeightKg);
  if (isNaN(before) || before <= 0 || before > 500) {
    throw new ValidationError(422, 'beforeWeightKg must be a positive number ≤ 500');
  }

  const after = parseFloat(afterWeightKg);
  if (isNaN(after) || after <= 0 || after > 500) {
    throw new ValidationError(422, 'afterWeightKg must be a positive number ≤ 500');
  }

  if (!goalType || !GOAL_TYPES.includes(goalType)) {
    throw new ValidationError(422, `goalType must be one of: ${GOAL_TYPES.join(', ')}`);
  }

  if (!durationText || String(durationText).trim() === '') {
    throw new ValidationError(400, 'durationText is required');
  }
  if (String(durationText).trim().length > MAX_DURATION_LEN) {
    throw new ValidationError(422, `durationText must be ≤ ${MAX_DURATION_LEN} characters`);
  }

  return {
    userId: userIdN,
    beforeImageBase64,
    afterImageBase64,
    beforeWeightKg: before,
    afterWeightKg: after,
    goalType,
    durationText: String(durationText).trim(),
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
 * All image/weight/goal/duration fields are optional — only provided ones are updated.
 */
export function validateEditTestimonial(body) {
  if (!body) throw new ValidationError(400, 'Request body is missing');

  const {
    userId,
    beforeImageBase64,
    afterImageBase64,
    beforeWeightKg,
    afterWeightKg,
    goalType,
    durationText,
  } = body;

  if (!userId) throw new ValidationError(400, 'userId is required');
  const userIdN = parseInt(userId, 10);
  if (isNaN(userIdN) || userIdN < 1) throw new ValidationError(400, 'userId must be a valid integer');

  const result = { userId: userIdN };

  if (beforeImageBase64 !== undefined) {
    if (typeof beforeImageBase64 !== 'string') throw new ValidationError(422, 'beforeImageBase64 must be a string');
    if (beforeImageBase64.length > MAX_BASE64_SIZE) throw new ValidationError(422, 'Before image exceeds 1 MB limit');
    result.beforeImageBase64 = beforeImageBase64;
  }
  if (afterImageBase64 !== undefined) {
    if (typeof afterImageBase64 !== 'string') throw new ValidationError(422, 'afterImageBase64 must be a string');
    if (afterImageBase64.length > MAX_BASE64_SIZE) throw new ValidationError(422, 'After image exceeds 1 MB limit');
    result.afterImageBase64 = afterImageBase64;
  }
  if (beforeWeightKg !== undefined) {
    const v = parseFloat(beforeWeightKg);
    if (isNaN(v) || v <= 0 || v > 500) throw new ValidationError(422, 'beforeWeightKg must be a positive number ≤ 500');
    result.beforeWeightKg = v;
  }
  if (afterWeightKg !== undefined) {
    const v = parseFloat(afterWeightKg);
    if (isNaN(v) || v <= 0 || v > 500) throw new ValidationError(422, 'afterWeightKg must be a positive number ≤ 500');
    result.afterWeightKg = v;
  }
  if (goalType !== undefined) {
    if (!GOAL_TYPES.includes(goalType)) throw new ValidationError(422, `goalType must be one of: ${GOAL_TYPES.join(', ')}`);
    result.goalType = goalType;
  }
  if (durationText !== undefined) {
    if (String(durationText).trim() === '') throw new ValidationError(422, 'durationText cannot be empty');
    if (String(durationText).trim().length > MAX_DURATION_LEN) throw new ValidationError(422, `durationText must be ≤ ${MAX_DURATION_LEN} characters`);
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
