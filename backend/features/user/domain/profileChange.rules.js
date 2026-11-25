/**
 * Unified profile-change sponsor OTP — first fill free; later changes need
 * one coach approval code on Save (ADR-0018).
 *
 * Legacy: appVersion < PROFILE_CHANGE_OTP_MIN_APP_VERSION or missing version
 * keeps per-field OTP / immediate save. 3.5.8+ with the flag ON uses this path.
 */
import { isAtLeastVersion } from '../../app-version/domain/version.rules.js';
import { isHeightLocked, parseHeightCm, heightsDiffer } from './heightChange.rules.js';

export const PROFILE_CHANGE_OTP_FLAG = 'ff.profile-change-sponsor-otp';
export const PROFILE_CHANGE_OTP_MIN_APP_VERSION = '3.5.8';
export const PROFILE_CHANGE_OTP_HOURS = 24;
export const PROFILE_CHANGE_OTP_MAX_ATTEMPTS = 5;
export const PROFILE_CHANGE_OTP_BCRYPT_COST = 10;

export const PROFILE_CHANGE_STATUS_PENDING = 'pending';
export const PROFILE_CHANGE_STATUS_APPROVED = 'approved';
export const PROFILE_CHANGE_STATUS_CANCELLED = 'cancelled';
export const PROFILE_CHANGE_STATUS_EXPIRED = 'expired';

/** Labels shown in coach email / API `changedFields`. */
export const PROFILE_CHANGE_FIELD_LABELS = {
  phoneNumber: 'Phone number',
  height: 'Height',
  recoveredHealthIssues: 'Health issues',
  email: 'Email',
  communityId: 'Community ID',
  eventLevel: 'Community position',
  eventTranslation: 'Event translation languages',
  professionalTitle: 'Professional title',
  herbalifeJoinedOn: 'Date of joining in community',
  aboutMe: 'About me',
  qualification: 'Qualification',
  profileImage: 'Profile photo',
};

/**
 * Gated keys that may require sponsor OTP when changed after first fill.
 * `profileIntro` keys are flattened on the pending patch.
 */
export const PROFILE_CHANGE_GATED_KEYS = Object.keys(PROFILE_CHANGE_FIELD_LABELS);

/**
 * @param {{ flagEnabled?: boolean, appVersion?: string|null, minAppVersion?: string }} args
 * @returns {boolean}
 */
export function isUnifiedProfileChangeOtpActive({
  flagEnabled = false,
  appVersion = null,
  minAppVersion = PROFILE_CHANGE_OTP_MIN_APP_VERSION,
} = {}) {
  if (!flagEnabled) return false;
  return isAtLeastVersion(appVersion, minAppVersion) === true;
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isProfileFieldEmpty(value) {
  if (value == null) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'number') return !Number.isFinite(value);
  if (typeof value === 'boolean') return false;
  return false;
}

function normalizePhone(value) {
  return String(value || '').trim().replace(/[\s\-()]/g, '');
}

function normalizeText(value) {
  return String(value ?? '').trim();
}

function normalizeCommunityId(value) {
  return normalizeText(value).toUpperCase();
}

function normalizeIssues(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => normalizeText(item))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
}

function issuesEqual(a, b) {
  const left = normalizeIssues(a);
  const right = normalizeIssues(b);
  if (left.length !== right.length) return false;
  return left.every((item, index) => item === right[index]);
}

function normalizeJoinedOn(value) {
  const raw = normalizeText(value);
  if (!raw) return '';
  // Accept YYYY-MM-DD or ISO; compare date part only.
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(raw);
  return match ? match[1] : raw;
}

/**
 * True when existing already has a meaningful value (field is "locked").
 * @param {string} key
 * @param {unknown} existingValue
 * @returns {boolean}
 */
