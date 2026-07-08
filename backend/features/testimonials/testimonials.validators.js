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
const DURATION_PATTERN = /^(\d+)\s+(days|months)$/i;
const MAX_DURATION_AMOUNT = 9999;

function validateDurationText(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) throw new ValidationError(400, 'durationText is required');
  const match = trimmed.match(DURATION_PATTERN);
  if (!match) {
    throw new ValidationError(422, 'durationText must be a number followed by "days" or "months" (e.g. "3 months")');
  }
  const amount = parseInt(match[1], 10);
  if (!Number.isFinite(amount) || amount < 1 || amount > MAX_DURATION_AMOUNT) {
    throw new ValidationError(422, `duration must be between 1 and ${MAX_DURATION_AMOUNT}`);
  }
  const normalized = `${amount} ${match[2].toLowerCase()}`;
  if (normalized.length > MAX_DURATION_LEN) {
    throw new ValidationError(422, `durationText must be <= ${MAX_DURATION_LEN} characters`);
  }
  return normalized;
}

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
  const normalizedDuration = validateDurationText(durationText);

  return {
    userId:              userIdN,
    beforeImageBase64,
    afterImageBase64:    afterImage,
    beforeWeightKg:      before,
    afterWeightKg:       after,
    goalType,
    durationText:        normalizedDuration,
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
    result.durationText = validateDurationText(durationText);
  }

  return result;
}

/**
 * Validate query params for GET /api/testimonials/list-for-coach
 */
export function validateListForCoach(query) {
  const { coachId, scope } = query || {};
  if (!coachId) throw new ValidationError(400, 'coachId is required');
  const coachIdN = parseInt(coachId, 10);
  if (isNaN(coachIdN) || coachIdN < 1) throw new ValidationError(400, 'coachId must be a valid integer');
  const normalizedScope = scope === 'full' ? 'full' : 'direct';
  return { coachId: coachIdN, scope: normalizedScope };
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

// ─── Video validators ─────────────────────────────────────────────────────────

// 1 min ≈ 15 MB binary → base64 overhead ×1.33 ≈ 20 MB base64
const MAX_HEALTH_VIDEO_BASE64  = 20 * 1024 * 1024;
// 2 min ≈ 30 MB binary → base64 overhead ×1.33 ≈ 40 MB base64
const MAX_BUSINESS_VIDEO_BASE64 = 40 * 1024 * 1024;

const ALLOWED_VIDEO_PREFIXES = [
  'data:video/mp4',
  'data:video/quicktime',
  'data:video/mov',
  'data:video/mpeg',
  'data:video/3gpp',
];

function validateOptionalBase64Video(value, fieldName, maxSize) {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') throw new ValidationError(422, `${fieldName} must be a string`);
  // Accept raw base64 or data-URI prefixed
  if (value.startsWith('data:')) {
    const hasAllowedPrefix = ALLOWED_VIDEO_PREFIXES.some((p) => value.startsWith(p));
    if (!hasAllowedPrefix) {
      throw new ValidationError(422, `${fieldName} must be a video file (mp4, mov, quicktime)`);
    }
  }
  if (value.length > maxSize) {
    const limitMb = Math.round(maxSize / (1024 * 1024));
    throw new ValidationError(422, `${fieldName} exceeds ${limitMb} MB limit`);
  }
  return value;
}

/**
 * Validate payload for POST /api/testimonials/submit-video
 * At least one of healthVideoBase64 / businessVideoBase64 must be present.
 */
export function validateSubmitVideo(body) {
  if (!body) throw new ValidationError(400, 'Request body is missing');

  const { userId, healthVideoBase64, businessVideoBase64 } = body;

  if (!userId) throw new ValidationError(400, 'userId is required');
  const userIdN = parseInt(userId, 10);
  if (isNaN(userIdN) || userIdN < 1) throw new ValidationError(400, 'userId must be a valid integer');

  const health   = validateOptionalBase64Video(healthVideoBase64,   'healthVideoBase64',   MAX_HEALTH_VIDEO_BASE64);
  const business = validateOptionalBase64Video(businessVideoBase64, 'businessVideoBase64', MAX_BUSINESS_VIDEO_BASE64);

  if (!health && !business) {
    throw new ValidationError(400, 'At least one video (health or business results) must be provided');
  }

  return { userId: userIdN, healthVideoBase64: health, businessVideoBase64: business };
}

/**
 * Validate payload for POST /api/testimonials/verify-video-otp
 */
export function validateVerifyVideoOtp(body) {
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
 * Validate query params for GET /api/testimonials/video-report
 */
export function validateVideoReport(query) {
  const { coachId, scope } = query || {};

  if (!coachId) throw new ValidationError(400, 'coachId is required');
  const coachIdN = parseInt(coachId, 10);
  if (isNaN(coachIdN) || coachIdN < 1) throw new ValidationError(400, 'coachId must be a valid integer');

  const allowedScopes = ['direct', 'full'];
  const normalizedScope = scope && allowedScopes.includes(scope) ? scope : 'direct';

  return { coachId: coachIdN, scope: normalizedScope };
}

