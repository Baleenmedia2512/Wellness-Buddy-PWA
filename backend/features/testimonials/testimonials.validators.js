/**
 * testimonials.validators.js â€” Input validation for the testimonials feature.
 * Uses the same manual-validation pattern as other features in this codebase.
 *
 * Partial submission is allowed:
 *   - beforeImageBase64 + beforeWeightKg + goalType + durationText â†’ status: 'incomplete'
 *   - Adding afterImageBase64 + afterWeightKg (on submit or edit)  â†’ status: 'pending' + email coach
 */
import { ValidationError } from '../../shared/lib/ValidationError.js';
import { isValidEmailOtp } from '../auth/domain/otp-length.rules.js';
import { normalizeTestimonialsListPagination } from './domain/testimonials-list.pagination.js';

const GOAL_TYPES = ['loss', 'gain'];
const MAX_DURATION_LEN = 100;
const MAX_BASE64_SIZE = 1.5 * 1024 * 1024; // 1.5 MB base64 â‰ˆ 1 MB binary
const DURATION_PATTERN = /^(\d+)\s+(days|months)$/i;
const MAX_DURATION_AMOUNT = 9999;
const MAX_HEALTH_ISSUES = 20;
const MAX_ISSUE_LEN = 120;

function normalizeRecoveredHealthIssues(body) {
  if (!body || typeof body !== 'object') return undefined;
  if (body.recoveredHealthIssues !== undefined) return body.recoveredHealthIssues;
  // Legacy clients sent a single medicalCondition string before multi-select health issues.
  const legacy = body.medicalCondition;
  if (legacy === undefined || legacy === null || legacy === '') return undefined;
  if (Array.isArray(legacy)) return legacy;
  if (typeof legacy === 'string') return [legacy];
  return undefined;
}

function validateRecoveredHealthIssues(value, { required = false } = {}) {
  if (value === undefined || value === null) {
    if (required) {
      throw new ValidationError(422, 'At least one recovered health issue is required');
    }
    return [];
  }
  if (!Array.isArray(value)) {
    throw new ValidationError(422, 'recoveredHealthIssues must be an array');
  }
  if (value.length > MAX_HEALTH_ISSUES) {
    throw new ValidationError(422, `recoveredHealthIssues must have at most ${MAX_HEALTH_ISSUES} items`);
  }

  const seen = new Set();
  const result = [];
  for (const item of value) {
    if (typeof item !== 'string') {
      throw new ValidationError(422, 'Each recovered health issue must be a string');
    }
    const trimmed = item.trim();
    if (!trimmed) {
      throw new ValidationError(422, 'Recovered health issue labels cannot be empty');
    }
    if (trimmed.length > MAX_ISSUE_LEN) {
      throw new ValidationError(422, `Each recovered health issue must be <= ${MAX_ISSUE_LEN} characters`);
    }
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }

  if (required && result.length === 0) {
    throw new ValidationError(422, 'At least one recovered health issue is required');
  }
  return result;
}

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
  const recoveredHealthIssues = normalizeRecoveredHealthIssues(body);

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
    userId:                userIdN,
    beforeImageBase64,
    afterImageBase64:      afterImage,
    beforeWeightKg:        before,
    afterWeightKg:         after,
    goalType,
    durationText:          normalizedDuration,
    hasAfter,
    recoveredHealthIssues: validateRecoveredHealthIssues(recoveredHealthIssues, { required: hasAfter }),
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
  if (!isValidEmailOtp(otp.trim())) throw new ValidationError(422, 'otp must be a 4-digit number');

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
  const recoveredHealthIssues = normalizeRecoveredHealthIssues(body);

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
 * Supports page/limit/search/scope/uploadFilter for server-side pagination.
 */
export function validateListForCoach(query) {
  const normalized = normalizeTestimonialsListPagination(query || {});
  if (!normalized.coachId) throw new ValidationError(400, 'coachId is required');
  // Mine scope is frontend-only (my-testimonial); list API treats it as direct empty-safe.
  const scope = normalized.scope === 'full' ? 'full' : 'direct';
  return {
    coachId: normalized.coachId,
    scope,
    page: normalized.page,
    limit: normalized.limit,
    search: normalized.search,
    healthIssue: normalized.healthIssue,
    uploadFilter: normalized.uploadFilter,
  };
}

/**
 * Validate query params for GET /api/testimonials/detail
 */
