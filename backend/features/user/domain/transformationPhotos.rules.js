/**
 * Optional profile transformation photos (front / left / right).
 * None of the slots is required. Omitted slots are left unchanged on save.
 * Historical rows store the Profile Weight snapshot at upload time and are
 * never rewritten when Profile Weight later changes.
 */
import { createHash } from 'node:crypto';

export const TRANSFORMATION_PHOTO_SLOTS = ['front', 'left', 'right'];

const DATA_IMAGE_RE = /^data:image\/[a-zA-Z0-9+.-]+;base64,/;
const HTTPS_RE = /^https:\/\//i;

export function isStoredTransformationPhoto(value) {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  return DATA_IMAGE_RE.test(trimmed) || HTTPS_RE.test(trimmed);
}

export function emptyTransformationPhotos() {
  return { front: null, left: null, right: null };
}

/**
 * Normalize a stored JSON/object into { front, left, right } (null when empty).
 * @param {unknown} raw
 */
export function mapTransformationPhotos(raw) {
  const out = emptyTransformationPhotos();
  if (raw == null || raw === '') return out;
  let obj = raw;
  if (typeof raw === 'string') {
    try {
      obj = JSON.parse(raw);
    } catch {
      return out;
    }
  }
  if (typeof obj !== 'object' || Array.isArray(obj)) return out;
  TRANSFORMATION_PHOTO_SLOTS.forEach((slot) => {
    const value = obj[slot];
    out[slot] = isStoredTransformationPhoto(value) ? value.trim() : null;
  });
  return out;
}

/**
 * Merge newly provided slots onto existing stored photos.
 * Undefined slots on `incoming` leave the existing value.
 * @param {unknown} existingRaw
 * @param {object|null|undefined} incoming
 */
export function mergeTransformationPhotos(existingRaw, incoming) {
  const existing = mapTransformationPhotos(existingRaw);
  if (incoming == null || typeof incoming !== 'object' || Array.isArray(incoming)) {
    return existing;
  }
  const next = { ...existing };
  TRANSFORMATION_PHOTO_SLOTS.forEach((slot) => {
    if (!(slot in incoming)) return;
    const value = incoming[slot];
    if (value == null || value === '') {
      return;
    }
    if (isStoredTransformationPhoto(value)) {
      next[slot] = value.trim();
    }
  });
  return next;
}

/**
 * True when the payload includes at least one new/updated slot.
 * Empty `{}` or missing object means "do not update".
 * @param {unknown} incoming
 */
export function hasTransformationPhotoUpdates(incoming) {
  if (incoming == null || typeof incoming !== 'object' || Array.isArray(incoming)) {
    return false;
  }
  return TRANSFORMATION_PHOTO_SLOTS.some((slot) => {
    if (!(slot in incoming)) return false;
    return isStoredTransformationPhoto(incoming[slot]);
  });
}

/**
 * Stable hash of the stored image payload. Same bytes + same slot → same
 * record (retries). A new photo (different bytes) creates a new row.
 * @param {string} imageUrl
 */
export function hashTransformationPhoto(imageUrl) {
  const trimmed = String(imageUrl || '').trim();
  return createHash('sha256').update(trimmed).digest('hex');
}

/**
 * Incoming slots → insert candidates. Types are never mixed.
 * @param {object|null|undefined} incoming
 * @param {number|null} weightKg snapshot at upload (not live Profile Weight)
 */
export function buildTransformationPhotoInserts(incoming, weightKg) {
  if (!hasTransformationPhotoUpdates(incoming)) return [];
  const weight = Number.isFinite(weightKg) ? weightKg : null;
  return TRANSFORMATION_PHOTO_SLOTS.filter((slot) => isStoredTransformationPhoto(incoming[slot]))
    .map((slot) => {
      const imageUrl = String(incoming[slot]).trim();
      return {
        imageType: slot,
        imageUrl,
        weightKg: weight,
        contentHash: hashTransformationPhoto(imageUrl),
      };
    });
}

/**
 * Latest URL per slot from historical rows (newest first).
 * @param {Array<{ image_type?: string, imageType?: string, image_url?: string, imageUrl?: string }>} rows
 */
export function mapLatestTransformationPhotosFromRecords(rows) {
  const out = emptyTransformationPhotos();
  if (!Array.isArray(rows) || rows.length === 0) return out;
  for (const row of rows) {
    const slot = row?.image_type || row?.imageType;
    if (!TRANSFORMATION_PHOTO_SLOTS.includes(slot)) continue;
    if (out[slot] != null) continue;
    const url = row?.image_url || row?.imageUrl;
    if (isStoredTransformationPhoto(url)) out[slot] = String(url).trim();
  }
  return out;
}

/**
 * Public history shape. Weight is the captured snapshot, never live profile weight.
 * @param {object} row
 */
export function mapTransformationPhotoRecord(row) {
  if (!row) return null;
  const imageType = row.image_type || row.imageType;
  const imageUrl = row.image_url || row.imageUrl;
  const weightRaw = row.weight_kg != null ? row.weight_kg : row.weightKg;
  const weight = weightRaw != null && weightRaw !== '' ? parseFloat(weightRaw) : null;
  return {
    id: row.id,
    imageType,
    imageUrl: isStoredTransformationPhoto(imageUrl) ? String(imageUrl).trim() : null,
    weight: Number.isFinite(weight) ? weight : null,
    createdAt: row.created_at || row.createdAt || null,
  };
}

/** Before vs After tab default. Never inferred from which photos exist. */
export const DEFAULT_TRANSFORMATION_COMPARE_TYPE = 'left';

function createdAtMs(row) {
  const raw = row?.createdAt || row?.created_at;
  const ms = raw ? Date.parse(raw) : NaN;
  return Number.isFinite(ms) ? ms : 0;
}

/**
 * Same-type history only, oldest first. Front/left/right are never mixed.
 * @param {Array<object>} rows
 * @param {string} imageType
 */
export function filterTransformationHistoryByType(rows, imageType) {
  if (!TRANSFORMATION_PHOTO_SLOTS.includes(imageType)) return [];
  return (Array.isArray(rows) ? rows : [])
    .filter((row) => {
      const type = row?.imageType || row?.image_type;
      const url = row?.imageUrl || row?.image_url;
      return type === imageType && isStoredTransformationPhoto(url);
    })
    .slice()
    .sort((a, b) => {
      const byTime = createdAtMs(a) - createdAtMs(b);
      if (byTime !== 0) return byTime;
      return Number(a?.id || 0) - Number(b?.id || 0);
    });
}

/**
 * Before = earliest same-type record. After = latest later same-type record.
 * Weights stay on those records. Missing type → empty pair (do not switch type).
 * @param {Array<object>} rows
 * @param {string} imageType
 */
export function selectTransformationBeforeAfter(rows, imageType) {
  const list = filterTransformationHistoryByType(rows, imageType)
    .map((row) => (row.imageUrl != null ? row : mapTransformationPhotoRecord(row)))
    .filter((row) => row && isStoredTransformationPhoto(row.imageUrl));
  if (list.length === 0) return { before: null, after: null };
  return {
    before: list[0],
    after: list.length > 1 ? list[list.length - 1] : null,
  };
}
