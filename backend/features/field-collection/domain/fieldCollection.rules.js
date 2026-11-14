/**
 * Field collection policy — who must fill which profile field, and when.
 * Pure. No I/O. IST calendar days (UTC+5:30).
 *
 * Every field, including Community Position, follows the admin row:
 * who, which positions, while entering or ask later, and the skip schedule.
 * While entering, a missing field blocks. Ask later can be skipped until
 * the skip limit or the must-fill day, then it blocks.
 * Every (days) is the gap before the next ask. 0 asks again the same day.
 * A field limited to specific positions stays hidden until a position is saved.
 *
 * Mirrors frontend/src/features/field-collection/domain/fieldCollection.rules.js
 */
import { EVENT_LEVEL_OPTIONS } from '../../user/domain/eventProfilePrefs.rules.js';
import {
  canonicalizePositionCode,
  isValidPositionCode,
} from '../../user/domain/communityPosition.rules.js';
import {
  PROFILE_INTRO_KEYS,
  PROFILE_INTRO_LABELS,
  profileIntroHasValue,
} from '../../user/domain/profileIntro.rules.js';

/** Legacy codes used by admin “positions” filters on other fields. */
export const FIELD_COLLECTION_POSITIONS = EVENT_LEVEL_OPTIONS;

const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export const FIELD_KEYS = Object.freeze([
  'communityPosition',
  'gender',
  'age',
  'height',
  'diet',
  'lifestyle',
  'photoLeft',
  'photoCentre',
  'photoRight',
  'currentWeight',
  'fatPercent',
  'bodyAge',
  'chest',
  'waist',
  'hip',
  'healthIssues',
  ...PROFILE_INTRO_KEYS,
]);

export const ENTRY_SCALAR_KEYS = Object.freeze(['gender', 'age', 'height', 'diet']);

export const PHOTO_SLOT_BY_KEY = Object.freeze({
  photoLeft: 'left',
  photoCentre: 'front',
  photoRight: 'right',
});

const PHOTO_KEYS = Object.freeze(Object.keys(PHOTO_SLOT_BY_KEY));

export const FIELD_LABELS = Object.freeze({
  communityPosition: 'Community Position',
  gender: 'Gender',
  age: 'Age',
  height: 'Height',
  diet: 'Diet',
  lifestyle: 'Lifestyle',
  photoLeft: 'Left photo',
  photoCentre: 'Centre photo',
  photoRight: 'Right photo',
  currentWeight: 'Current weight',
  fatPercent: 'Fat %',
  bodyAge: 'Body age',
  chest: 'Chest',
  waist: 'Waist',
  hip: 'Hip',
  healthIssues: 'Health issues',
  ...PROFILE_INTRO_LABELS,
});

const SCHEDULED_DEFAULTS = Object.freeze({
  currentWeight: { askEveryDays: 1 },
  fatPercent: { askEveryDays: 3 },
  bodyAge: { askEveryDays: 3 },
  chest: { askEveryDays: 3 },
  waist: { askEveryDays: 3 },
  hip: { askEveryDays: 3 },
  healthIssues: { askEveryDays: 1 },
});

const DEFAULT_MAX_SKIPS = 2;

function scheduledMustFillDays(askEveryDays) {
  return askEveryDays * (DEFAULT_MAX_SKIPS + 1);
}

function blank(value) {
  if (value == null) return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'string') return value.trim() === '';
  return false;
}

function asNumber(value) {
  if (value == null || value === '') return null;
  const n = typeof value === 'number' ? value : Number(String(value).trim());
  return Number.isFinite(n) ? n : null;
}

/**
 * @param {unknown} role
 * @returns {'member'|'coach'|'exempt'}
 */
export function collectionRoleFromAppRole(role) {
  const normalized = String(role || '').trim().toLowerCase();
  if (normalized === 'admin' || normalized === 'developer') return 'exempt';
  if (normalized === 'coach' || normalized === 'upline') return 'coach';
  return 'member';
}

export function istDayIndex(date) {
  const ms = date instanceof Date ? date.getTime() : new Date(date).getTime();
  if (!Number.isFinite(ms)) return null;
  return Math.floor((ms + IST_OFFSET_MS) / DAY_MS);
}

/** Whole IST calendar days from `earlier` to `later`. */
export function istDaysSince(earlier, later) {
  if (!earlier) return Number.POSITIVE_INFINITY;
  const a = istDayIndex(earlier);
  const b = istDayIndex(later);
  if (a == null || b == null) return Number.POSITIVE_INFINITY;
  return b - a;
}

