/**
 * Nutrition centre code and photo slots.
 *
 * Legacy: app version below 3.5.7, and requests with no version, may register
 * and update a centre without a code or photos. When those fields are sent,
 * they are still checked.
 * New: app version >= 3.5.7 must send a centre code and one photo in each slot.
 * Removal: after APP_VERSION_MIN_REQUIRED >= 3.5.7 and no supported client
 * still registers a centre without these fields.
 */
import { isAtLeastVersion } from '../../app-version/domain/version.rules.js';

export const CENTRE_CODE_PREFIX = 'RS';
export const CENTRE_PROFILE_MIN_APP_VERSION = '3.5.7';
export const CENTRE_PHOTOS_MAX_PER_SLOT = 4;
export const CENTRE_PHOTO_DATA_URL_MAX_CHARS = 180000;

export const CENTRE_PHOTO_SLOTS = Object.freeze([
  { key: 'entrance', label: 'Centre entrance photos' },
  { key: 'interior', label: 'Centre interior photos' },
  { key: 'name_board', label: 'Centre name board photos' },
  { key: 'wellness_activity', label: 'Wellness activity photos' },
]);

const SLOT_KEYS = CENTRE_PHOTO_SLOTS.map((slot) => slot.key);
const JPEG_PREFIX = 'data:image/jpeg;base64,';
const CENTRE_PHOTO_FOLDER = 'nutrition-centres';

/**
 * Apps below 3.5.7, missing versions, and unparseable versions stay on the
 * legacy register/update path while those apps are still supported.
 * @param {unknown} appVersion
 * @returns {boolean}
 */
export function requiresCentreProfile(appVersion) {
  if (appVersion == null || String(appVersion).trim() === '') return false;
  const meets = isAtLeastVersion(appVersion, CENTRE_PROFILE_MIN_APP_VERSION);
  return meets === true;
}

/**
 * @param {unknown} raw
 * @returns {string} empty when blank, otherwise RS + body
 */
