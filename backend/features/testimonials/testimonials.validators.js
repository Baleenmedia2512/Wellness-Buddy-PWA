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
const MEDICAL_CONDITION_MAX_LEN = 100;
const MEDICAL_CONDITION_PATTERN = /^[a-zA-Z0-9\s\-',./()]+$/;
const MAX_BASE64_SIZE = 1.5 * 1024 * 1024; // 1.5 MB base64 â‰ˆ 1 MB binary
const DURATION_PATTERN = /^(\d+)\s+(days|months)$/i;
const MAX_DURATION_AMOUNT = 9999;const MAX_HEALTH_ISSUES = 20;
const MAX_ISSUE_LEN = 120;
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

function validateMedicalCondition(value, { required = true } = {}) {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!trimmed) {
    if (required) throw new ValidationError(400, 'Please enter your medical condition.');
    return null;
  }
  if (trimmed.length > MEDICAL_CONDITION_MAX_LEN) {
    throw new ValidationError(422, `Medical condition must be ${MEDICAL_CONDITION_MAX_LEN} characters or fewer.`);
  }
  if (!MEDICAL_CONDITION_PATTERN.test(trimmed)) {
    throw new ValidationError(422, 'Only letters, numbers, spaces, and - \' , . / ( ) are allowed.');
  }
  return trimmed;
}

/**
 * Validate payload for POST /api/testimonials/submit
 * After photo + weight are optional â€” omitting them creates an 'incomplete' record.
 */