export function hasFieldValue(key, values = {}) {
  if (key === 'communityPosition') {
    // Catalog roles (e.g. WORLD TEAM) are valid profile values — do not
    // require the legacy hard-coded list or field collection keeps asking.
    const code = canonicalizePositionCode(values.communityPosition);
    return Boolean(code) && isValidPositionCode(code);
  }
  if (key === 'gender') {
    const g = String(values.gender || '').trim();
    return g === 'Male' || g === 'Female';
  }
  if (key === 'age') {
    const n = asNumber(values.age);
    return n != null && n >= 1 && n <= 120;
  }
  if (key === 'height') {
    const n = asNumber(values.height);
    return n != null && n >= 50 && n <= 250;
  }
  if (key === 'diet') return !blank(values.diet);
  if (key === 'lifestyle') return !blank(values.lifestyle);
  if (key === 'photoLeft' || key === 'photoCentre' || key === 'photoRight') {
    return !blank(values[key]);
  }
  if (key === 'currentWeight') {
    const n = asNumber(values.currentWeight);
    return n != null && n >= 20 && n <= 300;
  }
  if (key === 'fatPercent') {
    const n = asNumber(values.fatPercent);
    return n != null && n >= 1 && n <= 70;
  }
  if (key === 'bodyAge') {
    const n = asNumber(values.bodyAge);
    return n != null && n >= 1 && n <= 120;
  }
  if (key === 'chest' || key === 'waist' || key === 'hip') {
    const n = asNumber(values[key]);
    return n != null && n >= 30 && n <= 200;
  }
  if (key === 'healthIssues') {
    return Array.isArray(values.healthIssues) && values.healthIssues.length > 0;
  }
  if (PROFILE_INTRO_KEYS.includes(key)) return profileIntroHasValue(key, values);
  return false;
}

export function defaultFieldConfig(key) {
  if (PROFILE_INTRO_KEYS.includes(key)) {
    return {
      key,
      label: FIELD_LABELS[key],
      phase: 'profile',
      audience: 'both',
      positions: 'all',
      askEveryDays: null,
      maxSkips: 0,
      mustFillWithinDays: null,
      locked: false,
    };
  }
  const scheduled = SCHEDULED_DEFAULTS[key];
  if (scheduled) {
    return {
      key,
      label: FIELD_LABELS[key],
      phase: 'scheduled',
      audience: 'both',
      positions: 'all',
      askEveryDays: scheduled.askEveryDays,
      maxSkips: DEFAULT_MAX_SKIPS,
      mustFillWithinDays: scheduledMustFillDays(scheduled.askEveryDays),
      locked: false,
    };
  }
  return {
    key,
    label: FIELD_LABELS[key],
    phase: 'entry',
    audience: 'both',
    positions: 'all',
    askEveryDays: null,
    maxSkips: 0,
    mustFillWithinDays: null,
    locked: false,
  };
}

export function defaultFieldPolicy() {
  return FIELD_KEYS.map((key) => defaultFieldConfig(key));
}

