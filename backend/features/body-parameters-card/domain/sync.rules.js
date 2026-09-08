/**
 * sync.rules.js — Pure bidirectional sync rules between Body Parameters Card
 * and Profile (team_table + latest weight_records_table).
 *
 * Syncable intersection (fields that exist in both modules):
 *   Name, Height, BMR, Gender, Age, VisceralFat, BodyAge, Chest/Waist/Hip,
 *   recovered_health_issues → team_table
 *   Weight, Fat %, BMI        → weight_records_table (latest)
 *
 * Profile-only fields edited on BCM (not stored on body_parameters_cards):
 *   DietType, PhysicalActivityLevel, transformation_photos — via profileExtras
 *
 * No I/O. Callers must skip the reciprocal sync path (write via repo, not
 * through the other feature's update pipeline) to prevent circular updates.
 */
import {
  computeBmiFromHeightWeight,
  isPersistableBmi,
  resolveSyncedBmrFromCard,
} from './card.rules.js';
import { VALID_DIETS } from '../../user/user.validators.js';
import { isValidPhysicalActivityLevel } from '../../../utils/tdeeCalculations.js';
import {
  hasTransformationPhotoUpdates,
  mergeTransformationPhotos,
  isStoredTransformationPhoto,
} from '../../user/domain/transformationPhotos.rules.js';

const PROFILE_GENDERS = ['Male', 'Female'];

/**
 * Compare recovered-health-issue arrays (order-insensitive).
 * @param {*} a
 * @param {*} b
 * @returns {boolean}
 */
export function syncHealthIssuesEqual(a, b) {
  const norm = (v) => (Array.isArray(v) ? v : [])
    .map((x) => String(x || '').trim())
    .filter(Boolean)
    .map((x) => x.toLowerCase())
    .sort();
  const aa = norm(a);
  const bb = norm(b);
  if (aa.length !== bb.length) return false;
  return aa.every((v, i) => v === bb[i]);
}

/**
 * Normalize gender for team_table (Male | Female only).
 * @param {*} raw
 * @returns {'Male'|'Female'|null}
 */
export function normalizeSyncGender(raw) {
  const g = String(raw || '').trim();
  return PROFILE_GENDERS.includes(g) ? g : null;
}

/**
 * Compare two scalar values for sync purposes.
 * Treats null/undefined/'' as empty. Numbers compared numerically.
 *
 * @param {*} a
 * @param {*} b
 * @returns {boolean}
 */
export function syncValuesEqual(a, b) {
  const emptyA = a === null || a === undefined || a === '';
  const emptyB = b === null || b === undefined || b === '';
  if (emptyA && emptyB) return true;
  if (emptyA || emptyB) return false;

  if (typeof a === 'string' || typeof b === 'string') {
    return String(a).trim() === String(b).trim();
  }

  const na = Number(a);
  const nb = Number(b);
  if (Number.isFinite(na) && Number.isFinite(nb)) {
    return Math.abs(na - nb) < 1e-6;
  }
  return a === b;
}

/**
 * Resolve BMI for a body_parameters_cards patch after height/weight changes.
 * Keeps height, weight, and BMI consistent for body_parameters_cards_bmi_check.
 *
 * @param {{ height_cm?: number|null, weight_kg?: number|null, bmi?: number|null }} card
 * @param {{ height_cm?: number, weight_kg?: number }} diff
 * @returns {number|null|undefined} BMI to set, null to clear, undefined to omit
 */
export function resolveCardBmiForPatch(card, diff = {}) {
  const heightOrWeightChanged = diff.height_cm != null || diff.weight_kg != null;
  const effectiveHeight = diff.height_cm ?? card?.height_cm;
  const effectiveWeight = diff.weight_kg ?? card?.weight_kg;
  const computedBmi = computeBmiFromHeightWeight(effectiveHeight, effectiveWeight);

  if (heightOrWeightChanged) {
    if (computedBmi != null && isPersistableBmi(computedBmi)) return computedBmi;
    if (card?.bmi != null) return null;
    return undefined;
  }

  if (
    computedBmi != null
    && isPersistableBmi(computedBmi)
    && !syncValuesEqual(computedBmi, card?.bmi)
  ) {
    return computedBmi;
  }
  return undefined;
}

