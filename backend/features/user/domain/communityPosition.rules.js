/**
 * Community Position catalog + coach OTP rules.
 * Pure — no I/O.
 *
 * A position is a profile role. Features read `featureKey` (not a hard-coded
 * label) to decide what that role may do. New roles are rows in
 * community_positions_table.
 *
 * Apps below 3.5.6, and requests with no version, still save the position
 * on profile POST using the legacy code list. 3.5.6+ with the flag on
 * ignores that field and uses the OTP endpoints.
 */
import { isAtLeastVersion } from '../../app-version/domain/version.rules.js';

export const COMMUNITY_POSITION_OTP_FLAG = 'ff.community-position-otp';
export const COMMUNITY_POSITION_OTP_MIN_APP_VERSION = '3.5.6';
export const COMMUNITY_POSITION_OTP_HOURS = 24;
export const COMMUNITY_POSITION_OTP_MAX_ATTEMPTS = 5;
export const COMMUNITY_POSITION_OTP_BCRYPT_COST = 12;

export const POSITION_STATUS_PENDING = 'pending';
export const POSITION_STATUS_APPROVED = 'approved';
export const POSITION_STATUS_CANCELLED = 'cancelled';
export const POSITION_STATUS_EXPIRED = 'expired';

export const POSITION_ALREADY_HELD = 'already-held';
export const POSITION_UNKNOWN = 'unknown';
export const POSITION_INVALID = 'invalid';
export const POSITION_REQUEST = 'request';

/**
 * Codes released apps already send on profile save.
 * Do not add new roles here — insert a community_positions_table row.
 */
export const LEGACY_COMMUNITY_POSITIONS = Object.freeze([
  { code: 'PC', label: 'PC', featureKey: 'pc', usageNote: 'Profile role. Features check the key pc.', sortOrder: 10 },
  { code: 'ASSOCIATE', label: 'ASSOCIATE', featureKey: 'associate', usageNote: 'Profile role. Features check the key associate.', sortOrder: 20 },
  { code: 'SV', label: 'SV', featureKey: 'sv', usageNote: 'Profile role. Features check the key sv.', sortOrder: 30 },
  { code: 'WT', label: 'WT', featureKey: 'wt', usageNote: 'Profile role. Features check the key wt.', sortOrder: 40 },
  { code: 'AWT', label: 'AWT', featureKey: 'awt', usageNote: 'Profile role. Features check the key awt.', sortOrder: 50 },
  { code: 'GET', label: 'GET', featureKey: 'get-team', usageNote: 'Profile role. Features check the key get-team.', sortOrder: 60 },
  { code: 'GET 2500', label: 'GET 2500', featureKey: 'get-team-2500', usageNote: 'Profile role. Features check the key get-team-2500.', sortOrder: 70 },
  { code: 'MILL', label: 'MILL', featureKey: 'mill-team', usageNote: 'Profile role. Features check the key mill-team.', sortOrder: 80 },
  { code: 'MILL 7500', label: 'MILL 7500', featureKey: 'mill-7500', usageNote: 'Profile role. Features check the key mill-7500.', sortOrder: 85 },
  { code: 'PT', label: 'PT', featureKey: 'pt', usageNote: 'Profile role. Features check the key pt.', sortOrder: 90 },
]);

/** Old app / DB codes → current catalog codes (§5.1 keep accepting legacy). */
export const COMMUNITY_POSITION_CODE_ALIASES = Object.freeze({
  'GET TEAM': 'GET',
  '2500 GET TEAM': 'GET 2500',
  'MILL TEAM': 'MILL',
});

export const LEGACY_COMMUNITY_POSITION_CODES = Object.freeze(
  LEGACY_COMMUNITY_POSITIONS.map((row) => row.code),
);

/** Codes accepted on profile/events: current + renamed legacy. */
export const ACCEPTED_COMMUNITY_POSITION_CODES = Object.freeze([
  ...LEGACY_COMMUNITY_POSITION_CODES,
  ...Object.keys(COMMUNITY_POSITION_CODE_ALIASES),
]);

/**
 * @param {{ flagEnabled?: boolean, appVersion?: string|null, minAppVersion?: string }} args
 * @returns {boolean}
 */
export function shouldDeferCommunityPositionToOtp({
  flagEnabled = false,
  appVersion = null,
  minAppVersion = COMMUNITY_POSITION_OTP_MIN_APP_VERSION,
} = {}) {
  if (!flagEnabled) return false;
  return isAtLeastVersion(appVersion, minAppVersion) === true;
}

export function normalizePositionCode(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').toUpperCase();
}

/**
 * Map renamed legacy codes to the current catalog code.
 * @param {unknown} value
 * @returns {string}
 */
export function canonicalizePositionCode(value) {
  const code = normalizePositionCode(value);
  if (!code) return '';
  return COMMUNITY_POSITION_CODE_ALIASES[code] || code;
}

export function isValidPositionCode(value) {
  const code = normalizePositionCode(value);
  if (!code || code.length > 40) return false;
  return /^[A-Z0-9]+(?: [A-Z0-9]+)*$/.test(code);
}

