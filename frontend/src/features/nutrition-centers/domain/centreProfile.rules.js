/**
 * Client-side centre code and photo-slot rules.
 * Keep the prefix, slot keys, and limits aligned with
 * backend/features/nutrition-centers/domain/centreProfile.rules.js.
 */

export const CENTRE_CODE_PREFIX = 'RS';
export const CENTRE_PHOTOS_MAX_PER_SLOT = 4;

export const CENTRE_PHOTO_SLOTS = Object.freeze([
  { key: 'entrance', label: 'Centre entrance photos' },
  { key: 'interior', label: 'Centre interior photos' },
  { key: 'name_board', label: 'Centre name board photos' },
  { key: 'wellness_activity', label: 'Wellness activity photos' },
]);

export function emptyCentrePhotos() {
  return {
    entrance: [],
    interior: [],
    name_board: [],
    wellness_activity: [],
  };
}

/**
 * Characters typed after the fixed RS prefix.
 * @param {unknown} raw
 * @returns {string}
 */
export function centreCodeBody(raw) {
  const compact = String(raw ?? '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!compact) return '';
  return compact.startsWith(CENTRE_CODE_PREFIX) ? compact.slice(CENTRE_CODE_PREFIX.length) : compact;
}

/**
 * @param {unknown} suffix
 * @returns {string|null}
 */
export function centreCodeError(suffix) {
  const body = centreCodeBody(suffix);
  if (!body) return 'Centre code is required';
  if (!/^[A-Z0-9]{1,16}$/.test(body)) {
    return 'Centre code must start with RS and use 1 to 16 letters or digits after RS';
  }
  return null;
}

/**
 * @param {string} suffix
 * @returns {string}
 */
export function centreCodeFromSuffix(suffix) {
  return `${CENTRE_CODE_PREFIX}${centreCodeBody(suffix)}`;
}

/**
 * @param {unknown} photos slot arrays of { dataUrl } or strings
 * @returns {string|null}
 */
export function centrePhotosError(photos) {
  for (const slot of CENTRE_PHOTO_SLOTS) {
    const list = photos?.[slot.key];
    const count = Array.isArray(list) ? list.length : 0;
    if (count < 1) return `Add at least one photo for ${slot.label}`;
    if (count > CENTRE_PHOTOS_MAX_PER_SLOT) {
      return `${slot.label} can include up to ${CENTRE_PHOTOS_MAX_PER_SLOT} photos`;
    }
  }
  return null;
}

/**
 * @param {unknown} photos
 * @returns {Record<string, string[]>}
 */
export function centrePhotosForApi(photos) {
  /** @type {Record<string, string[]>} */
  const out = {};
  for (const slot of CENTRE_PHOTO_SLOTS) {
    const list = Array.isArray(photos?.[slot.key]) ? photos[slot.key] : [];
    out[slot.key] = list.map((item) => (typeof item === 'string' ? item : item?.dataUrl)).filter(Boolean);
  }
  return out;
}

/**
 * @param {unknown} grouped
 */
export function centrePhotosFromApi(grouped) {
  const photos = emptyCentrePhotos();
  for (const slot of CENTRE_PHOTO_SLOTS) {
    const list = grouped?.[slot.key];
    if (!Array.isArray(list)) continue;
    photos[slot.key] = list.filter((dataUrl) => typeof dataUrl === 'string' && dataUrl).map((dataUrl, index) => ({
      id: `saved-${slot.key}-${index}`,
      dataUrl,
    }));
  }
  return photos;
}
