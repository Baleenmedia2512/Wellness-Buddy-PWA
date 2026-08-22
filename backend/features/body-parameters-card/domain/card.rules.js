import { computeKatchMcArdleBmr, resolveBmrForSave } from '../../../utils/bmrCalculations.js';

/**
 * card.rules.js — Pure business logic for Body Parameters Card.
 * No I/O. No imports from axios, pg, supabase, or react.
 */

export const SHARE_TTL_DAYS = 30;

/**
 * Derive BMR from weight + body fat when possible; otherwise keep manual value.
 *
 * @param {{ weightKg?: number|null, fatPercent?: number|null, manualBmr?: number|null, preferManual?: boolean }} input
 * @returns {number|null}
 */
export function resolveCardBmr({ weightKg = null, fatPercent = null, manualBmr = null, preferManual = false }) {
  if (!preferManual) {
    const calculated = computeKatchMcArdleBmr(weightKg, fatPercent);
    if (calculated !== null) return calculated;
  }
  return resolveBmrForSave({
    weightKg,
    bodyFatPercent: fatPercent,
    manualBmr,
  });
}

/**
 * BMR to push into Profile / weight records from a persisted card row.
 * The stored card.bmr is authoritative (includes manual coach entry);
 * only falls back to Katch-McArdle when the card has no BMR saved.
 *
 * @param {object} card - body_parameters_cards row (snake_case)
 * @returns {number|null}
 */
export function resolveSyncedBmrFromCard(card) {
  if (card?.bmr != null) {
    const stored = Number(card.bmr);
    if (Number.isFinite(stored) && stored > 0) return Math.round(stored);
  }
  return resolveCardBmr({
    weightKg: card?.weight_kg,
    fatPercent: card?.fat_percent,
    manualBmr: null,
  });
}

/**
 * Apply Katch-McArdle BMR to a validated card payload before persistence.
 *
 * @param {object} payload - validated create/update payload
 * @returns {object} payload with `bmr` resolved
 */
export function enrichPayloadWithCalculatedBmr(payload) {
  const preferManual = Boolean(payload.bmrManualOverride);
  return {
    ...payload,
    bmr: resolveCardBmr({
      weightKg: payload.weightKg,
      fatPercent: payload.fatPercent,
      manualBmr: payload.bmr,
      preferManual,
    }),
  };
}

/**
 * Build team_table insert fields for a new lead captured via body-parameters card.
 * Phone canonicalization happens in the data layer before insert.
 * CoachId is intentionally omitted — the member chooses their coach during
 * Setup Wizard / OTP onboarding, not from the counsellor who recorded metrics.
 * Any accidental `coachId` / `createdBy` on the input is ignored.
 *
 * @param {{ name: string, heightCm?: number|null, bmr?: number|null, weightKg?: number|null, fatPercent?: number|null }} input
 * @returns {object}
 */
export function buildTeamMemberInsert({ name, heightCm = null, bmr = null, weightKg = null, fatPercent = null }) {
  return {
    UserName: String(name).trim(),
    CoachId: null,
    Height: heightCm ?? null,
    Bmr: resolveCardBmr({ weightKg, fatPercent, manualBmr: bmr }),
  };
}

/**
 * True when a BPC lead still has CoachId set but never completed coach OTP /
 * skip-setup. Any CoachId on such a row is stale (legacy bug or DB default) —
 * clear it so onboarding can assign the real coach after member OTP flow.
 *
 * @param {{
 *   currentCoachId?: number|string|null,
 *   entryUser?: string|null,
 *   setupSkipped?: boolean|null,
 *   hasApprovedCoachSelection?: boolean,
 * }} input
 * @returns {boolean}
 */
export function shouldClearBpcLeadCoachId({
  currentCoachId = null,
  entryUser = null,
  setupSkipped = null,
  hasApprovedCoachSelection = false,
} = {}) {
  if (setupSkipped === true) return false;
  if (hasApprovedCoachSelection) return false;
  if (String(entryUser || '').trim() !== 'Body Parameters Card') return false;

  const coachN = parseInt(currentCoachId, 10);
  return Number.isFinite(coachN) && coachN > 0;
}

/**
 * @deprecated Prefer shouldClearBpcLeadCoachId — kept for callers that only
 * detached when counsellorId matched CoachId.
 */
export function shouldDetachCounsellorCoachAssignment({
  currentCoachId = null,
  counsellorId = null,
  entryUser = null,
  setupSkipped = null,
  hasApprovedCoachSelection = false,
} = {}) {
  if (!shouldClearBpcLeadCoachId({
    currentCoachId,
    entryUser,
    setupSkipped,
    hasApprovedCoachSelection,
  })) {
    return false;
  }

  const coachN = parseInt(currentCoachId, 10);
  const counsellorN = parseInt(counsellorId, 10);
  if (!Number.isFinite(counsellorN) || counsellorN < 1) return false;
  return coachN === counsellorN;
}

