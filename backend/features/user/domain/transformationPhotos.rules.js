/**
 * Optional profile transformation photos (front / left / right).
 * Stored on existing team_table.transformation_photos JSONB — no new table.
 */
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

export function mergeTransformationPhotos(existingRaw, incoming) {
  const existing = mapTransformationPhotos(existingRaw);
  if (incoming == null || typeof incoming !== 'object' || Array.isArray(incoming)) {
    return existing;
  }
  const next = { ...existing };
  TRANSFORMATION_PHOTO_SLOTS.forEach((slot) => {
    if (!(slot in incoming)) return;
    const value = incoming[slot];
    if (value == null || value === '') return;
    if (isStoredTransformationPhoto(value)) next[slot] = value.trim();
  });
  return next;
}

export function hasTransformationPhotoUpdates(incoming) {
  if (incoming == null || typeof incoming !== 'object' || Array.isArray(incoming)) {
    return false;
  }
  return TRANSFORMATION_PHOTO_SLOTS.some((slot) => (
    slot in incoming && isStoredTransformationPhoto(incoming[slot])
  ));
}
