/**
 * card.rules.js — Pure business logic for Body Parameters Card.
 * No I/O. No imports from axios, pg, supabase, or react.
 */

export const SHARE_TTL_DAYS = 30;

/**
 * Build team_table insert fields for a new lead captured via body-parameters card.
 * Phone canonicalization happens in the data layer before insert.
 *
 * @param {{ name: string, coachId: number, heightCm?: number|null, bmr?: number|null }} input
 * @returns {object}
 */
export function buildTeamMemberInsert({ name, coachId, heightCm = null, bmr = null }) {
  return {
    UserName: String(name).trim(),
    CoachId: coachId ? parseInt(coachId) : null,
    Height: heightCm ?? null,
    Bmr: bmr ?? null,
  };
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
 * Body Age is excluded — it is card-only per spec.
 *
 * @param {object} card - row from body_parameters_cards
 * @returns {{ height: number|null, bmr: number|null }}
 */
export function buildProfilePatch(card) {
  return {
    height: card.height_cm  ?? null,
    bmr:    card.bmr        ?? null,
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
  return {
    UserId:    userId,
    Weight:    weight,
    Bmi:       card.bmi       ?? null,
    BodyFat:   card.fat_percent ?? null,
    Bmr:       card.bmr       ?? null,
    // MuscleMass not on the card — omit
  };
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
 * @param {{ userId: number, userName: string, heightCm: number|null, bmr: number|null }} member
 * @returns {{ name: string, heightCm: string, bmr: string }}
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
  return patch;
}
