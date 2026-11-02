/**
 * Ideal-weight milestone rules — first time a member's weight enters BMI 19–23.
 * Pure domain (no I/O). Owner: weight + reports (Ideal Weight Report).
 */
import { computeIdealWeightRange } from '../../../utils/weightValidation.js';

/** Max CoachId upline levels emailed on first ideal-weight reach (coach + co-coach each). */
export const IDEAL_REACH_NOTIFY_MAX_LEVELS = 3;

/**
 * @param {unknown} value
 * @returns {string|null}
 */
function toUserIdString(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  if (Number.isFinite(n) && n > 0) return String(n);
  const s = String(value).trim();
  return s || null;
}

/**
 * Build unique notify targets: coach + co-coach for each of up to N CoachId ancestors.
 * Ancestors are nearest-first (level 1 = direct sponsor). Co-coach is the partner
 * from coach_teams (Sponsor ↔ Co-Sponsor), not a recursive parent edge.
 *
 * @param {{
 *   ancestorCoachIds?: Array<number|string|null|undefined>,
 *   partnerByCoachId?: Map<string|number, number|string|null|undefined>|Record<string, number|string|null|undefined>|null,
 *   memberUserId?: number|string|null,
 *   maxLevels?: number,
 * }} input
 * @returns {Array<{ userId: string, role: 'coach'|'cocoach', level: number }>}
 */
export function collectIdealReachNotifyTargets({
  ancestorCoachIds = [],
  partnerByCoachId = null,
  memberUserId = null,
  maxLevels = IDEAL_REACH_NOTIFY_MAX_LEVELS,
} = {}) {
  const memberId = toUserIdString(memberUserId);
  const limit = Number.isFinite(Number(maxLevels)) && Number(maxLevels) > 0
    ? Math.floor(Number(maxLevels))
    : IDEAL_REACH_NOTIFY_MAX_LEVELS;

  /** @type {Map<string, string>} */
  const partners = new Map();
  if (partnerByCoachId instanceof Map) {
    for (const [k, v] of partnerByCoachId.entries()) {
      const key = toUserIdString(k);
      const partner = toUserIdString(v);
      if (key && partner) partners.set(key, partner);
    }
  } else if (partnerByCoachId && typeof partnerByCoachId === 'object') {
    for (const [k, v] of Object.entries(partnerByCoachId)) {
      const key = toUserIdString(k);
      const partner = toUserIdString(v);
      if (key && partner) partners.set(key, partner);
    }
  }

  const seen = new Set();
  const out = [];
  const chain = (Array.isArray(ancestorCoachIds) ? ancestorCoachIds : []).slice(0, limit);

  for (let i = 0; i < chain.length; i += 1) {
    const level = i + 1;
    const coachId = toUserIdString(chain[i]);
    if (!coachId || coachId === memberId) continue;

    if (!seen.has(coachId)) {
      seen.add(coachId);
      out.push({ userId: coachId, role: 'coach', level });
    }

    const partnerId = partners.get(coachId) || null;
    if (!partnerId || partnerId === memberId || partnerId === coachId) continue;
    if (seen.has(partnerId)) continue;
    seen.add(partnerId);
    out.push({ userId: partnerId, role: 'cocoach', level });
  }

  return out;
}

/**
 * @param {number|string|null|undefined} weightKg
 * @param {number|string|null|undefined} heightCm
 * @returns {boolean}
 */
export function isWeightInIdealRange(weightKg, heightCm) {
  const range = computeIdealWeightRange(heightCm);
  const w = parseFloat(weightKg);
  if (!range || !Number.isFinite(w) || w <= 0) return false;
  return w >= range.idealMin && w <= range.idealMax;
}

/**
 * Earliest non-deleted weight row that falls inside the ideal band for heightCm.
 *
 * @param {Array<{ ID?: number|string, id?: number|string, Weight: number|string, CreatedAt: string|Date }>} rowsAsc
 *   Weight history ordered CreatedAt ASC (oldest first). Soft-deleted rows must be excluded by caller.
 * @param {number|string|null|undefined} heightCm
 * @returns {{ id: number|string|null, createdAt: string|Date, weight: number }|null}
 */
export function findFirstIdealReachedEntry(rowsAsc, heightCm) {
  const range = computeIdealWeightRange(heightCm);
  if (!range) return null;
  const list = Array.isArray(rowsAsc) ? rowsAsc : [];
  for (const row of list) {
    const w = parseFloat(row?.Weight);
    if (!Number.isFinite(w) || w <= 0) continue;
    if (w < range.idealMin || w > range.idealMax) continue;
    const id = row.ID ?? row.id ?? null;
    return { id, createdAt: row.CreatedAt, weight: w };
  }
  return null;
}

/**
 * Live save: only new inserts can trigger milestone detection.
 * Edits of old rows must not invent a "first reach".
 *
 * @param {{ isNewInsert: boolean, alreadyReachedAt?: string|Date|null }} params
 * @returns {boolean}
 */
export function shouldAttemptIdealMilestoneOnSave({ isNewInsert, alreadyReachedAt = null }) {
  if (!isNewInsert) return false;
  if (alreadyReachedAt != null && String(alreadyReachedAt).trim() !== '') return false;
  return true;
}

/**
 * Notify coach only when this save is the chronological first in-range entry.
 *
 * @param {{
 *   firstEntryId: number|string|null|undefined,
 *   firstCreatedAt: string|Date|null|undefined,
 *   newEntryId: number|string|null|undefined,
 *   newEntryCreatedAt: string|Date|null|undefined,
 * }} params
 * @returns {boolean}
 */
export function isSaveTheFirstIdealReach({
  firstEntryId,
  firstCreatedAt,
  newEntryId,
  newEntryCreatedAt,
}) {
  if (firstEntryId != null && newEntryId != null) {
    return String(firstEntryId) === String(newEntryId);
  }
  if (firstCreatedAt == null || newEntryCreatedAt == null) return false;
  return String(firstCreatedAt) === String(newEntryCreatedAt);
}