/**
 * Build a team_table patch from a card row, including only changed fields.
 *
 * @param {object} card - body_parameters_cards row (snake_case)
 * @param {{
 *   userName?: string|null,
 *   height?: number|null,
 *   bmr?: number|null,
 *   gender?: string|null,
 *   age?: number|null,
 *   visceralFat?: number|null,
 *   bodyAge?: number|null,
 *   chestCm?: number|null,
 *   waistCm?: number|null,
 *   hipCm?: number|null,
 *   dietType?: string|null,
 *   physicalActivityLevel?: string|null,
 *   recoveredHealthIssues?: string[]|null,
 * }} currentProfile
 * @param {{
 *   dietType?: string|null,
 *   physicalActivityLevel?: string|null,
 *   transformationPhotos?: { front?: string|null, left?: string|null, right?: string|null }|null,
 * }} [profileExtras] - Profile fields edited on BCM but not stored on the card table
 * @returns {object}
 */
export function buildTeamTableDiff(card, currentProfile = {}, profileExtras = {}) {
  if (!card) return {};

  const nextName = card.name != null && String(card.name).trim()
    ? String(card.name).trim()
    : null;
  const nextHeight = card.height_cm ?? null;
  const nextBmr = resolveSyncedBmrFromCard(card);
  const nextGender = normalizeSyncGender(card.gender);
  const nextAge = card.age != null && Number.isFinite(Number(card.age)) ? Number(card.age) : null;
  const nextVisceral = card.visceral_fat != null && Number.isFinite(Number(card.visceral_fat))
    ? Number(card.visceral_fat) : null;
  const nextBodyAge = card.body_age != null && Number.isFinite(Number(card.body_age))
    ? Number(card.body_age) : null;
  const nextChest = card.chest_cm != null && Number.isFinite(Number(card.chest_cm))
    ? Number(card.chest_cm) : null;
  const nextWaist = card.waist_cm != null && Number.isFinite(Number(card.waist_cm))
    ? Number(card.waist_cm) : null;
  const nextHip = card.hip_cm != null && Number.isFinite(Number(card.hip_cm))
    ? Number(card.hip_cm) : null;

  const rawDiet = profileExtras.dietType != null ? String(profileExtras.dietType).trim() : '';
  const nextDiet = rawDiet && VALID_DIETS.includes(rawDiet) ? rawDiet : null;
  const rawPal = profileExtras.physicalActivityLevel != null
    ? String(profileExtras.physicalActivityLevel).trim()
    : '';
  const nextPal = rawPal && isValidPhysicalActivityLevel(rawPal) ? rawPal : null;

  const diff = {};
  if (nextName != null && !syncValuesEqual(nextName, currentProfile.userName)) {
    diff.UserName = nextName;
  }
  if (nextHeight != null && !syncValuesEqual(nextHeight, currentProfile.height)) {
    diff.Height = Number(nextHeight);
  }
  if (nextBmr != null && !syncValuesEqual(nextBmr, currentProfile.bmr)) {
    diff.Bmr = Number(nextBmr);
  }
  if (nextGender != null && !syncValuesEqual(nextGender, currentProfile.gender)) {
    diff.Gender = nextGender;
  }
  if (nextAge != null && !syncValuesEqual(nextAge, currentProfile.age)) {
    diff.Age = nextAge;
  }
  if (nextVisceral != null && !syncValuesEqual(nextVisceral, currentProfile.visceralFat)) {
    diff.VisceralFat = nextVisceral;
  }
  if (nextBodyAge != null && !syncValuesEqual(nextBodyAge, currentProfile.bodyAge)) {
    diff.BodyAge = nextBodyAge;
  }
  if (nextChest != null && !syncValuesEqual(nextChest, currentProfile.chestCm)) {
    diff.ChestCm = nextChest;
  }
  if (nextWaist != null && !syncValuesEqual(nextWaist, currentProfile.waistCm)) {
    diff.WaistCm = nextWaist;
  }
  if (nextHip != null && !syncValuesEqual(nextHip, currentProfile.hipCm)) {
    diff.HipCm = nextHip;
  }
  if (nextDiet != null && !syncValuesEqual(nextDiet, currentProfile.dietType)) {
    diff.DietType = nextDiet;
  }
  if (nextPal != null && !syncValuesEqual(nextPal, currentProfile.physicalActivityLevel)) {
    diff.PhysicalActivityLevel = nextPal;
  }

  // Always consider recovered issues when the card column is present (incl. empty clear).
  if (Object.prototype.hasOwnProperty.call(card, 'recovered_health_issues')) {
    const nextIssues = Array.isArray(card.recovered_health_issues)
      ? card.recovered_health_issues
        .filter((x) => typeof x === 'string' && x.trim())
        .map((x) => x.trim())
      : [];
    if (!syncHealthIssuesEqual(nextIssues, currentProfile.recoveredHealthIssues)) {
      diff.recovered_health_issues = nextIssues;
    }
  }

  if (hasTransformationPhotoUpdates(profileExtras.transformationPhotos)) {
    const merged = mergeTransformationPhotos(
      currentProfile.transformationPhotos,
      profileExtras.transformationPhotos,
    );
    diff.transformation_photos = merged;
    // Centre slot also drives ProfileImage (same as Profile module).
    const front = merged?.front;
    if (isStoredTransformationPhoto(front) && front.startsWith('data:image/')) {
      diff.ProfileImage = front;
      diff.profile_pic_snooze = null;
    }
  }

  return diff;
}

