/**
 * Optional profile transformation photos (front / left / right).
 * Stored on existing team_table.transformation_photos JSONB — no new table.
 *
 * Dual storage (ADR-style, live-safe):
 *   - front|left|right — display value; live rows keep data:image base64
 *   - frontKey|leftKey|rightKey — R2 object keys (never delete base64 while old apps supported)
 *
 * API response shaping is version-routed (see shouldPreferTransformationR2Urls).
 */
import { isAtLeastVersion } from '../../app-version/domain/version.rules.js';

export const TRANSFORMATION_PHOTO_SLOTS = ['front', 'left', 'right'];

/** New clients (≥ this) receive R2 https URLs; older / missing → legacy base64 slots. */
export const TRANSFORMATION_PHOTOS_R2_MIN_APP_VERSION = '3.5.1';

export const TRANSFORMATION_PHOTO_KEY_FIELDS = Object.freeze({
  front: 'frontKey',
  left: 'leftKey',
  right: 'rightKey',
});

const DATA_IMAGE_RE = /^data:image\/[a-zA-Z0-9+.-]+;base64,/;
const HTTPS_RE = /^https:\/\//i;

export function isStoredTransformationPhoto(value) {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  return DATA_IMAGE_RE.test(trimmed) || HTTPS_RE.test(trimmed);
}

export function isDataTransformationPhoto(value) {
  return typeof value === 'string' && DATA_IMAGE_RE.test(value.trim());
}

export function emptyTransformationPhotos() {
  return { front: null, left: null, right: null };
}

export function emptyTransformationPhotosRecord() {
  return {
    front: null,
    left: null,
    right: null,
    frontKey: null,
    leftKey: null,
    rightKey: null,
  };
}

function parseRawObject(raw) {
  if (raw == null || raw === '') return null;
  let obj = raw;
  if (typeof raw === 'string') {
    try {
      obj = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (typeof obj !== 'object' || Array.isArray(obj)) return null;
  return obj;
}

function isValidTransformKey(value) {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  return trimmed.length > 0 && !trimmed.includes('..') && trimmed.startsWith('transformation/');
}

/**
 * Full JSONB record including R2 keys (persistence / backfill).
 * @param {unknown} raw
 */
export function mapTransformationPhotosRecord(raw) {
  const out = emptyTransformationPhotosRecord();
  const obj = parseRawObject(raw);
  if (!obj) return out;
  TRANSFORMATION_PHOTO_SLOTS.forEach((slot) => {
    const value = obj[slot];
    out[slot] = isStoredTransformationPhoto(value) ? value.trim() : null;
    const keyField = TRANSFORMATION_PHOTO_KEY_FIELDS[slot];
    const keyVal = obj[keyField];
    out[keyField] = isValidTransformKey(keyVal) ? keyVal.trim() : null;
  });
  return out;
}

/**
 * Slot images only (legacy callers / seed). Does not expose keys.
 * @param {unknown} raw
 */
export function mapTransformationPhotos(raw) {
  const rec = mapTransformationPhotosRecord(raw);
  return { front: rec.front, left: rec.left, right: rec.right };
}

/**
 * Whether this request should get R2 URLs in transformationPhotos (not base64).
 * Missing / unknown version → legacy while old apps remain supported.
 *
 * @param {{ appVersion?: string|null, minAppVersion?: string }} [args]
 * @returns {boolean}
 */
export function shouldPreferTransformationR2Urls({
  appVersion = null,
  minAppVersion = TRANSFORMATION_PHOTOS_R2_MIN_APP_VERSION,
} = {}) {
  return isAtLeastVersion(appVersion, minAppVersion) === true;
}

/**
 * Shape transformation_photos for a profile API client.
 * preferR2: return https from keys (fallback to stored slot if key missing).
 * legacy: return stored front/left/right (base64 preserved for live).
 *
 * @param {unknown} raw
 * @param {{ preferR2?: boolean, resolveR2Url?: (key: string) => string|null }} [opts]
 */
export function mapTransformationPhotosForClient(raw, {
  preferR2 = false,
  resolveR2Url = null,
} = {}) {
  const rec = mapTransformationPhotosRecord(raw);
  const out = emptyTransformationPhotos();
  TRANSFORMATION_PHOTO_SLOTS.forEach((slot) => {
    const keyField = TRANSFORMATION_PHOTO_KEY_FIELDS[slot];
    const key = rec[keyField];
    if (preferR2 && key && typeof resolveR2Url === 'function') {
      const url = resolveR2Url(key);
      if (url) {
        out[slot] = url;
        return;
      }
    }
    out[slot] = rec[slot];
  });
  return out;
}

/**
 * Merge incoming slot images onto existing record.
 * Preserves R2 keys unless that slot's image value changes.
 * Never strips base64 from untouched slots.
 *
 * @param {unknown} existingRaw
 * @param {unknown} incoming
 * @returns {ReturnType<typeof emptyTransformationPhotosRecord>}
 */
export function mergeTransformationPhotos(existingRaw, incoming) {
  const existing = mapTransformationPhotosRecord(existingRaw);
  if (incoming == null || typeof incoming !== 'object' || Array.isArray(incoming)) {
    return existing;
  }
  const next = { ...existing };
  TRANSFORMATION_PHOTO_SLOTS.forEach((slot) => {
    if (!(slot in incoming)) return;
    const value = incoming[slot];
    if (value == null || value === '') return;
    if (!isStoredTransformationPhoto(value)) return;
    const trimmed = value.trim();
    const keyField = TRANSFORMATION_PHOTO_KEY_FIELDS[slot];
    if (next[slot] !== trimmed) {
      next[slot] = trimmed;
      // New bytes → clear key until persistTransformationPhotoKeys re-uploads.
      next[keyField] = null;
    }
  });
  return next;
}

/**
 * After R2 upload: keep prior front/left/right values as orphans (including old
 * base64). Persist only new *Key fields — never write freshly uploaded data:image.
 *
 * @param {unknown} existingRaw — DB value before this save
 * @param {unknown} withKeysRecord — merge + upload result (may still hold data URIs)
 */
export function finalizeTransformationPhotosOrphanSlots(existingRaw, withKeysRecord) {
  const existing = mapTransformationPhotosRecord(existingRaw);
  const withKeys = mapTransformationPhotosRecord(withKeysRecord);
  const out = emptyTransformationPhotosRecord();
  TRANSFORMATION_PHOTO_SLOTS.forEach((slot) => {
    const keyField = TRANSFORMATION_PHOTO_KEY_FIELDS[slot];
    out[keyField] = withKeys[keyField];
    // Orphan: leave historical slot value; do not store the upload payload.
    out[slot] = existing[slot];
  });
  return out;
}

export function hasTransformationPhotoUpdates(incoming) {
  if (incoming == null || typeof incoming !== 'object' || Array.isArray(incoming)) {
    return false;
  }
  return TRANSFORMATION_PHOTO_SLOTS.some((slot) => (
    slot in incoming && isStoredTransformationPhoto(incoming[slot])
  ));
}

/**
 * Slots that still need an R2 upload (data URI present, key missing).
 * @param {unknown} raw
 * @returns {Array<'front'|'left'|'right'>}
 */
export function slotsNeedingTransformationR2Upload(raw) {
  const rec = mapTransformationPhotosRecord(raw);
  return TRANSFORMATION_PHOTO_SLOTS.filter((slot) => {
    const keyField = TRANSFORMATION_PHOTO_KEY_FIELDS[slot];
    return isDataTransformationPhoto(rec[slot]) && !rec[keyField];
  });
}