export function normalizeFeatureKey(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function isValidFeatureKey(value) {
  const key = normalizeFeatureKey(value);
  if (!key || key.length > 40) return false;
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(key);
}

/**
 * @param {unknown} expiresAt
 * @param {Date} [now]
 * @returns {boolean}
 */
export function isCommunityPositionOtpExpired(expiresAt, now = new Date()) {
  if (!expiresAt) return true;
  const exp = new Date(expiresAt);
  if (Number.isNaN(exp.getTime())) return true;
  return now.getTime() > exp.getTime();
}

export function canAttemptCommunityPositionOtp(
  attempts,
  max = COMMUNITY_POSITION_OTP_MAX_ATTEMPTS,
) {
  const n = Number(attempts);
  if (!Number.isFinite(n) || n < 0) return true;
  return n < max;
}

export function communityPositionOtpExpiresAt(
  requestedAt = new Date(),
  hours = COMMUNITY_POSITION_OTP_HOURS,
) {
  const start = requestedAt instanceof Date ? requestedAt : new Date(requestedAt);
  return new Date(start.getTime() + hours * 60 * 60 * 1000);
}

/**
 * @param {{
 *   requestedCode?: unknown,
 *   confirmedCode?: unknown,
 *   activeCodes?: unknown[],
 * }} args
 */
export function classifyCommunityPositionRequest({
  requestedCode = null,
  confirmedCode = null,
  activeCodes = [],
} = {}) {
  const code = normalizePositionCode(requestedCode);
  if (!isValidPositionCode(code)) {
    return {
      ok: false,
      status: POSITION_INVALID,
      message: 'Choose a community position.',
      code: null,
    };
  }
  const allowed = (activeCodes || []).map(normalizePositionCode).filter(Boolean);
  if (!allowed.includes(code)) {
    return {
      ok: false,
      status: POSITION_UNKNOWN,
      message: 'That community position is not available.',
      code,
    };
  }
  const current = normalizePositionCode(confirmedCode);
  if (current && current === code) {
    return {
      ok: false,
      status: POSITION_ALREADY_HELD,
      message: 'You already hold this community position.',
      code,
    };
  }
  return { ok: true, status: POSITION_REQUEST, message: null, code };
}

/**
 * Admin add / update. Feature key must be unique so each role has its own usage.
 * @param {object} input
 */
export function normalizeCommunityPositionDraft(input = {}) {
  const code = normalizePositionCode(input.code ?? input.Code);
  const rawLabel = String(input.label ?? input.Label ?? '').trim().replace(/\s+/g, ' ');
  const label = rawLabel || code;
  const featureKey = normalizeFeatureKey(input.featureKey ?? input.FeatureKey);
  const usageNote = String(input.usageNote ?? input.UsageNote ?? '').trim().slice(0, 240);
  const sortRaw = Number(input.sortOrder ?? input.SortOrder);
  const sortOrder = Number.isFinite(sortRaw) ? Math.trunc(sortRaw) : 0;
  const active = input.active !== false && input.isActive !== false && input.IsActive !== false;
  const errors = [];
  if (!isValidPositionCode(code)) {
    errors.push('Code must be letters or numbers, up to 40 characters.');
  }
  if (!label || label.length > 40) errors.push('Label is required (max 40 characters).');
  if (!isValidFeatureKey(featureKey)) {
    errors.push('Feature key must be a short slug such as mill-team.');
  }
  if (!usageNote) {
    errors.push('Usage note is required so features know what this role is for.');
  }
  return {
    ok: errors.length === 0,
    errors,
    value: { code, label, featureKey, usageNote, sortOrder, active },
  };
}

export function toPublicCommunityPosition(row) {
  if (!row) return null;
  const code = normalizePositionCode(row.Code ?? row.code);
  if (!code) return null;
  return {
    code,
    label: String(row.Label ?? row.label ?? code).trim() || code,
    featureKey: normalizeFeatureKey(row.FeatureKey ?? row.featureKey) || null,
    usageNote: String(row.UsageNote ?? row.usageNote ?? '').trim(),
    sortOrder: Number(row.SortOrder ?? row.sortOrder) || 0,
    active: (row.IsActive ?? row.active) !== false,
  };
}

export function toPublicCommunityPositionRequest(row, {
  approverName = null,
  approverEmail = null,
  label = null,
  featureKey = null,
} = {}) {
  if (!row) return null;
  const email = String(approverEmail || '').trim() || null;
  return {
    id: row.Id ?? null,
    positionCode: row.PositionCode ?? null,
    label: label || row.PositionCode || null,
    featureKey: featureKey || null,
    status: row.Status ?? POSITION_STATUS_PENDING,
    expiresAt: row.OtpExpiresAt ?? null,
    approverName: approverName || null,
    approverEmail: email && email.includes('@') ? email : null,
  };
}

/**
 * True when a feature should treat this member as holding `featureKey`.
 * @param {{ featureKey?: string|null }|null} position
 * @param {unknown} featureKey
 */
export function positionMatchesFeature(position, featureKey) {
  const left = normalizeFeatureKey(position?.featureKey);
  const right = normalizeFeatureKey(featureKey);
  if (!left || !right) return false;
  return left === right;
}