export function isProfileFieldLocked(key, existingValue) {
  if (key === 'height') return isHeightLocked(existingValue);
  if (key === 'profileImage') {
    if (existingValue === true) return true;
    return !isProfileFieldEmpty(existingValue);
  }
  if (key === 'recoveredHealthIssues') return normalizeIssues(existingValue).length > 0;
  return !isProfileFieldEmpty(existingValue);
}

/**
 * @param {string} key
 * @param {unknown} existingValue
 * @param {unknown} incomingValue
 * @returns {boolean}
 */
export function profileFieldValuesDiffer(key, existingValue, incomingValue) {
  if (key === 'height') return heightsDiffer(existingValue, incomingValue);
  if (key === 'phoneNumber') {
    return normalizePhone(existingValue) !== normalizePhone(incomingValue);
  }
  if (key === 'email') {
    return normalizeText(existingValue).toLowerCase() !== normalizeText(incomingValue).toLowerCase();
  }
  if (key === 'communityId') {
    return normalizeCommunityId(existingValue) !== normalizeCommunityId(incomingValue);
  }
  if (key === 'recoveredHealthIssues') {
    return !issuesEqual(existingValue, incomingValue);
  }
  if (key === 'herbalifeJoinedOn') {
    return normalizeJoinedOn(existingValue) !== normalizeJoinedOn(incomingValue);
  }
  if (key === 'profileImage') {
    // Incoming data URI / new upload always counts as a change when locked.
    if (incomingValue === undefined || incomingValue === null || incomingValue === '') return false;
    return true;
  }
  return normalizeText(existingValue) !== normalizeText(incomingValue);
}

/**
 * Classify one gated field.
 * @returns {'unchanged'|'first_fill'|'change'|null} null = key not present in incoming
 */
export function classifyGatedField(key, existingValue, incomingValue) {
  if (incomingValue === undefined) return null;
  if (!profileFieldValuesDiffer(key, existingValue, incomingValue)) return 'unchanged';
  if (!isProfileFieldLocked(key, existingValue)) return 'first_fill';
  return 'change';
}

/**
 * Build existing snapshot from a team_table user row (+ optional flags).
 * @param {object} user
 * @param {{ hasProfileImage?: boolean, profileIntro?: object|null }} [extras]
 */
export function existingSnapshotFromUser(user, extras = {}) {
  const intro = extras.profileIntro || {};
  return {
    phoneNumber: user?.PhoneNumber ?? null,
    height: user?.Height ?? null,
    recoveredHealthIssues: user?.recovered_health_issues ?? user?.RecoveredHealthIssues ?? [],
    email: user?.Email ?? null,
    communityId: user?.CommunityId ?? null,
    eventLevel: user?.EventLevel ?? null,
    eventTranslation: user?.EventTranslation ?? null,
    professionalTitle: intro.professionalTitle ?? user?.ProfessionalTitle ?? null,
    herbalifeJoinedOn: intro.herbalifeJoinedOn ?? user?.HerbalifeJoinedOn ?? null,
    aboutMe: intro.aboutMe ?? user?.AboutMe ?? null,
    qualification: intro.qualification ?? user?.Qualification ?? null,
    profileImage: extras.hasProfileImage === true
      || !isProfileFieldEmpty(user?.ProfileImage)
      || !isProfileFieldEmpty(user?.AvatarKey)
      || !isProfileFieldEmpty(user?.avatarUrl),
  };
}

/**
 * Pull gated fields from a profile update input / pending patch.
 * @param {object} input
 * @returns {Record<string, unknown>}
 */