export function validateTestimonialDetail(query) {
  const { userId, coachId } = query || {};
  if (!userId) throw new ValidationError(400, 'userId is required');
  const userIdN = parseInt(userId, 10);
  if (isNaN(userIdN) || userIdN < 1) throw new ValidationError(400, 'userId must be a valid integer');

  let coachIdN = null;
  if (coachId != null && coachId !== '') {
    coachIdN = parseInt(coachId, 10);
    if (isNaN(coachIdN) || coachIdN < 1) {
      throw new ValidationError(400, 'coachId must be a valid integer');
    }
  }
  return { userId: userIdN, coachId: coachIdN };
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

// Binary size limits for direct storage uploads (not base64).
export const MAX_HEALTH_VIDEO_BYTES   = 15 * 1024 * 1024;
export const MAX_BUSINESS_VIDEO_BYTES = 15 * 1024 * 1024;

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

  const wantsHealth   = uploadHealth   === true || uploadHealth   === 'true';
  const wantsBusiness = uploadBusiness === true || uploadBusiness === 'true';
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

  const { userId, healthVideoPath, businessVideoPath, recoveredHealthIssues } = body;

  if (!userId) throw new ValidationError(400, 'userId is required');
  const userIdN = parseInt(userId, 10);
  if (isNaN(userIdN) || userIdN < 1) throw new ValidationError(400, 'userId must be a valid integer');

  const health = validateOptionalVideoPath(healthVideoPath, 'healthVideoPath', userIdN, 'health');
  const business = validateOptionalVideoPath(businessVideoPath, 'businessVideoPath', userIdN, 'business');

  if (!health && !business) {
    throw new ValidationError(400, 'At least one video (health or business results) must be provided');
  }

  const result = { userId: userIdN, healthVideoPath: health, businessVideoPath: business };
  if (recoveredHealthIssues !== undefined) {
    result.recoveredHealthIssues = validateRecoveredHealthIssues(recoveredHealthIssues);
  }
  return result;
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
  if (!isValidEmailOtp(otp.trim())) throw new ValidationError(422, 'otp must be a 4-digit number');

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

// ─── Unified edit + OTP validators ───────────────────────────────────────────

const VALID_DIRTY_SLOTS = new Set(['before', 'after', 'health', 'business', 'issues']);

/**
 * Validate payload for POST /api/testimonials/submit-all-edits
 * Accepts all dirty slots in one payload and generates a single unified OTP.
 * Videos are pre-uploaded to storage; only their storage paths are sent here.
 */
export function validateSubmitAllEdits(body) {
  if (!body) throw new ValidationError(400, 'Request body is missing');

  const {
    userId,
    dirtySlots,
    beforeImageBase64,
    afterImageBase64,
    beforeWeightKg,
    afterWeightKg,
    goalType,
    durationText,
    healthVideoPath,
    businessVideoPath,
  } = body;
  const recoveredHealthIssues = normalizeRecoveredHealthIssues(body);

  if (!userId) throw new ValidationError(400, 'userId is required');
  const userIdN = parseInt(userId, 10);
  if (isNaN(userIdN) || userIdN < 1) throw new ValidationError(400, 'userId must be a valid integer');

const hasDirtySlots =
  Array.isArray(dirtySlots) && dirtySlots.length > 0;

const hasOtherChanges =
  beforeWeightKg !== undefined ||
  afterWeightKg !== undefined ||
  goalType !== undefined ||
  durationText !== undefined;

if (!hasDirtySlots && !hasOtherChanges) {
  throw new ValidationError(400, 'No changes were submitted.');
}

if (Array.isArray(dirtySlots)) {
  for (const s of dirtySlots) {
    if (!VALID_DIRTY_SLOTS.has(s)) {
      throw new ValidationError(
        422,
        `Invalid slot: "${s}". Must be one of: ${[...VALID_DIRTY_SLOTS].join(', ')}`
      );
    }
  }
}

  //const slots = new Set(dirtySlots);
  //const result = { userId: userIdN, dirtySlots: [...slots] };

  const slots = new Set(Array.isArray(dirtySlots) ? dirtySlots : []);
const result = {
  userId: userIdN,
  dirtySlots: [...slots],
};

  if (slots.has('before')) {
    validateBase64Image(beforeImageBase64, 'beforeImageBase64');
    result.beforeImageBase64 = beforeImageBase64;
  }

  if (slots.has('after')) {
    const afterImg = validateOptionalBase64Image(afterImageBase64, 'afterImageBase64');
    if (!afterImg) throw new ValidationError(400, 'afterImageBase64 is required when "after" is in dirtySlots');
    result.afterImageBase64 = afterImg;
  }

  if (slots.has('health')) {
    const hPath = validateOptionalVideoPath(healthVideoPath, 'healthVideoPath', userIdN, 'health');
    if (!hPath) throw new ValidationError(400, 'healthVideoPath is required when "health" is in dirtySlots');
    result.healthVideoPath = hPath;
  }

  if (slots.has('business')) {
    const bPath = validateOptionalVideoPath(businessVideoPath, 'businessVideoPath', userIdN, 'business');
    if (!bPath) throw new ValidationError(400, 'businessVideoPath is required when "business" is in dirtySlots');
    result.businessVideoPath = bPath;
  }

  if (slots.has('issues')) {
    if (recoveredHealthIssues === undefined) {
      throw new ValidationError(400, 'recoveredHealthIssues is required when "issues" is in dirtySlots');
    }
    result.recoveredHealthIssues = validateRecoveredHealthIssues(recoveredHealthIssues);
  } else if (recoveredHealthIssues !== undefined) {
    result.recoveredHealthIssues = validateRecoveredHealthIssues(recoveredHealthIssues);
  }

  if (beforeWeightKg !== undefined) result.beforeWeightKg = validateWeight(beforeWeightKg, 'beforeWeightKg');
  if (afterWeightKg  !== undefined) result.afterWeightKg  = validateWeight(afterWeightKg,  'afterWeightKg');

  if (goalType !== undefined) {
    if (!GOAL_TYPES.includes(goalType)) {
      throw new ValidationError(422, `goalType must be one of: ${GOAL_TYPES.join(', ')}`);
    }
    result.goalType = goalType;
  }

  if (durationText !== undefined) {
    result.durationText = validateDurationText(durationText);
  }

  return result;
}

/**
 * Validate payload for POST /api/testimonials/update-health-issues
 * Coach updates a reporting member's recovered health issues (no OTP).
 */
export function validateUpdateMemberHealthIssues(body) {
  if (!body) throw new ValidationError(400, 'Request body is missing');

  const { coachId, userId } = body;
  const recoveredHealthIssues = normalizeRecoveredHealthIssues(body);

  if (!coachId) throw new ValidationError(400, 'coachId is required');
  const coachIdN = parseInt(coachId, 10);
  if (isNaN(coachIdN) || coachIdN < 1) throw new ValidationError(400, 'coachId must be a valid integer');

  if (!userId) throw new ValidationError(400, 'userId is required');
  const userIdN = parseInt(userId, 10);
  if (isNaN(userIdN) || userIdN < 1) throw new ValidationError(400, 'userId must be a valid integer');

  if (recoveredHealthIssues === undefined) {
    throw new ValidationError(400, 'recoveredHealthIssues is required');
  }

  return {
    coachId: coachIdN,
    userId: userIdN,
    recoveredHealthIssues: validateRecoveredHealthIssues(recoveredHealthIssues, { required: true }),
  };
}

/**
 * Validate payload for POST /api/testimonials/verify-unified-otp
 * One OTP covers both photo and video verification when submitted via submit-all-edits.
 */
export function validateVerifyUnifiedOtp(body) {
  if (!body) throw new ValidationError(400, 'Request body is missing');

  const { userId, otp } = body;

  if (!userId) throw new ValidationError(400, 'userId is required');
  const userIdN = parseInt(userId, 10);
  if (isNaN(userIdN) || userIdN < 1) throw new ValidationError(400, 'userId must be a valid integer');

  if (!otp || typeof otp !== 'string') throw new ValidationError(400, 'otp is required');
  if (!isValidEmailOtp(otp.trim())) throw new ValidationError(422, 'otp must be a 4-digit number');

  return { userId: userIdN, otp: otp.trim() };
}

/**
 * Validate payload for POST /api/testimonials/resend-unified-otp
 */
export function validateResendUnifiedOtp(body) {
  if (!body) throw new ValidationError(400, 'Request body is missing');

  const { userId } = body;
  if (!userId) throw new ValidationError(400, 'userId is required');
  const userIdN = parseInt(userId, 10);
  if (isNaN(userIdN) || userIdN < 1) throw new ValidationError(400, 'userId must be a valid integer');

  return { userId: userIdN };
}

