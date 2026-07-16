/**
 * User feature — input validators.
 */
import { ValidationError } from '../../shared/lib/ValidationError.js';
import { VALID_PHYSICAL_ACTIVITY_LEVELS, isValidPhysicalActivityLevel } from '../../utils/tdeeCalculations.js';

const VALID_DIETS = ['Vegetarian', 'Non-Vegetarian', 'Vegan', 'Pescatarian'];
const VALID_GOAL_MODES = ['loss', 'gain', 'maintain'];
export const COMMUNITY_ID_MAX_LENGTH = 100;
const COMMUNITY_ID_PATTERN = /^[a-zA-Z0-9]+$/;
export { VALID_GOAL_MODES, VALID_PHYSICAL_ACTIVITY_LEVELS };

export function normalizeCommunityId(raw) {
  if (raw === null || raw === undefined) return null;
  const trimmed = String(raw).trim();
  return trimmed === '' ? null : trimmed;
}

export function validateCommunityId(raw) {
  const normalized = normalizeCommunityId(raw);
  if (normalized === null) return { valid: true, value: null };
  if (normalized.length > COMMUNITY_ID_MAX_LENGTH) {
    return {
      valid: false,
      message: `Community ID must be at most ${COMMUNITY_ID_MAX_LENGTH} characters.`,
    };
  }
  if (!COMMUNITY_ID_PATTERN.test(normalized)) {
    return { valid: false, message: 'Community ID may only contain letters and numbers.' };
  }
  return { valid: true, value: normalized };
}

export function normalizeEmail(raw) {
  return raw ? String(raw).toLowerCase().trim() : raw;
}

export function validateGetProfile(query) {
  const email = normalizeEmail(query?.email);
  if (!email) throw new ValidationError(400, 'Missing required query parameter: email');
  return { email };
}

export function validateUpdateProfile(body) {
  if (!body) throw new ValidationError(400, 'Request body is missing');
  const email = body.email;
  if (!email) throw new ValidationError(400, 'Missing required field: email');
  const weightGoalMode = body.weightGoalMode;
  if (weightGoalMode != null && !VALID_GOAL_MODES.includes(weightGoalMode)) {
    throw new ValidationError(400, `Invalid weightGoalMode. Must be one of: ${VALID_GOAL_MODES.join(', ')}`);
  }
  const physicalActivityLevel = body.physicalActivityLevel;
  if (physicalActivityLevel != null && physicalActivityLevel !== ''
    && !isValidPhysicalActivityLevel(physicalActivityLevel)) {
    throw new ValidationError(400, `Invalid physicalActivityLevel. Must be one of: ${VALID_PHYSICAL_ACTIVITY_LEVELS.join(', ')}`);
  }

  let communityId;
  if ('communityId' in body || 'community_id' in body) {
    const communityIdRaw = body.communityId !== undefined ? body.communityId : body.community_id;
    const validation = validateCommunityId(communityIdRaw);
    if (!validation.valid) throw new ValidationError(400, validation.message);
    communityId = validation.value;
  }

  return {
    email,
    name: body.name,
    height: body.height,
    bmr: body.bmr,
    dietType: body.dietType,
    profileImage: body.profileImage,
    phoneNumber: body.phoneNumber,
    weightGoalMode: weightGoalMode || undefined,
    physicalActivityLevel: physicalActivityLevel || undefined,
    communityId,
  };
}

export function validateUserId(query) {
  const userId = query?.userId;
  if (!userId) throw new ValidationError(400, 'Missing required parameter: userId');
  return { userId };
}

export function validateLookup(req) {
  const raw = req.method === 'GET' ? req.query?.email : req.body?.email;
  const email = normalizeEmail(raw);
  if (!email) throw new ValidationError(400, 'Email is required');
  return { email };
}

export function validateGoogleUser(body) {
  const email = normalizeEmail(body?.email);
  const displayName = body?.displayName;
  if (!email || !displayName) {
    throw new ValidationError(400, 'Email and Display Name are required');
  }
  return { email, displayName, photoURL: body?.photoURL || null };
}

export function validateSnooze(body) {
  const { userId } = body || {};
  if (!userId) throw new ValidationError(400, 'Missing required field: userId');
  return { userId };
}

export function validateDeleteAccount(body) {
  const email = normalizeEmail(body?.email);
  if (!email) throw new ValidationError(400, 'Missing required field: email');
  return { email };
}

export function validateSkipSetup(body) {
  const { email, coachId, coachName } = body || {};
  if (!email) throw new ValidationError(400, 'Email is required');
  return { email, coachId: coachId || null, coachName: coachName || null };
}

export function validateStatus(query) {
  const email = normalizeEmail(query?.email);
  if (!email) throw new ValidationError(400, 'Email is required');
  return { email };
}

export { VALID_DIETS };