export function validateSubmitTestimonial(body) {
  if (!body) throw new ValidationError(400, 'Request body is missing');

  const { userId, beforeImageBase64, afterImageBase64, beforeWeightKg, afterWeightKg, goalType, durationText, recoveredHealthIssues } = body;

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
  const normalizedMedicalCondition = validateMedicalCondition(medicalCondition, { required: true });

  return {
    userId:                userIdN,
    beforeImageBase64,
    afterImageBase64:      afterImage,
    beforeWeightKg:        before,
    afterWeightKg:         after,
    goalType,
    durationText:          normalizedDuration,
    hasAfter,
    recoveredHealthIssues: validateRecoveredHealthIssues(recoveredHealthIssues),
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

  const { userId, beforeImageBase64, afterImageBase64, beforeWeightKg, afterWeightKg, goalType, durationText, recoveredHealthIssues } = body;

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
  if (recoveredHealthIssues !== undefined) {
    result.recoveredHealthIssues = validateRecoveredHealthIssues(recoveredHealthIssues);
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

// Binary size limits for direct storage uploads (not base64)
export const MAX_HEALTH_VIDEO_BYTES   = 20 * 1024 * 1024;
export const MAX_BUSINESS_VIDEO_BYTES = 40 * 1024 * 1024;

function validateOptionalVideoPath(value, fieldName, userId, slot) {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') throw new ValidationError(422, `${fieldName} must be a string`);

  const prefix = slot === 'health'
    ? `${userId}/health_video_`
    : `${userId}/business_video_`;
  const pattern = new RegExp(`^${prefix}[\\w-]+\\.mp4$`);
  if (!pattern.test(value)) {
    throw new ValidationError(422, `${fieldName} is invalid`);
  }
  return value;
}

/**
 * Validate payload for POST /api/testimonials/prepare-video-upload
 */
export function validatePrepareVideoUpload(body) {
  if (!body) throw new ValidationError(400, 'Request body is missing');

  const { userId, uploadHealth, uploadBusiness } = body;

  if (!userId) throw new ValidationError(400, 'userId is required');
  const userIdN = parseInt(userId, 10);
  if (isNaN(userIdN) || userIdN < 1) throw new ValidationError(400, 'userId must be a valid integer');

  const wantsHealth = uploadHealth === true;
  const wantsBusiness = uploadBusiness === true;
  if (!wantsHealth && !wantsBusiness) {
    throw new ValidationError(400, 'At least one video slot must be requested');
  }

  return { userId: userIdN, uploadHealth: wantsHealth, uploadBusiness: wantsBusiness };
}

/**
 * Validate payload for POST /api/testimonials/submit-video
 * At least one of healthVideoPath / businessVideoPath must be present.
 * Videos are uploaded directly to storage; this endpoint only finalises paths + OTP.
 */
export function validateSubmitVideo(body) {
  if (!body) throw new ValidationError(400, 'Request body is missing');

  const { userId, healthVideoPath, businessVideoPath } = body;

  if (!userId) throw new ValidationError(400, 'userId is required');
  const userIdN = parseInt(userId, 10);
  if (isNaN(userIdN) || userIdN < 1) throw new ValidationError(400, 'userId must be a valid integer');

  const health = validateOptionalVideoPath(healthVideoPath, 'healthVideoPath', userIdN, 'health');
  const business = validateOptionalVideoPath(businessVideoPath, 'businessVideoPath', userIdN, 'business');

  if (!health && !business) {
    throw new ValidationError(400, 'At least one video (health or business results) must be provided');
  }

  return { userId: userIdN, healthVideoPath: health, businessVideoPath: business };
}

// ~2 MB binary chunk → ~2.7 MB base64, safely under Vercel's ~4.5 MB body limit
const MAX_CHUNK_BASE64_LEN = 3.5 * 1024 * 1024;

/**
 * Validate payload for POST /api/testimonials/upload-video-chunk
 */
export function validateUploadVideoChunk(body) {
  if (!body) throw new ValidationError(400, 'Request body is missing');

  const {
    userId,
    sessionId,
    slot,
    chunkIndex,
    totalChunks,
    chunkBase64,
    finalPath,
  } = body;

  if (!userId) throw new ValidationError(400, 'userId is required');
  const userIdN = parseInt(userId, 10);
  if (isNaN(userIdN) || userIdN < 1) throw new ValidationError(400, 'userId must be a valid integer');

  if (!sessionId || typeof sessionId !== 'string') {
    throw new ValidationError(400, 'sessionId is required');
  }
  if (!/^[0-9a-f-]{36}$/i.test(sessionId)) {
    throw new ValidationError(422, 'sessionId is invalid');
  }

  if (slot !== 'health' && slot !== 'business') {
    throw new ValidationError(422, 'slot must be "health" or "business"');
  }

  const chunkIndexN = parseInt(chunkIndex, 10);
  const totalChunksN = parseInt(totalChunks, 10);
  if (!Number.isFinite(chunkIndexN) || chunkIndexN < 0) {
    throw new ValidationError(422, 'chunkIndex must be a non-negative integer');
  }
  if (!Number.isFinite(totalChunksN) || totalChunksN < 1) {
    throw new ValidationError(422, 'totalChunks must be at least 1');
  }
  if (chunkIndexN >= totalChunksN) {
    throw new ValidationError(422, 'chunkIndex must be less than totalChunks');
  }

  if (!chunkBase64 || typeof chunkBase64 !== 'string') {
    throw new ValidationError(400, 'chunkBase64 is required');
  }
  if (chunkBase64.length > MAX_CHUNK_BASE64_LEN) {
    throw new ValidationError(422, 'Video chunk is too large. Please retry the upload.');
  }

  const validatedPath = validateOptionalVideoPath(finalPath, 'finalPath', userIdN, slot);
  if (!validatedPath) {
    throw new ValidationError(400, 'finalPath is required');
  }

  const expectedPath = `${userIdN}/${slot === 'health' ? 'health' : 'business'}_video_${sessionId}.mp4`;
  if (validatedPath !== expectedPath) {
    throw new ValidationError(422, 'finalPath does not match upload session');
  }

  return {
    userId: userIdN,
    sessionId,
    slot,
    chunkIndex: chunkIndexN,
    totalChunks: totalChunksN,
    chunkBase64,
    finalPath: validatedPath,
  };
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

/**
 * Validate query params for GET /api/testimonials/team-report
 */
export function validateTeamReport(query) {
  const { coachId } = query || {};
  if (!coachId) throw new ValidationError(400, 'coachId is required');
  const coachIdN = parseInt(coachId, 10);
  if (isNaN(coachIdN) || coachIdN < 1) throw new ValidationError(400, 'coachId must be a valid integer');
  return { coachId: coachIdN };
}

