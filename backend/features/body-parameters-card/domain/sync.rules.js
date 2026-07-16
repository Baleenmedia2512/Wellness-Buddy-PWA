/**
 * sync.rules.js — Pure bidirectional sync rules between Body Parameters Card
 * and Profile (team_table + latest weight_records_table).
 *
 * Syncable intersection only (fields that exist in both modules):
 *   Name, Height, BMR  → team_table
 *   Weight, Fat %, BMI → weight_records_table (latest)
 *
 * Card-only (Age, Gender, Visceral Fat, Body Age, Chest, Waist, Hip) are
 * intentionally excluded — Profile has no storage for them.
 *
 * No I/O. Callers must skip the reciprocal sync path (write via repo, not
 * through the other feature's update pipeline) to prevent circular updates.
 */
import { resolveSyncedBmrFromCard } from './card.rules.js';

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
 * Build a team_table patch from a card row, including only changed fields.
 *
 * @param {object} card - body_parameters_cards row (snake_case)
 * @param {{ userName?: string|null, height?: number|null, bmr?: number|null }} currentProfile
 * @returns {{ UserName?: string, Height?: number, Bmr?: number }}
 */
export function buildTeamTableDiff(card, currentProfile = {}) {
  if (!card) return {};

  const nextName = card.name != null && String(card.name).trim()
    ? String(card.name).trim()
    : null;
  const nextHeight = card.height_cm ?? null;
  const nextBmr = resolveSyncedBmrFromCard(card);

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
 * @param {{ name?: string|null, height?: number|null, bmr?: number|null, weightKg?: number|null, fatPercent?: number|null, bmi?: number|null }} profile
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
  if (profile.weightKg != null && !syncValuesEqual(profile.weightKg, card.weight_kg)) {
    diff.weight_kg = Number(profile.weightKg);
  }
  if (profile.fatPercent != null && !syncValuesEqual(profile.fatPercent, card.fat_percent)) {
    diff.fat_percent = Number(profile.fatPercent);
  }
  if (profile.bmi != null && !syncValuesEqual(profile.bmi, card.bmi)) {
    diff.bmi = Number(profile.bmi);
  }
  return diff;
}

/**
 * Whether a team_table / weight sync would write anything.
 *
 * @param {{ UserName?: string, Height?: number, Bmr?: number }} teamDiff
 * @param {object|null} weightRow
 * @returns {boolean}
 */
export function hasSyncWrites(teamDiff, weightRow) {
  return (teamDiff && Object.keys(teamDiff).length > 0) || Boolean(weightRow);
}