/**
 * Determine whether a card's share link is still valid.
 *
 * @param {string|Date} shareExpiresAt - timestamptz from DB
 * @param {Date} [now] - injectable clock for testing
 * @returns {boolean}
 */
export function isCardShareValid(shareExpiresAt, now = new Date()) {
  if (!shareExpiresAt) return false;
  return new Date(shareExpiresAt) > now;
}

/**
 * Build the profile fields that should be written to team_table when a
 * link recipient saves a card to their profile.
 * Age / measurements stay card-only; Gender syncs when Male/Female.
 *
 * @param {object} card - row from body_parameters_cards
 * @returns {{ name: string|null, height: number|null, bmr: number|null, gender: string|null }}
 */
export function buildProfilePatch(card) {
  const genderRaw = card.gender != null ? String(card.gender).trim() : '';
  const gender = (genderRaw === 'Male' || genderRaw === 'Female') ? genderRaw : null;
  return {
    name: card.name != null && String(card.name).trim()
      ? String(card.name).trim()
      : null,
    height: card.height_cm ?? null,
    bmr: resolveSyncedBmrFromCard(card),
    gender,
  };
}

/**
 * Build the weight-record fields to insert when a link recipient saves.
 * Only fields that exist in weight_records_table are included.
 *
 * @param {object} card - row from body_parameters_cards
 * @param {number} userId
 * @returns {object|null} null if there is nothing worth inserting
 */
export function buildWeightRecord(card, userId) {
  const weight = card.weight_kg;
  if (!weight) return null; // weight is mandatory for a weight_records_table row
  const bmr = resolveSyncedBmrFromCard(card);
  return {
    UserId:    userId,
    Weight:    weight,
    Bmi:       card.bmi       ?? null,
    BodyFat:   card.fat_percent ?? null,
    Bmr:       bmr,
    // MuscleMass not on the card — omit
  };
}

/**
 * Compute BMI from height (cm) and weight (kg). Matches BPC form auto-fill.
 *
 * @param {number|string|null|undefined} heightCm
 * @param {number|string|null|undefined} weightKg
 * @returns {number|null}
 */
export function computeBmiFromHeightWeight(heightCm, weightKg) {
  const h = Number(heightCm);
  const w = Number(weightKg);
  if (!Number.isFinite(h) || h < 50 || h > 250) return null;
  if (!Number.isFinite(w) || w < 20 || w > 300) return null;
  const m = h / 100;
  return Math.round((w / (m * m)) * 10) / 10;
}

/**
 * Whether a BMI value is within card.schema.js / DB persistence bounds.
 *
 * @param {number|null|undefined} bmi
 * @returns {boolean}
 */
export function isPersistableBmi(bmi) {
  const n = Number(bmi);
  return Number.isFinite(n) && n >= 5 && n <= 70;
}

/**
 * Check whether the BMI target range is met for the given gender.
 * Target BMI: 19–23 for both genders.
 *
 * @param {number|null} bmi
 * @returns {'low'|'normal'|'high'|null}
 */
export function classifyBmi(bmi) {
  if (bmi === null || bmi === undefined) return null;
  if (bmi < 19) return 'low';
  if (bmi <= 23) return 'normal';
  return 'high';
}

/**
 * Check whether the fat% is within the healthy range.
 * Male: 10–20 %, Female: 20–30 %.
 *
 * @param {number|null} fatPercent
 * @param {'Male'|'Female'|'Other'|null} gender
 * @returns {'low'|'normal'|'high'|null}
 */
export function classifyFatPercent(fatPercent, gender) {
  if (fatPercent === null || fatPercent === undefined) return null;
  const [lo, hi] = gender === 'Female' ? [20, 30] : [10, 20];
  if (fatPercent < lo) return 'low';
  if (fatPercent <= hi) return 'normal';
  return 'high';
}

/**
 * Build the form pre-fill object from a team_table member row returned by the
 * phone-search endpoint. Only populates fields that are present and non-null.
 * Caller must merge this onto the existing form state (do not replace).
 *
 * @param {object} member
 * @returns {object}
 */
export function buildFormPrefillFromMember(member) {
  if (!member) return {};
  const patch = {};
  if (member.userName && String(member.userName).trim()) {
    patch.name = String(member.userName).trim();
  }
  if (member.heightCm != null && !isNaN(Number(member.heightCm))) {
    patch.heightCm = String(member.heightCm);
  }
  if (member.bmr != null && !isNaN(Number(member.bmr))) {
    patch.bmr = String(member.bmr);
  }
  if (member.gender === 'Male' || member.gender === 'Female' || member.gender === 'Other') {
    patch.gender = member.gender;
  }
  const copyNum = (key, dest = key) => {
    if (member[key] != null && !isNaN(Number(member[key]))) {
      patch[dest] = String(member[key]);
    }
  };
  copyNum('age');
  copyNum('visceralFat');
  copyNum('bodyAge');
  copyNum('chestCm');
  copyNum('waistCm');
  copyNum('hipCm');
  copyNum('fatPercent');
  copyNum('bmi');
  copyNum('weightKg');
  return patch;
}
