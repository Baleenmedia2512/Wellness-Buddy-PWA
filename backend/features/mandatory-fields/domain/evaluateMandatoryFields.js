/**
 * Pure mandatory-field evaluation. No database and no profile writes.
 *
 * A stored value that the registry treats as filled is never outstanding.
 * Skip planning returns the next count only. It does not mark the field filled.
 *
 * Missing or unparsable app versions are not an exemption. A parseable version
 * below the field editor floor is an exemption, because that binary cannot
 * show the editor. HTTP 426 for missing versions is the version-lock layer
 * (phase 2), not a bypass inside this function.
 *
 * notifyEnabled is copied onto each outstanding field for optional reminders.
 * It does not hide the field or block Skip.
 *
 * remindEveryDays is how often to ask again while grace is still open.
 * 0 asks on every visit. 3 asks once, then waits three days after the last
 * ask or skip. A blocking field is still shown on every visit.
 *
 * A missing profile returns enforcement "unavailable" and is not an allowed
 * or completed result. HTTP 503 for that result is the API layer (phase 2).
 *
 * Grace limit 0 is required immediately. The campaign clock does not turn it
 * into a grace period. A grace limit above 0 keeps Skip until that grace ends.
 * Day 10 of requiredSince still blocks a field that is still empty.
 * Rules with no requiredSince keep the older grace behaviour.
 */
import { isAtLeastVersion } from '../../app-version/domain/version.rules.js';
import {
  isValidPositionCode,
  normalizePositionCode,
} from '../../user/domain/communityPosition.rules.js';
import {
  getRegisteredField,
  isRegisteredFieldKey,
  MANDATORY_FIELD_REGISTRY,
} from './fieldRegistry.js';
import { CAMPAIGN_BLOCK_DAY, campaignBlocksAccess, campaignDayIndex } from './campaignSchedule.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const MEMBER_ROLES = new Set(['user']);
const COACH_ROLES = new Set(['coach', 'upline']);
const GRACE_TYPES = new Set(['days', 'skips']);
const AUDIENCES = new Set(['member', 'coach', 'both']);
const POSITION_SCOPES = new Set(['all', 'specific']);

/**
 * @param {unknown} role
 * @param {unknown} audience
 * @returns {boolean}
 */
export function roleMatchesAudience(role, audience) {
  const normalized = String(role || '').trim().toLowerCase();
  if (audience === 'member') return MEMBER_ROLES.has(normalized);
  if (audience === 'coach') return COACH_ROLES.has(normalized);
  if (audience === 'both') {
    return MEMBER_ROLES.has(normalized) || COACH_ROLES.has(normalized);
  }
  return false;
}

/**
 * @param {unknown} clientVersion
 * @param {unknown} editorMin
 * @returns {'enforce'|'below-editor'|'untrusted'}
 */
export function versionEnforcementForField(clientVersion, editorMin) {
  const meets = isAtLeastVersion(clientVersion, editorMin);
  if (meets === true) return 'enforce';
  if (meets === false) return 'below-editor';
  return 'untrusted';
}

/**
 * Reject an admin write that is not a registered field or breaks the rule shape.
 * Does not read the database.
 *
 * @param {object} input
 * @returns {{ ok: true, rule: object } | { ok: false, message: string }}
 */
export function validateAdminRule(input) {
  const fieldKey = String(input?.fieldKey || '').trim();
  if (!isRegisteredFieldKey(fieldKey)) {
    return { ok: false, message: 'Unknown profile field.' };
  }
  const entry = getRegisteredField(fieldKey);
  const graceType = String(input?.graceType || '').trim();
  if (!GRACE_TYPES.has(graceType)) {
    return { ok: false, message: 'Grace type must be days or skips.' };
  }
  const graceLimit = Number(input?.graceLimit);
  if (!Number.isInteger(graceLimit) || graceLimit < 0) {
    return { ok: false, message: 'Grace limit must be a whole number of zero or more.' };
  }
  const audience = String(input?.audience || '').trim();
  if (!AUDIENCES.has(audience)) {
    return { ok: false, message: 'Audience must be member, coach, or both.' };
  }
  const minAppVersion = String(input?.minAppVersion || '').trim();
  if (isAtLeastVersion(minAppVersion, entry.editorMinAppVersion) !== true) {
    return {
      ok: false,
      message: `Minimum app version must be ${entry.editorMinAppVersion} or newer.`,
    };
  }
  const remindRaw = input?.remindEveryDays == null || input?.remindEveryDays === ''
    ? 0
    : Number(input.remindEveryDays);
  if (!Number.isInteger(remindRaw) || remindRaw < 0) {
    return {
      ok: false,
      message: 'Ask-again interval must be a whole number of days. Use 0 to ask on every visit.',
    };
  }
  const position = normalizePositionRule(fieldKey, input);
  if (!position.ok) return position;
  return {
    ok: true,
    rule: {
      fieldKey,
      required: input?.required === true,
      graceType,
      graceLimit,
      audience,
      minAppVersion,
      notifyEnabled: input?.notifyEnabled !== false,
      remindEveryDays: remindRaw,
      positionScope: position.positionScope,
      positionCodes: position.positionCodes,
    },
  };
}