/**
 * Build a weight_records insert when card weight metrics differ from latest.
 * Returns null when weight is absent or nothing changed.
 *
 * @param {object} card - body_parameters_cards row (snake_case)
 * @param {number} userId
 * @param {{ weight?: number|null, bodyFat?: number|null, bmi?: number|null, bmr?: number|null }|null} latestWeight
 * @returns {object|null}
 */
export function buildWeightInsertIfChanged(card, userId, latestWeight = null) {
  if (!card?.weight_kg) return null;

  const nextBmr = resolveSyncedBmrFromCard(card);

  const next = {
    weight: Number(card.weight_kg),
    bodyFat: card.fat_percent ?? null,
    bmi: card.bmi ?? null,
    bmr: nextBmr,
  };

  if (latestWeight) {
    const unchanged =
      syncValuesEqual(next.weight, latestWeight.weight) &&
      syncValuesEqual(next.bodyFat, latestWeight.bodyFat) &&
      syncValuesEqual(next.bmi, latestWeight.bmi) &&
      syncValuesEqual(next.bmr, latestWeight.bmr);
    if (unchanged) return null;
  }

  return {
    UserId: userId,
    Weight: next.weight,
    Bmi: next.bmi,
    BodyFat: next.bodyFat,
    Bmr: next.bmr,
  };
}

/**
 * Build a partial card patch from profile / latest-weight fields.
 * Only includes keys that differ from the current card.
 *
 * @param {object} card - latest body_parameters_cards row (snake_case)
 * @param {{
 *   name?: string|null,
 *   height?: number|null,
 *   bmr?: number|null,
 *   gender?: string|null,
 *   weightKg?: number|null,
 *   fatPercent?: number|null,
 *   bmi?: number|null,
 *   age?: number|null,
 *   visceralFat?: number|null,
 *   bodyAge?: number|null,
 *   chestCm?: number|null,
 *   waistCm?: number|null,
 *   hipCm?: number|null,
 *   recoveredHealthIssues?: string[]|null,
 * }} profile
 * @returns {object} snake_case patch for body_parameters_cards
 */
export function buildCardPatchFromProfile(card, profile = {}) {
  if (!card || !profile) return {};

  const diff = {};
  if (profile.name != null && String(profile.name).trim() !== '') {
    const nextName = String(profile.name).trim();
    if (!syncValuesEqual(nextName, card.name)) {
      diff.name = nextName;
    }
  }
  if (profile.height != null && !syncValuesEqual(profile.height, card.height_cm)) {
    diff.height_cm = Number(profile.height);
  }
  if (profile.bmr != null && !syncValuesEqual(profile.bmr, card.bmr)) {
    diff.bmr = Number(profile.bmr);
  }
  const nextGender = normalizeSyncGender(profile.gender);
  if (nextGender != null && !syncValuesEqual(nextGender, card.gender)) {
    diff.gender = nextGender;
  }
  if (profile.weightKg != null && !syncValuesEqual(profile.weightKg, card.weight_kg)) {
    diff.weight_kg = Number(profile.weightKg);
  }
  if (profile.fatPercent != null && !syncValuesEqual(profile.fatPercent, card.fat_percent)) {
    diff.fat_percent = Number(profile.fatPercent);
  }

  const copyNum = (profileKey, cardKey) => {
    if (profile[profileKey] == null || profile[profileKey] === '') return;
    const n = Number(profile[profileKey]);
    if (!Number.isFinite(n)) return;
    if (!syncValuesEqual(n, card[cardKey])) diff[cardKey] = n;
  };
  copyNum('age', 'age');
  copyNum('visceralFat', 'visceral_fat');
  copyNum('bodyAge', 'body_age');
  copyNum('chestCm', 'chest_cm');
  copyNum('waistCm', 'waist_cm');
  copyNum('hipCm', 'hip_cm');

  if (Object.prototype.hasOwnProperty.call(profile, 'recoveredHealthIssues')) {
    const nextIssues = Array.isArray(profile.recoveredHealthIssues)
      ? profile.recoveredHealthIssues
        .filter((x) => typeof x === 'string' && x.trim())
        .map((x) => x.trim())
      : [];
    if (!syncHealthIssuesEqual(nextIssues, card.recovered_health_issues)) {
      diff.recovered_health_issues = nextIssues;
    }
  }

  const nextBmi = resolveCardBmiForPatch(card, diff);
  if (nextBmi === null) {
    if (card.bmi != null) diff.bmi = null;
  } else if (nextBmi !== undefined) {
    diff.bmi = nextBmi;
  }

  return diff;
}

