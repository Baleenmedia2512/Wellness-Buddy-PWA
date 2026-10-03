/**
 * Ideal-weight milestone rules — first time a member's weight enters BMI 19–23.
 * Pure domain (no I/O). Owner: weight + reports (Ideal Weight Report).
 */
import { computeIdealWeightRange } from '../../../utils/weightValidation.js';

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