/**
 * Community position may accept every catalog code, or only the codes named
 * on the rule. Other fields always store scope "all" and no codes.
 *
 * @param {string} fieldKey
 * @param {object} input
 */
function normalizePositionRule(fieldKey, input) {
  if (fieldKey !== 'communityPosition') {
    return { ok: true, positionScope: 'all', positionCodes: [] };
  }
  const positionScope = String(input?.positionScope || 'all').trim();
  if (!POSITION_SCOPES.has(positionScope)) {
    return { ok: false, message: 'Community position scope must be all or specific.' };
  }
  if (positionScope !== 'specific') {
    return { ok: true, positionScope: 'all', positionCodes: [] };
  }
  const raw = Array.isArray(input?.positionCodes) ? input.positionCodes : [];
  const positionCodes = [...new Set(raw.map((item) => normalizePositionCode(item)).filter(isValidPositionCode))];
  if (positionCodes.length === 0) {
    return { ok: false, message: 'Choose at least one community position.' };
  }
  return { ok: true, positionScope, positionCodes };
}

function graceByKey(graceRows) {
  const map = new Map();
  for (const row of graceRows || []) {
    if (!row || !row.fieldKey) continue;
    map.set(String(row.fieldKey), row);
  }
  return map;
}

function asDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function laterDate(left, right) {
  if (!left) return right;
  if (!right) return left;
  return left.getTime() >= right.getTime() ? left : right;
}

/**
 * @param {{
 *   rules?: object[],
 *   profile?: object|null,
 *   graceRows?: object[],
 *   role?: string|null,
 *   appVersion?: string|null,
 *   now?: Date,
 * }} input
 */
