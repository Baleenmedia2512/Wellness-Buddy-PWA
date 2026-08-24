/**
 * sync.rules.js — Pure bidirectional sync rules between Body Parameters Card
 * and Profile (team_table + latest weight_records_table).
 *
 * Syncable intersection (fields that exist in both modules):
 *   Name, Height, BMR, Gender, Age, VisceralFat, BodyAge, Chest/Waist/Hip → team_table
 *   Weight, Fat %, BMI        → weight_records_table (latest)
 *
 * No I/O. Callers must skip the reciprocal sync path (write via repo, not
 * through the other feature's update pipeline) to prevent circular updates.
 */
import {
  computeBmiFromHeightWeight,
  isPersistableBmi,
  resolveSyncedBmrFromCard,
} from './card.rules.js';

const PROFILE_GENDERS = ['Male', 'Female'];

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
 * }} currentProfile
 * @returns {object}
 */
export function buildTeamTableDiff(card, currentProfile = {}) {
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
 * @param {{ name?: string|null, height?: number|null, bmr?: number|null, gender?: string|null, weightKg?: number|null, fatPercent?: number|null, bmi?: number|null }} profile
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
 * @param {{ name?: string|null, height?: number|string|null, bmr?: number|string|null, gender?: string|null }} profileInput
 * @param {{ savedBmr?: number|null, latestWeight?: { Weight?: number|string|null, BodyFat?: number|string|null, Bmi?: number|string|null }|null }} snapshots
 * @returns {{ name?: string, height?: number, bmr?: number, gender?: string, weightKg?: number, fatPercent?: number, bmi?: number }}
 */
export function buildProfileCardSyncPayload(profileInput = {}, { savedBmr = null, latestWeight = null } = {}) {
  const { name, height, bmr, gender } = profileInput;
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