export function normalizeCentreCode(raw) {
  const compact = String(raw ?? '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!compact) return '';
  const body = compact.startsWith(CENTRE_CODE_PREFIX) ? compact.slice(CENTRE_CODE_PREFIX.length) : compact;
  return `${CENTRE_CODE_PREFIX}${body}`;
}

/**
 * @param {unknown} code normalized or raw
 * @returns {string|null}
 */
export function centreCodeError(code) {
  const normalized = normalizeCentreCode(code);
  if (!normalized) return 'Centre code is required';
  const body = normalized.slice(CENTRE_CODE_PREFIX.length);
  if (!/^RS[A-Z0-9]{1,16}$/.test(normalized) || body.length < 1) {
    return 'Centre code must start with RS and use 1 to 16 letters or digits after RS';
  }
  return null;
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isCentreJpegDataUrl(value) {
  if (typeof value !== 'string') return false;
  if (!value.startsWith(JPEG_PREFIX)) return false;
  if (value.length > CENTRE_PHOTO_DATA_URL_MAX_CHARS || value.length < JPEG_PREFIX.length + 8) return false;
  const b64 = value.slice(JPEG_PREFIX.length);
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) return false;
  return b64.startsWith('/9j/');
}

/**
 * File key already stored for this slot. Accepts the key or a URL that contains it.
 * @param {unknown} value
 * @param {string} slot
 * @returns {string|null}
 */
export function keptCentrePhotoKey(value, slot) {
  if (typeof value !== 'string' || !SLOT_KEYS.includes(slot)) return null;
  const trimmed = value.trim();
  const marker = `${CENTRE_PHOTO_FOLDER}/`;
  const at = trimmed.indexOf(marker);
  if (at < 0) return null;
  let key = trimmed.slice(at).split('?')[0];
  try {
    key = key.split('/').map((part) => decodeURIComponent(part)).join('/');
  } catch {
    return null;
  }
  const pattern = new RegExp(`^${CENTRE_PHOTO_FOLDER}/\\d+/${slot}/[a-f0-9]{8,64}\\.jpg$`);
  return pattern.test(key) ? key : null;
}

/**
 * A new JPEG is uploaded. A URL or key already on disk is kept.
 * @param {unknown} value
 * @param {string} slot
 * @returns {{ type: 'upload', dataUrl: string } | { type: 'keep', key: string } | null}
 */
export function classifyCentrePhoto(value, slot) {
  const raw = typeof value === 'string' ? value : value?.dataUrl || value?.imageData;
  if (isCentreJpegDataUrl(raw)) return { type: 'upload', dataUrl: raw };
  const key = keptCentrePhotoKey(raw, slot);
  if (key) return { type: 'keep', key };
  return null;
}

/**
 * @param {unknown} photos
 * @returns {{ photos?: Record<string, Array<{ type: string, dataUrl?: string, key?: string }>>, error?: string }}
 */
export function normalizeCentrePhotos(photos) {
  if (photos == null || typeof photos !== 'object' || Array.isArray(photos)) {
    return { error: 'Centre photos are required' };
  }
  /** @type {Record<string, Array<{ type: string, dataUrl?: string, key?: string }>>} */
  const out = {};
  for (const slot of CENTRE_PHOTO_SLOTS) {
    const list = photos[slot.key];
    if (!Array.isArray(list) || list.length < 1) {
      return { error: `Add at least one photo for ${slot.label}` };
    }
    if (list.length > CENTRE_PHOTOS_MAX_PER_SLOT) {
      return { error: `${slot.label} can include up to ${CENTRE_PHOTOS_MAX_PER_SLOT} photos` };
    }
    const images = [];
    for (const item of list) {
      const classified = classifyCentrePhoto(item, slot.key);
      if (!classified) return { error: `${slot.label} must be JPEG photos` };
      images.push(classified);
    }
    out[slot.key] = images;
  }
  return { photos: out };
}

/**
 * @param {{
 *   centerCode?: unknown,
 *   photos?: unknown,
 *   appVersion?: unknown,
 *   mode: 'register' | 'update',
 * }} input
 */
export function prepareCentreProfile(input) {
  const enforce = requiresCentreProfile(input?.appVersion);
  const rawCode = input?.centerCode;
  const codeBlank = rawCode == null || String(rawCode).trim() === '';
  let centerCode;
  if (codeBlank) {
    if (enforce) return { error: 'Centre code is required' };
    centerCode = input?.mode === 'register' ? null : undefined;
  } else {
    centerCode = normalizeCentreCode(rawCode);
    const codeError = centreCodeError(centerCode);
    if (codeError) return { error: codeError };
  }

  const photosOmitted = input?.photos == null;
  if (photosOmitted) {
    if (enforce) return { error: `Add at least one photo for ${CENTRE_PHOTO_SLOTS[0].label}` };
    return { centerCode, photos: undefined };
  }
  const normalized = normalizeCentrePhotos(input.photos);
  if (normalized.error) return { error: normalized.error };
  return { centerCode, photos: normalized.photos };
}

/**
 * @param {number} centerId
 * @param {Record<string, string[]>} keysBySlot stored file keys, not image bytes
 */
export function centrePhotoRows(centerId, keysBySlot) {
  const rows = [];
  for (const key of SLOT_KEYS) {
    (keysBySlot[key] || []).forEach((imageKey, sortOrder) => {
      rows.push({
        center_id: centerId,
        category: key,
        image_key: imageKey,
        sort_order: sortOrder,
      });
    });
  }
  return rows;
}

/**
 * @param {Array<{ category?: string, image_key?: string }>} rows
 * @returns {Record<string, string[]>}
 */
export function groupCentrePhotos(rows) {
  /** @type {Record<string, string[]>} */
  const photos = {};
  for (const key of SLOT_KEYS) photos[key] = [];
  for (const row of rows || []) {
    if (!photos[row.category]) continue;
    if (row.image_key) photos[row.category].push(row.image_key);
  }
  return photos;
}