export function evaluateMandatoryFields({
  rules = [],
  profile = null,
  graceRows = [],
  role = null,
  appVersion = null,
  now = new Date(),
} = {}) {
  const clock = asDate(now) || new Date();
  if (profile == null || typeof profile !== 'object') {
    return {
      blocked: false,
      status: 'profile-unavailable',
      enforcement: 'unavailable',
      fields: [],
      unknownFieldKeys: [],
    };
  }

  const grace = graceByKey(graceRows);
  const unknownFieldKeys = [];
  const fields = [];

  const orderedRules = [...rules];
  orderedRules.sort((a, b) => {
    const ai = MANDATORY_FIELD_REGISTRY.findIndex((entry) => entry.fieldKey === a?.fieldKey);
    const bi = MANDATORY_FIELD_REGISTRY.findIndex((entry) => entry.fieldKey === b?.fieldKey);
    return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi);
  });

  for (const rule of orderedRules) {
    const fieldKey = String(rule?.fieldKey || '');
    if (!isRegisteredFieldKey(fieldKey)) {
      if (fieldKey) unknownFieldKeys.push(fieldKey);
      continue;
    }
    if (rule.required !== true) continue;
    if (!roleMatchesAudience(role, rule.audience)) continue;

    const entry = getRegisteredField(fieldKey);
    const versionGate = versionEnforcementForField(appVersion, entry.editorMinAppVersion);
    if (versionGate === 'below-editor') continue;
    if (entry.isFilled(profile, rule)) continue;

    const ruleMin = versionEnforcementForField(appVersion, rule.minAppVersion || entry.editorMinAppVersion);
    if (ruleMin === 'below-editor') continue;

    const stored = grace.get(fieldKey) || null;
    const firstNotifiedAt = stored?.firstNotifiedAt ? asDate(stored.firstNotifiedAt) : null;
    const skipCount = Number.isFinite(Number(stored?.skipCount))
      ? Math.max(0, Number(stored.skipCount))
      : 0;
    const graceType = rule.graceType === 'skips' ? 'skips' : 'days';
    const graceLimit = Number.isInteger(Number(rule.graceLimit))
      ? Math.max(0, Number(rule.graceLimit))
      : 0;
    const notifyEnabled = rule.notifyEnabled !== false;
    const remindEveryDays = Number.isInteger(Number(rule.remindEveryDays))
      ? Math.max(0, Number(rule.remindEveryDays))
      : 0;
    const lastPromptedAt = asDate(stored?.lastPromptedAt);
    const lastSkippedAt = asDate(stored?.lastSkippedAt);
    const lastAskedAt = laterDate(lastPromptedAt, lastSkippedAt);

    let blocking = false;
    let remaining = 0;
    const recordFirstNotification = firstNotifiedAt == null;

    if (graceType === 'days') {
      const start = firstNotifiedAt || clock;
      const endsAt = start.getTime() + (graceLimit * DAY_MS);
      const leftMs = endsAt - clock.getTime();
      blocking = graceLimit === 0 || leftMs <= 0;
      remaining = blocking ? 0 : Math.ceil(leftMs / DAY_MS);
    } else {
      blocking = skipCount >= graceLimit;
      remaining = blocking ? 0 : graceLimit - skipCount;
    }

    let campaignDay = null;
    if (rule.requiredSince) {
      const campaignStart = asDate(rule.requiredSince);
      if (!campaignStart) {
        campaignDay = CAMPAIGN_BLOCK_DAY;
        blocking = true;
        remaining = 0;
      } else {
        campaignDay = campaignDayIndex(campaignStart, clock);
        if (graceLimit === 0 || campaignBlocksAccess(campaignDay)) {
          blocking = true;
          remaining = 0;
        }
      }
    }

    const quietUntil = !blocking && lastAskedAt && remindEveryDays > 0
      ? lastAskedAt.getTime() + (remindEveryDays * DAY_MS)
      : null;
    const waiting = !blocking && quietUntil != null && clock.getTime() < quietUntil;
    const showPrompt = !waiting;
    const recordPrompt = showPrompt && !blocking && remindEveryDays > 0;

    fields.push({
      fieldKey,
      label: entry.label,
      editor: entry.editor,
      saveMethod: entry.saveMethod,
      protectedSave: entry.protectedSave,
      editorMinAppVersion: entry.editorMinAppVersion,
      graceType,
      graceLimit,
      remaining,
      blocking,
      showPrompt,
      notifyEnabled,
      remindEveryDays,
      positionScope: rule.positionScope === 'specific' ? 'specific' : 'all',
      positionCodes: Array.isArray(rule.positionCodes) ? rule.positionCodes : [],
      campaignDay,
      recordFirstNotification,
      recordPrompt,
    });
  }

  return {
    blocked: fields.some((field) => field.blocking),
    status: 'ok',
    enforcement: 'evaluated',
    fields,
    unknownFieldKeys,
  };
}

/**
 * Decide one skip. Does not write a profile value.
 * The repository must apply skips with a conditional update:
 *   WHERE skip_count = expectedSkipCount AND skip_count < grace_limit
 * so two devices cannot both consume the last skip.
 *
 * @param {{
 *   rule?: object|null,
 *   profile?: object|null,
 *   grace?: object|null,
 *   role?: string|null,
 *   appVersion?: string|null,
 *   now?: Date,
 * }} input
 */
export function planSkip({
  rule = null,
  profile = null,
  grace = null,
  role = null,
  appVersion = null,
  now = new Date(),
} = {}) {
  const fieldKey = String(rule?.fieldKey || '');
  if (!isRegisteredFieldKey(fieldKey)) {
    return { ok: false, reason: 'unknown-field' };
  }
  const evaluation = evaluateMandatoryFields({
    rules: [rule],
    profile,
    graceRows: grace ? [{ ...grace, fieldKey }] : [],
    role,
    appVersion,
    now,
  });
  if (evaluation.status === 'profile-unavailable') {
    return { ok: false, reason: 'profile-unavailable', marksComplete: false };
  }
  const field = evaluation.fields.find((item) => item.fieldKey === fieldKey);
  if (!field) return { ok: false, reason: 'not-outstanding' };
  if (field.blocking) return { ok: false, reason: 'grace-expired' };

  const expectedSkipCount = Number.isFinite(Number(grace?.skipCount))
    ? Math.max(0, Number(grace.skipCount))
    : 0;

  if (field.graceType === 'days') {
    return {
      ok: true,
      fieldKey,
      increment: false,
      expectedSkipCount,
      nextSkipCount: expectedSkipCount,
      marksComplete: false,
    };
  }

  if (expectedSkipCount >= field.graceLimit) {
    return { ok: false, reason: 'grace-expired' };
  }

  return {
    ok: true,
    fieldKey,
    increment: true,
    expectedSkipCount,
    nextSkipCount: expectedSkipCount + 1,
    marksComplete: false,
  };
}
