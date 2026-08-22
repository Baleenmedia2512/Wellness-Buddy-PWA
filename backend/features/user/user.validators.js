/**
 * User feature — input validators.
 */
import { ValidationError } from '../../shared/lib/ValidationError.js';
import { assertIanaTimezone, IANA_IST } from '../../shared/lib/datetime/index.js';
import { VALID_PHYSICAL_ACTIVITY_LEVELS, isValidPhysicalActivityLevel } from '../../utils/tdeeCalculations.js';
import { parseOptionalBodyMetric } from './domain/profileBodyMetrics.rules.js';

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

/**
 * Validate an IANA timezone for profile updates.
 * Empty string clears to the default (Asia/Kolkata).
 *
 * @param {unknown} raw
 * @returns {{ valid: true, value: string } | { valid: false, message: string }}
 */
export function validateTimezoneIana(raw) {
  if (raw === null || raw === undefined) {
    return { valid: true, value: undefined };
  }
  const trimmed = String(raw).trim();
  if (trimmed === '') {
    return { valid: true, value: IANA_IST };
  }
  try {
    assertIanaTimezone(trimmed);
    return { valid: true, value: trimmed };
  } catch {
    return { valid: false, message: 'Invalid timezone. Provide a valid IANA timezone (e.g. Asia/Kolkata).' };
  }
}

export function normalizeEmail(raw) {
  return raw ? String(raw).toLowerCase().trim() : raw;
}

export function validateGetProfile(query) {
  const email = normalizeEmail(query?.email);
  if (!email) throw new ValidationError(400, 'Missing required query parameter: email');
  return { email };
}

const VALID_GENDERS = ['Male', 'Female'];

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
  const gender = body.gender != null && body.gender !== '' ? String(body.gender).trim() : undefined;
  if (gender != null && !VALID_GENDERS.includes(gender)) {
    throw new ValidationError(400, `Invalid gender. Must be one of: ${VALID_GENDERS.join(', ')}`);
  }

  let communityId;
  if ('communityId' in body || 'community_id' in body) {
    const communityIdRaw = body.communityId !== undefined ? body.communityId : body.community_id;
    const validation = validateCommunityId(communityIdRaw);
    if (!validation.valid) throw new ValidationError(400, validation.message);
    communityId = validation.value;
  }

  let bodyFat;
  if ('bodyFat' in body || 'BodyFat' in body || 'body_fat' in body) {
    const raw = body.bodyFat !== undefined
      ? body.bodyFat
      : (body.BodyFat !== undefined ? body.BodyFat : body.body_fat);
    if (raw === null || raw === '') {
      bodyFat = null;
    } else {
      const n = parseFloat(raw);
      if (!Number.isFinite(n) || n < 1 || n > 70) {
        throw new ValidationError(400, 'Invalid bodyFat. Must be a number between 1 and 70.');
      }
      bodyFat = n;
    }
  }

  let currentWeight;
  if ('currentWeight' in body || 'weight' in body || 'Weight' in body) {
    const raw = body.currentWeight !== undefined
      ? body.currentWeight
      : (body.weight !== undefined ? body.weight : body.Weight);
    if (raw === null || raw === '') {
      currentWeight = null;
    } else {
      const n = parseFloat(raw);
      if (!Number.isFinite(n) || n < 20 || n > 300) {
        throw new ValidationError(400, 'Invalid currentWeight. Must be a number between 20 and 300 kg.');
      }
      currentWeight = n;
    }
  }

  let timezoneIana;
  if ('timezone' in body || 'timezoneIana' in body || 'timezone_iana' in body) {
    const timezoneRaw = body.timezone !== undefined
      ? body.timezone
      : (body.timezoneIana !== undefined ? body.timezoneIana : body.timezone_iana);
    const validation = validateTimezoneIana(timezoneRaw);
    if (!validation.valid) throw new ValidationError(400, validation.message);
    timezoneIana = validation.value;
  }

  const parseMetric = (keys, bounds, label) => {
    const present = keys.some((k) => k in body);
    if (!present) return undefined;
    const raw = keys.reduce((acc, k) => (acc !== undefined ? acc : body[k]), undefined);
    const parsed = parseOptionalBodyMetric(raw, bounds);
    if (!parsed.ok) throw new ValidationError(400, `Invalid ${label}. ${parsed.message}`);
    return parsed.value;
  };

  const age = parseMetric(['age', 'Age'], { min: 1, max: 120, integer: true }, 'age');
  const visceralFat = parseMetric(['visceralFat', 'VisceralFat', 'visceral_fat'], { min: 1, max: 59 }, 'visceralFat');
  const bodyAge = parseMetric(['bodyAge', 'BodyAge', 'body_age'], { min: 1, max: 120 }, 'bodyAge');
  const chestCm = parseMetric(['chestCm', 'ChestCm', 'chest_cm'], { min: 30, max: 200 }, 'chestCm');
  const waistCm = parseMetric(['waistCm', 'WaistCm', 'waist_cm'], { min: 30, max: 200 }, 'waistCm');
  const hipCm = parseMetric(['hipCm', 'HipCm', 'hip_cm'], { min: 30, max: 200 }, 'hipCm');

  return {
    email,
    name: body.name,
    height: body.height,
    bmr: body.bmr,
    dietType: body.dietType,
    profileImage: body.profileImage,
    phoneNumber: body.phoneNumber,
    gender,
    weightGoalMode: weightGoalMode || undefined,
    physicalActivityLevel: physicalActivityLevel || undefined,
    communityId,
    bodyFat,
    currentWeight,
    timezoneIana,
    age,
    visceralFat,
    bodyAge,
    chestCm,
    waistCm,
    hipCm,
  };
}

