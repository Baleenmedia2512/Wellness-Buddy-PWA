/**
 * Client checks before PUT /api/admin/mandatory-fields/:fieldKey.
 * The server remains the authority and repeats these checks.
 */
import { isAdminLikeRole } from '../../../shared/constants/roles';

export function canConfigureMandatoryFields(role) {
  return isAdminLikeRole(role);
}

/** Drop rows that are not registry field objects. Admins cannot type a column name. */
export function registeredAdminFields(fields) {
  return (Array.isArray(fields) ? fields : []).filter((field) => {
    const key = field?.fieldKey;
    return typeof key === 'string' && /^[a-z][a-zA-Z0-9]{0,40}$/.test(key) && typeof field.label === 'string';
  });
}

const AUDIENCES = new Set(['member', 'coach', 'both']);
const GRACE_TYPES = new Set(['days', 'skips']);

function versionParts(value) {
  const match = String(value || '').trim().match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

export function versionIsAtLeast(appVersion, floor) {
  const have = versionParts(appVersion);
  const need = versionParts(floor);
  if (!need) return true;
  if (!have) return false;
  for (let i = 0; i < 3; i += 1) {
    if (have[i] > need[i]) return true;
    if (have[i] < need[i]) return false;
  }
  return true;
}

/**
 * @param {object} draft
 * @param {{ editorMinAppVersion?: string, fieldKey?: string }} field
 * @returns {{ ok: true, rule: object }|{ ok: false, message: string }}
 */
export function validateAdminRuleDraft(draft, field) {
  const audience = String(draft?.audience || '').trim();
  if (!AUDIENCES.has(audience)) {
    return { ok: false, message: 'Audience must be Members, Coaches, or Both.' };
  }
  const graceType = String(draft?.graceType || '').trim();
  if (!GRACE_TYPES.has(graceType)) {
    return { ok: false, message: 'Grace type must be Days or Skips.' };
  }
  const graceLimit = Number(draft?.graceLimit);
  if (!Number.isInteger(graceLimit) || graceLimit < 0) {
    return { ok: false, message: 'Grace limit must be a whole number. Zero blocks immediately.' };
  }
  const remindEveryDays = draft?.remindEveryDays === '' || draft?.remindEveryDays == null
    ? 0
    : Number(draft.remindEveryDays);
  if (!Number.isInteger(remindEveryDays) || remindEveryDays < 0) {
    return { ok: false, message: 'Reminder interval must be a whole number of days. Zero asks on every visit.' };
  }
  const minAppVersion = String(draft?.minAppVersion || '').trim();
  const floor = field?.editorMinAppVersion || '0.0.0';
  if (!versionIsAtLeast(minAppVersion, floor)) {
    return { ok: false, message: `Minimum app version must be ${floor} or newer.` };
  }
  let positionScope = 'all';
  let positionCodes = [];
  if (field?.fieldKey === 'communityPosition') {
    positionScope = draft?.positionScope === 'specific' ? 'specific' : 'all';
    if (positionScope === 'specific') {
      const raw = Array.isArray(draft?.positionCodes) ? draft.positionCodes : [];
      positionCodes = [...new Set(raw.map((code) => String(code || '').trim().replace(/\s+/g, ' ').toUpperCase()).filter(Boolean))];
      if (positionCodes.length === 0) {
        return { ok: false, message: 'Choose at least one community position.' };
      }
    }
  }
  return {
    ok: true,
    rule: {
      required: draft?.required === true,
      graceType,
      graceLimit,
      audience,
      minAppVersion,
      notifyEnabled: draft?.notifyEnabled !== false,
      remindEveryDays,
      positionScope,
      positionCodes,
    },
  };
}