export function extractGatedIncoming(input = {}) {
  const intro = input.profileIntro && typeof input.profileIntro === 'object'
    ? input.profileIntro
    : {};
  const out = {};
  if (input.phoneNumber !== undefined) out.phoneNumber = input.phoneNumber;
  if (input.height !== undefined) out.height = input.height;
  if (input.recoveredHealthIssues !== undefined) out.recoveredHealthIssues = input.recoveredHealthIssues;
  if (input.email !== undefined && input._emailIsProfileChange === true) {
    out.email = input.email;
  }
  if (input.communityId !== undefined) out.communityId = input.communityId;
  if (input.eventLevel !== undefined) out.eventLevel = input.eventLevel;
  if (input.eventTranslation !== undefined) out.eventTranslation = input.eventTranslation;
  if (input.professionalTitle !== undefined) out.professionalTitle = input.professionalTitle;
  else if (intro.professionalTitle !== undefined) out.professionalTitle = intro.professionalTitle;
  if (input.herbalifeJoinedOn !== undefined) out.herbalifeJoinedOn = input.herbalifeJoinedOn;
  else if (intro.herbalifeJoinedOn !== undefined) out.herbalifeJoinedOn = intro.herbalifeJoinedOn;
  if (input.aboutMe !== undefined) out.aboutMe = input.aboutMe;
  else if (intro.aboutMe !== undefined) out.aboutMe = intro.aboutMe;
  if (input.qualification !== undefined) out.qualification = input.qualification;
  else if (intro.qualification !== undefined) out.qualification = intro.qualification;
  if (input.profileImage !== undefined) out.profileImage = input.profileImage;
  return out;
}

/**
 * @param {{
 *   existing: Record<string, unknown>,
 *   incoming: Record<string, unknown>,
 * }} args
 * @returns {{
 *   firstFills: Record<string, unknown>,
 *   changes: Record<string, unknown>,
 *   changedKeys: string[],
 *   needsOtp: boolean,
 * }}
 */
export function classifyProfileGatedChanges({ existing = {}, incoming = {} } = {}) {
  const firstFills = {};
  const changes = {};
  const changedKeys = [];

  for (const key of PROFILE_CHANGE_GATED_KEYS) {
    if (!(key in incoming)) continue;
    const kind = classifyGatedField(key, existing[key], incoming[key]);
    if (kind === 'first_fill') {
      firstFills[key] = incoming[key];
    } else if (kind === 'change') {
      changes[key] = incoming[key];
      changedKeys.push(key);
    }
  }

  return {
    firstFills,
    changes,
    changedKeys,
    needsOtp: changedKeys.length > 0,
  };
}

/**
 * Strip gated *changes* from a profile update input (keep first fills).
 * @param {object} input
 * @param {string[]} changeKeys
 * @returns {object}
 */
export function stripGatedChangesFromInput(input, changeKeys = []) {
  if (!input || !Array.isArray(changeKeys) || changeKeys.length === 0) return input;
  const next = { ...input };
  const intro = next.profileIntro && typeof next.profileIntro === 'object'
    ? { ...next.profileIntro }
    : null;

  for (const key of changeKeys) {
    if (key === 'professionalTitle' || key === 'herbalifeJoinedOn'
      || key === 'aboutMe' || key === 'qualification') {
      delete next[key];
      if (intro) delete intro[key];
      continue;
    }
    delete next[key];
  }

  if (intro) next.profileIntro = intro;
  return next;
}

/**
 * @param {string[]} keys
 * @returns {string[]}
 */
export function labelsForChangedKeys(keys = []) {
  return keys.map((key) => PROFILE_CHANGE_FIELD_LABELS[key] || key);
}

/**
 * @param {unknown} expiresAt
 * @param {Date} [now]
 * @returns {boolean}
 */
export function isProfileChangeOtpExpired(expiresAt, now = new Date()) {
  if (!expiresAt) return true;
  const exp = new Date(expiresAt);
  if (Number.isNaN(exp.getTime())) return true;
  return now.getTime() > exp.getTime();
}

/**
 * Mask email for API responses (keep domain).
 * @param {string} email
 * @returns {string}
 */
export function maskEmailForDisplay(email) {
  const raw = String(email || '').trim().toLowerCase();
  const at = raw.indexOf('@');
  if (at < 1) return '***';
  const local = raw.slice(0, at);
  const domain = raw.slice(at + 1);
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}***@${domain}`;
}

export { parseHeightCm };