export function validateUserId(query) {
  const userId = query?.userId;
  if (!userId) throw new ValidationError(400, 'Missing required parameter: userId');
  return { userId };
}

export function validateLookup(req) {
  const isGet = req.method === 'GET';
  const raw = isGet ? req.query?.email : req.body?.email;
  const email = normalizeEmail(raw);
  if (!email) throw new ValidationError(400, 'Email is required');
  const timezoneRaw = isGet
    ? (req.query?.timezoneIana ?? req.query?.timezone)
    : (req.body?.timezoneIana ?? req.body?.timezone);
  return { email, timezoneIana: timezoneRaw };
}

export function validateGoogleUser(body) {
  const email = normalizeEmail(body?.email);
  const displayName = body?.displayName;
  if (!email || !displayName) {
    throw new ValidationError(400, 'Email and Display Name are required');
  }
  return {
    email,
    displayName,
    photoURL: body?.photoURL || null,
    timezoneIana: body?.timezoneIana ?? body?.timezone ?? undefined,
    consentAccepted: body?.consentAccepted === true,
    consentVersion: body?.consentVersion != null ? String(body.consentVersion).trim() : '',
    deviceInfo: body?.deviceInfo != null ? String(body.deviceInfo).trim().slice(0, 500) : '',
    ipAddress: body?.ipAddress != null ? String(body.ipAddress).trim().slice(0, 64) : null,
  };
}

export function validateRecordConsent(body) {
  const email = normalizeEmail(body?.email);
  const userIdRaw = body?.userId;
  const userId = userIdRaw != null && String(userIdRaw).trim() !== ''
    ? Number(userIdRaw)
    : null;
  if ((!userId || !Number.isFinite(userId)) && !email) {
    throw new ValidationError(400, 'userId or email is required');
  }
  return {
    userId: userId && Number.isFinite(userId) ? userId : null,
    email: email || null,
    consentAccepted: body?.consentAccepted === true
      ? true
      : (body?.consentAccepted === false ? false : null),
    consentVersion: body?.consentVersion != null ? String(body.consentVersion).trim() : '',
    deviceInfo: body?.deviceInfo != null ? String(body.deviceInfo).trim().slice(0, 500) : '',
    ipAddress: body?.ipAddress != null ? String(body.ipAddress).trim().slice(0, 64) : null,
  };
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

export function validateVerifySession(req) {
  const isGet = req.method === 'GET';
  const source = isGet ? req.query : req.body;
  const email = source?.email ? normalizeEmail(source.email) : null;
  const phoneRaw = source?.phone ?? source?.phoneNumber ?? source?.PhoneNumber;
  const phone = phoneRaw != null && String(phoneRaw).trim() !== ''
    ? String(phoneRaw).trim()
    : null;
  const userIdRaw = source?.userId ?? source?.UserId;
  const userId = userIdRaw != null && String(userIdRaw).trim() !== ''
    ? String(userIdRaw).trim()
    : null;
  if (!email && !phone && !userId) {
    throw new ValidationError(400, 'At least one of userId, email, or phone is required');
  }
  const timezoneRaw = isGet
    ? (source?.timezoneIana ?? source?.timezone)
    : (source?.timezoneIana ?? source?.timezone);
  return { userId, email, phone, timezoneIana: timezoneRaw };
}

export { VALID_DIETS, VALID_GENDERS };
