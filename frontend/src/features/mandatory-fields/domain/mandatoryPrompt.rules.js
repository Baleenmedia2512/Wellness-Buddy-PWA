/**
 * What the member screen shows. The backend evaluation is the source of truth.
 * This file only decides which returned rows are visible and whether Skip is allowed.
 */

function versionParts(value) {
  const match = String(value || '').trim().match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/**
 * @param {string|null|undefined} appVersion
 * @param {string|null|undefined} required
 * @returns {boolean} true when appVersion is missing, invalid, or older than required
 */
export function isBelowEditorVersion(appVersion, required) {
  const need = versionParts(required);
  if (!need) return false;
  const have = versionParts(appVersion);
  if (!have) return true;
  for (let i = 0; i < 3; i += 1) {
    if (have[i] > need[i]) return false;
    if (have[i] < need[i]) return true;
  }
  return false;
}

/**
 * Blocking rows are the grace-limit 0 fields. They share one required screen.
 * The other rows share the grace screen and keep Skip.
 *
 * @param {object[]} rows
 * @returns {{ requiredNow: object[], grace: object[] }}
 */
export function partitionOutstanding(rows) {
  const requiredNow = [];
  const grace = [];
  for (const field of rows || []) {
    if (!field?.fieldKey) continue;
    if (field.blocking === true) requiredNow.push(field);
    else grace.push(field);
  }
  return { requiredNow, grace };
}

/**
 * When any field is blocking, every outstanding row is shown together.
 * Otherwise only rows whose reminder is due (showPrompt) are shown.
 *
 * @param {{ blocked?: boolean, fields?: object[] }|null|undefined} evaluation
 * @returns {object[]}
 */
export function rowsToShow(evaluation) {
  const fields = Array.isArray(evaluation?.fields) ? evaluation.fields : [];
  const locked = evaluation?.blocked === true || fields.some((field) => field?.blocking === true);
  if (locked) return fields.filter((field) => field && field.fieldKey);
  return fields.filter((field) => field && field.fieldKey && field.showPrompt === true);
}

export function screenIsLocked(evaluation) {
  if (!evaluation) return false;
  if (evaluation.blocked === true) return true;
  return (evaluation.fields || []).some((field) => field?.blocking === true);
}

export function canSkipField(field) {
  return Boolean(field) && field.blocking !== true;
}

/**
 * @param {object|null|undefined} field
 * @returns {string}
 */
export function graceStatusText(field) {
  if (!field) return '';
  if (field.blocking) return 'Required now. Skip is not available.';
  if (field.graceType === 'skips') {
    const left = Number(field.remaining) || 0;
    return left === 1 ? '1 skip left' : `${left} skips left`;
  }
  const left = Number(field.remaining) || 0;
  if (left <= 0) return 'Required now. Skip is not available.';
  return left === 1 ? '1 day left before this is required' : `${left} days left before this is required`;
}

export function reminderText(field) {
  const days = Number(field?.remindEveryDays) || 0;
  if (days <= 0) return 'Shown on every visit while this can still be skipped.';
  return days === 1 ? 'Shown again after 1 day.' : `Shown again after ${days} days.`;
}

/**
 * Hide rows the member already passed for this visit when the server still
 * says the reminder is due (interval 0). A blocking row is never hidden.
 *
 * @param {object[]} rows
 * @param {Set<string>|string[]} dismissedKeys
 */
export function rowsAfterVisitDismiss(rows, dismissedKeys) {
  const dismissed = dismissedKeys instanceof Set ? dismissedKeys : new Set(dismissedKeys || []);
  return (rows || []).filter((field) => field.blocking === true || !dismissed.has(field.fieldKey));
}

/**
 * Skip never fills the field and never lengthens a days grace window.
 * The skip API is the only place that records a skip.
 */
export function skipAction(field) {
  if (!canSkipField(field)) return { kind: 'blocked', marksComplete: false, extendsDaysGrace: false };
  return { kind: 'skip', marksComplete: false, extendsDaysGrace: false };
}

/** Continue hides a grace prompt for this visit. It is not a skip. */
export function visitDismissAction(field) {
  if (!field || field.blocking === true) return { kind: 'blocked', callsSkipApi: false };
  return { kind: 'visit-dismiss', callsSkipApi: false };
}

/**
 * A failed profile check does not mean the rules are off.
 * Network errors have no HTTP status. 503 is the server's own unavailable
 * response. Either one keeps the app locked until a successful check.
 */
export function failureLocksApp(error) {
  if (!error) return false;
  return true;
}

export function shouldReloadOnResume({ enabled, editing }) {
  return enabled === true && !editing;
}

/**
 * Mandatory prompts start after name and the base profile form.
 * Left, Centre, and Right are not mandatory-catalog fields, so a blocking
 * profile field is asked before that photo step. The photo step itself does
 * not hide the prompt.
 */
export function shouldEnableMandatoryGate(flags) {
  if (!flags?.user || !flags.isOtpVerified || !flags.isUserActive) return false;
  if (
    flags.showConsentGate
    || flags.showOnboardingIdentity
    || flags.showCompleteProfile
    || flags.showPhysicalActivitySetup
    || flags.showSetupWizard
    || flags.profileChecking
  ) {
    return false;
  }
  if (flags.showValidateOTP && !flags.isInactiveReactivationFlow) return false;
  return true;
}

const PROFILE_FORM_KEYS = new Set(['name', 'gender', 'height', 'diet', 'bodyFat']);

/**
 * Asterisks on Complete Your Profile follow admin Required with grace limit 0.
 * A field that is off, already filled, or still in grace is not forced here.
 *
 * @param {object[]|null|undefined} fields
 * @returns {{ name: boolean, gender: boolean, height: boolean, diet: boolean, bodyFat: boolean }}
 */
export function profileFormRequiredMarks(fields) {
  const blocking = new Set(
    (fields || [])
      .filter((field) => field?.blocking === true && PROFILE_FORM_KEYS.has(field.fieldKey))
      .map((field) => field.fieldKey),
  );
  return {
    name: blocking.has('name'),
    gender: blocking.has('gender'),
    height: blocking.has('height'),
    diet: blocking.has('diet'),
    bodyFat: blocking.has('bodyFat'),
  };
}

/**
 * Complete Your Profile stays up only when one of its editors is required now.
 * Current weight is not a catalog field, so it never keeps this screen open.
 *
 * @param {object[]|null|undefined} fields
 * @returns {boolean}
 */
export function completeProfileNeedsScreen(fields) {
  const marks = profileFormRequiredMarks(fields);
  return marks.name || marks.gender || marks.height || marks.diet || marks.bodyFat;
}

/**
 * Header line for Complete Your Profile. Only blocking catalog fields are named.
 *
 * @param {{ gender?: boolean, height?: boolean, diet?: boolean, bodyFat?: boolean }|null|undefined} marks
 * @returns {string}
 */
export function profileFormSubtitle(marks) {
  const parts = [];
  if (marks?.gender) parts.push('gender');
  if (marks?.height) parts.push('height');
  if (marks?.diet) parts.push('diet');
  if (marks?.bodyFat) parts.push('fat %');
  if (parts.length === 0) {
    return 'Add any details you want — then transformation photos.';
  }
  const list = parts.length === 1
    ? parts[0]
    : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
  const titled = list.charAt(0).toUpperCase() + list.slice(1);
  return `${titled} — then transformation photos.`;
}

/**
 * Hold Left, Centre, and Right until the mandatory check has finished
 * and no field is blocking. Photos are not part of the mandatory catalog.
 *
 * @param {{ photosRequested?: boolean, gateEnabled?: boolean, mandatoryStatus?: string }} input
 * @returns {boolean}
 */
export function holdTransformationPhotos({
  photosRequested = false,
  gateEnabled = false,
  mandatoryStatus = 'idle',
} = {}) {
  if (!photosRequested || !gateEnabled) return false;
  return mandatoryStatus !== 'clear';
}