/**
 * Build the Profile → Card sync payload from profile save input and snapshots.
 *
 * @param {{
 *   name?: string|null,
 *   height?: number|string|null,
 *   bmr?: number|string|null,
 *   gender?: string|null,
 *   age?: number|string|null,
 *   visceralFat?: number|string|null,
 *   bodyAge?: number|string|null,
 *   chestCm?: number|string|null,
 *   waistCm?: number|string|null,
 *   hipCm?: number|string|null,
 *   recoveredHealthIssues?: string[]|null,
 * }} profileInput
 * @param {{ savedBmr?: number|null, latestWeight?: { Weight?: number|string|null, BodyFat?: number|string|null, Bmi?: number|string|null }|null }} snapshots
 * @returns {object}
 */
export function buildProfileCardSyncPayload(profileInput = {}, { savedBmr = null, latestWeight = null } = {}) {
  const {
    name, height, bmr, gender,
    age, visceralFat, bodyAge, chestCm, waistCm, hipCm,
    recoveredHealthIssues,
  } = profileInput;
  const cardSync = {};

  if (name != null && String(name).trim() !== '') {
    cardSync.name = String(name).trim();
  }
  if (height != null) {
    const h = parseFloat(height);
    if (!Number.isNaN(h)) cardSync.height = h;
  }

  const effectiveBmr = savedBmr ?? (bmr != null ? parseFloat(bmr) : null);
  if (effectiveBmr != null && !Number.isNaN(effectiveBmr) && effectiveBmr > 0) {
    cardSync.bmr = effectiveBmr;
  }

  const nextGender = normalizeSyncGender(gender);
  if (nextGender) cardSync.gender = nextGender;

  const copyNum = (raw, key) => {
    if (raw == null || raw === '') return;
    const n = parseFloat(raw);
    if (!Number.isNaN(n)) cardSync[key] = n;
  };
  copyNum(age, 'age');
  copyNum(visceralFat, 'visceralFat');
  copyNum(bodyAge, 'bodyAge');
  copyNum(chestCm, 'chestCm');
  copyNum(waistCm, 'waistCm');
  copyNum(hipCm, 'hipCm');

  if (recoveredHealthIssues !== undefined) {
    cardSync.recoveredHealthIssues = Array.isArray(recoveredHealthIssues)
      ? recoveredHealthIssues.filter((x) => typeof x === 'string' && x.trim()).map((x) => x.trim())
      : [];
  }

  if (latestWeight?.Weight != null) {
    const w = parseFloat(latestWeight.Weight);
    if (!Number.isNaN(w)) cardSync.weightKg = w;
  }
  if (latestWeight?.BodyFat != null) {
    const f = parseFloat(latestWeight.BodyFat);
    if (!Number.isNaN(f)) cardSync.fatPercent = f;
  }

  const computedBmi = computeBmiFromHeightWeight(cardSync.height, cardSync.weightKg);
  if (computedBmi != null && isPersistableBmi(computedBmi)) {
    cardSync.bmi = computedBmi;
  }

  return cardSync;
}

/**
 * Whether a team_table / weight sync would write anything.
 *
 * @param {{ UserName?: string, Height?: number, Bmr?: number, Gender?: string }} teamDiff
 * @param {object|null} weightRow
 * @returns {boolean}
 */
export function hasSyncWrites(teamDiff, weightRow) {
  return (teamDiff && Object.keys(teamDiff).length > 0) || Boolean(weightRow);
}
