/**
 * Unified profile-change sponsor OTP — first fill free; later changes need
 * one coach approval code on Save (mirrors backend profileChange.rules).
 */
import { APP_VERSION } from '../../../config/version.js';
import { isFlagEnabled } from '../../../config/featureFlags.js';
import { isHeightLocked, parseHeightCm, heightsDiffer } from './heightChange.js';

export const PROFILE_CHANGE_OTP_FLAG = 'ff.profile-change-sponsor-otp';
export const PROFILE_CHANGE_OTP_MIN_APP_VERSION = '3.5.8';

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

export const PROFILE_CHANGE_GATED_KEYS = Object.keys(PROFILE_CHANGE_FIELD_LABELS);

function parseSemver(raw) {
  const s = String(raw || '').trim().replace(/^v\s*/i, '');
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(s);
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

function isAtLeastVersion(client, minimum) {
  const va = parseSemver(client);
  const vb = parseSemver(minimum);
  if (!va || !vb) return false;
  if (va.major !== vb.major) return va.major > vb.major;
  if (va.minor !== vb.minor) return va.minor > vb.minor;
  return va.patch >= vb.patch;
}

export function usesUnifiedProfileChangeOtp({
  flagEnabled = isFlagEnabled(PROFILE_CHANGE_OTP_FLAG),
  appVersion = APP_VERSION.VERSION,
} = {}) {
  if (!flagEnabled) return false;
  return isAtLeastVersion(appVersion, PROFILE_CHANGE_OTP_MIN_APP_VERSION);
}

export function isProfileFieldEmpty(value) {
  if (value == null) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'number') return !Number.isFinite(value);
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
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(raw);
  return match ? match[1] : raw;
}

export function isProfileFieldLocked(key, existingValue) {
  if (key === 'height') return isHeightLocked(existingValue);
  if (key === 'profileImage') {
    if (existingValue === true) return true;
    return !isProfileFieldEmpty(existingValue);
  }
  if (key === 'recoveredHealthIssues') return normalizeIssues(existingValue).length > 0;
  return !isProfileFieldEmpty(existingValue);
}

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
    if (incomingValue === undefined || incomingValue === null || incomingValue === '') return false;
    return true;
  }
  return normalizeText(existingValue) !== normalizeText(incomingValue);
}

export function classifyGatedField(key, existingValue, incomingValue) {
  if (incomingValue === undefined) return null;
  if (!profileFieldValuesDiffer(key, existingValue, incomingValue)) return 'unchanged';
  if (!isProfileFieldLocked(key, existingValue)) return 'first_fill';
  return 'change';
}

/**
 * Snapshot of gated fields from a loaded profile / form.
 */
export function gatedSnapshotFromProfile(profile = {}) {
  return {
    phoneNumber: profile.phoneNumber ?? profile.phone ?? null,
    height: profile.height ?? null,
    recoveredHealthIssues: Array.isArray(profile.recoveredHealthIssues)
      ? profile.recoveredHealthIssues
      : [],
    email: profile.email ?? null,
    communityId: profile.communityId ?? null,
    eventLevel: profile.eventLevel ?? null,
    eventTranslation: profile.eventTranslation ?? null,
    professionalTitle: profile.professionalTitle ?? null,
    herbalifeJoinedOn: profile.herbalifeJoinedOn ?? null,
    aboutMe: profile.aboutMe ?? null,
    qualification: profile.qualification ?? null,
    profileImage: Boolean(
      profile.hasProfileImage
      || profile.profileImage
      || profile.avatarUrl
      || profile.AvatarKey,
    ),
  };
}

export function extractGatedFromPayload(payload = {}) {
  const out = {};
  if (payload.phoneNumber !== undefined) out.phoneNumber = payload.phoneNumber;
  if (payload.height !== undefined) out.height = payload.height;
  if (payload.recoveredHealthIssues !== undefined) {
    out.recoveredHealthIssues = payload.recoveredHealthIssues;
  }
  if (payload.communityId !== undefined) out.communityId = payload.communityId;
  if (payload.eventLevel !== undefined) out.eventLevel = payload.eventLevel;
  if (payload.eventTranslation !== undefined) out.eventTranslation = payload.eventTranslation;
  if (payload.professionalTitle !== undefined) out.professionalTitle = payload.professionalTitle;
  if (payload.herbalifeJoinedOn !== undefined) out.herbalifeJoinedOn = payload.herbalifeJoinedOn;
  if (payload.aboutMe !== undefined) out.aboutMe = payload.aboutMe;
  if (payload.qualification !== undefined) out.qualification = payload.qualification;
  if (payload.profileImage !== undefined) out.profileImage = payload.profileImage;
  return out;
}

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

export function labelsForChangedKeys(keys = []) {
  return keys.map((key) => PROFILE_CHANGE_FIELD_LABELS[key] || key);
}

export { parseHeightCm };