function clampInt(value, min, max, fallback) {
  const n = parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function normalizePositions(raw) {
  if (raw == null || raw === 'all') return 'all';
  if (!Array.isArray(raw)) return 'all';
  const picked = raw
    .map((item) => String(item || '').trim().toUpperCase())
    .filter((item) => FIELD_COLLECTION_POSITIONS.includes(item));
  if (picked.length === 0 || picked.length === FIELD_COLLECTION_POSITIONS.length) return 'all';
  return Array.from(new Set(picked));
}

function audienceAllows(audience, role) {
  if (role === 'exempt') return false;
  if (audience === 'member') return role === 'member';
  if (audience === 'coach') return role === 'coach';
  return role === 'member' || role === 'coach';
}

function positionAllows(positions, userPosition) {
  if (positions === 'all' || !Array.isArray(positions) || positions.length === 0) return true;
  const current = String(userPosition || '').trim().toUpperCase();
  return positions.includes(current);
}

/**
 * @param {unknown} input fields array from admin
 * @returns {object[]}
 */
export function normalizeFieldPolicy(input) {
  const byKey = new Map();
  if (Array.isArray(input)) {
    input.forEach((row) => {
      const key = String(row?.key || '');
      if (FIELD_KEYS.includes(key)) byKey.set(key, row);
    });
  }
  return FIELD_KEYS.map((key) => {
    const base = defaultFieldConfig(key);
    const row = byKey.get(key) || {};
    const phase = row.phase === 'scheduled'
      ? 'scheduled'
      : (row.phase === 'entry' ? 'entry' : (row.phase === 'profile' ? 'profile' : base.phase));
    const audience = row.audience === 'member' || row.audience === 'coach' || row.audience === 'both'
      ? row.audience
      : base.audience;
    const positions = normalizePositions(row.positions === undefined ? base.positions : row.positions);
    if (phase === 'entry' || phase === 'profile') {
      return {
        ...base,
        phase,
        audience,
        positions,
        askEveryDays: null,
        maxSkips: 0,
        mustFillWithinDays: null,
        locked: false,
      };
    }
    const askEveryDays = clampInt(row.askEveryDays, 0, 365, base.askEveryDays ?? 1);
    const maxSkips = clampInt(row.maxSkips, 0, 30, base.maxSkips);
    const mustFillWithinDays = clampInt(
      row.mustFillWithinDays,
      1,
      365,
      base.mustFillWithinDays || scheduledMustFillDays(askEveryDays),
    );
    return {
      ...base,
      phase: 'scheduled',
      audience,
      positions,
      askEveryDays,
      maxSkips,
      mustFillWithinDays,
      locked: false,
    };
  });
}

function emptyState() {
  return {
    skipCount: 0,
    cycleStartedAt: null,
    lastFilledAt: null,
    lastSkippedAt: null,
  };
}

/**
 * @returns {'hidden'|'satisfied'|'ask_blocking'|'ask_skippable'}
 */
export function decideField({
  field,
  values = {},
  state = null,
  role = 'member',
  now,
}) {
  if (!field) return 'hidden';
  if (role === 'exempt') return 'hidden';
  const position = values.communityPosition;
  if (!audienceAllows(field.audience, role)) return 'hidden';
  if (field.key !== 'communityPosition' && !positionAllows(field.positions, position)) return 'hidden';

  if (field.phase === 'profile') return 'satisfied';
  if (field.phase === 'entry') {
    return hasFieldValue(field.key, values) ? 'satisfied' : 'ask_blocking';
  }

  const row = state || emptyState();
  const configuredEvery = Number(field.askEveryDays);
  const askEveryDays = Number.isFinite(configuredEvery) ? configuredEvery : 1;
  // Profile-intro facts (joining date, title, …) stay on the profile once saved.
  // Every 0 days must not re-block after the value is already stored — that loop
  // was showing About you again right after Continue. Interval > 0 still nudges
  // via lastFilledAt below (loadContext stamps it when the value exists).
  if (
    PROFILE_INTRO_KEYS.includes(field.key)
    && hasFieldValue(field.key, values)
    && askEveryDays <= 0
  ) {
    return 'satisfied';
  }
  const filledAnchor = field.key === 'currentWeight'
    ? (values.weightRecordedAt || row.lastFilledAt)
    : row.lastFilledAt;
  const daysSinceFill = istDaysSince(filledAnchor, now);
  // 0 means the same day is already due, including after a skip or a fill today.
  if (askEveryDays > 0 && filledAnchor && daysSinceFill < askEveryDays) return 'satisfied';

  const deadlineHit = Boolean(
    row.cycleStartedAt
    && field.mustFillWithinDays != null
    && istDaysSince(row.cycleStartedAt, now) >= field.mustFillWithinDays,
  );
  const skipsHit = row.skipCount >= (field.maxSkips || 0);
  // A skip covers the current ask window — including the last remaining skip.
  // Exhausted skips become blocking only on the *next* due ask, not immediately
  // after the user taps Skip (that felt like skip was broken).
  // Must-fill deadline still wins over a recent skip.
  const skippedRecently = askEveryDays > 0 && Boolean(
    row.lastSkippedAt && istDaysSince(row.lastSkippedAt, now) < askEveryDays,
  );
  if (skippedRecently && !deadlineHit) return 'satisfied';
  if (deadlineHit || skipsHit) return 'ask_blocking';
  return 'ask_skippable';
}

/**
 * Next screen for this person.
 * Entry fields first, including Community Position when it is set to
 * while entering. Then photos, lifestyle, then the first later field that is due.
 */
export function planCollectionStep({
  fields,
  values = {},
  states = {},
  role = 'member',
  now,
  deferKeys = [],
}) {
  const policy = normalizeFieldPolicy(fields);
  const decisions = policy.map((field) => ({
    field,
    mode: decideField({
      field,
      values,
      state: states[field.key] || null,
      role,
      now,
    }),
  }));

  const community = decisions.find((item) => item.field.key === 'communityPosition');
  if (community?.field.phase === 'entry' && community.mode === 'ask_blocking') {
    return {
      step: 'communityPosition',
      entryFields: [],
      photoSlots: [],
      scheduled: null,
    };
  }

  const entryFields = decisions
    .filter((item) => ENTRY_SCALAR_KEYS.includes(item.field.key) && item.mode === 'ask_blocking')
    .map((item) => item.field.key);
  if (entryFields.length > 0) {
    return { step: 'entryFields', entryFields, photoSlots: [], scheduled: null };
  }

  const photoSlots = decisions
    .filter((item) => PHOTO_KEYS.includes(item.field.key) && item.mode === 'ask_blocking')
    .map((item) => PHOTO_SLOT_BY_KEY[item.field.key]);
  if (photoSlots.length > 0) {
    return { step: 'photos', entryFields: [], photoSlots, scheduled: null };
  }

  const lifestyle = decisions.find((item) => item.field.key === 'lifestyle');
  if (lifestyle?.mode === 'ask_blocking') {
    return { step: 'lifestyle', entryFields: [], photoSlots: [], profileFields: [], scheduled: null };
  }

  // Only while-entering intro fields use the About you page. Ask-later intro
  // fields stay on the scheduled prompt (skip / session defer / mark filled).
  const profileFields = decisions
    .filter((item) => (
      item.field.phase === 'entry'
      && PROFILE_INTRO_KEYS.includes(item.field.key)
      && item.mode === 'ask_blocking'
    ))
    .map((item) => item.field.key);
  if (profileFields.length > 0) {
    return { step: 'profileIntro', entryFields: [], photoSlots: [], profileFields, scheduled: null };
  }

  const deferred = new Set(deferKeys);
  const scheduled = decisions.find((item) => {
    // Every 0 days: skip/save only clears the field for this app visit.
    // Honor defer even if that skip exhausted maxSkips (mode → ask_blocking).
    const passedForNow = Number(item.field.askEveryDays) === 0
      && deferred.has(item.field.key);
    return item.field.phase === 'scheduled'
      && (item.mode === 'ask_blocking' || item.mode === 'ask_skippable')
      && !passedForNow;
  });
  if (scheduled) {
    const state = states[scheduled.field.key] || emptyState();
    return {
      step: 'scheduled',
      entryFields: [],
      photoSlots: [],
      scheduled: {
        key: scheduled.field.key,
        label: scheduled.field.label,
        mode: scheduled.mode,
        askEveryDays: scheduled.field.askEveryDays,
        maxSkips: scheduled.field.maxSkips,
        mustFillWithinDays: scheduled.field.mustFillWithinDays,
        skipCount: state.skipCount || 0,
        skipsRemaining: Math.max(0, (scheduled.field.maxSkips || 0) - (state.skipCount || 0)),
      },
    };
  }

  return { step: 'done', entryFields: [], photoSlots: [], scheduled: null };
}

export function valuesFromProfile(data = {}) {
  const metrics = data?.bodyMetrics || {};
  const photos = data?.transformationPhotos || {};
  const issues = data?.recoveredHealthIssues;
  return {
    communityPosition: data?.eventLevel
      || data?.communityPosition?.code
      || data?.CommunityPosition?.code
      || '',
    gender: data?.gender || metrics.gender || '',
    age: metrics.age ?? '',
    height: data?.height ?? '',
    diet: data?.dietType || '',
    lifestyle: data?.physicalActivityLevel || '',
    photoLeft: photos.left || '',
    photoCentre: photos.front || '',
    photoRight: photos.right || '',
    currentWeight: data?.latestWeight ?? '',
    weightRecordedAt: data?.weightRecordDate || null,
    fatPercent: data?.bodyFat ?? data?.latestWeightBodyFat ?? metrics.fatPercent ?? '',
    bodyAge: metrics.bodyAge ?? '',
    chest: metrics.chestCm ?? '',
    waist: metrics.waistCm ?? '',
    hip: metrics.hipCm ?? '',
    healthIssues: Array.isArray(issues) ? issues : [],
    professionalTitle: data?.professionalTitle || '',
    instagram: data?.instagram || '',
    youtube: data?.youtube || '',
    linkedin: data?.linkedin || '',
    herbalifeJoinedOn: data?.herbalifeJoinedOn || '',
    aboutMe: data?.aboutMe || '',
    qualification: data?.qualification || '',
    languages: Array.isArray(data?.languages) ? data.languages : [],
  };
}

export function stateMapFromRows(rows) {
  const map = {};
  (rows || []).forEach((row) => {
    const key = row.field_key || row.fieldKey;
    if (!key) return;
    map[key] = {
      skipCount: Number(row.skip_count ?? row.skipCount) || 0,
      cycleStartedAt: row.cycle_started_at || row.cycleStartedAt || null,
      lastFilledAt: row.last_filled_at || row.lastFilledAt || null,
      lastSkippedAt: row.last_skipped_at || row.lastSkippedAt || null,
    };
  });
  return map;
}
