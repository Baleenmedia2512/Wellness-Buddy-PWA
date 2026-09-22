/**
 * Bidirectional Profile ↔ Transformation photo sync rules.
 * Profile Left → Transformation Before. Centre never maps either way.
 * Profile Right never drives Transformation After (new users get Left in both frames).
 * Transformation After → Profile Right still applies on explicit After upload.
 */

const DATA_IMAGE_RE = /^data:image\/[a-zA-Z0-9+.-]+;base64,/i;

/**
 * @param {object|null|undefined} row - testimonials_table row (snake_case)
 * @param {(path: string) => boolean} [isPlaceholder]
 * @returns {boolean}
 */
export function testimonialHasRealAfter(row, isPlaceholder = () => false) {
  if (!row) return false;
  const incomplete = !row.status || row.status === 'incomplete';
  if (incomplete) return false;
  const before = row.before_image_path;
  const after = row.after_image_path;
  if (!before || !after) return false;
  if (isPlaceholder(after)) return false;
  return after !== before;
}

/**
 * Profile Right never writes Transformation After. Distinct After comes from
 * the Transformation tab (and reverse-syncs to Profile Right).
 * @param {object|null|undefined} row
 * @param {(path: string) => boolean} [isPlaceholder]
 * @returns {boolean}
 */
export function canSyncProfileAfterToTestimonial(_row, _isPlaceholder = () => false) {
  return false;
}

const PROFILE_MAPPED_AFTER_RE = /(?:^|\/)after_\d+\.jpg(?:\?|$)/i;

/**
 * Incomplete rows used to persist Profile Right as a distinct after_*.jpg file.
 * That is not a user-chosen Transformation After — treat it as auto-fill.
 * @param {object|null|undefined} row
 * @param {unknown} [afterValue]
 * @returns {boolean}
 */
export function isIncompleteProfileMappedAfter(row, afterValue) {
  const incomplete = !row?.status || row.status === 'incomplete';
  if (!incomplete) return false;
  const after = afterValue ?? row?.after_image_path ?? row?.afterImageUrl;
  if (typeof after !== 'string' || !after.trim()) return false;
  return PROFILE_MAPPED_AFTER_RE.test(after.trim());
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function hasPositiveWeight(value) {
  const n = value != null ? parseFloat(value) : NaN;
  return Number.isFinite(n) && n > 0;
}

/**
 * Normalize uploaded image bytes into a profile-safe data URL.
 * @param {unknown} value
 * @returns {string|null}
 */
export function toProfileImageDataUrl(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (DATA_IMAGE_RE.test(trimmed)) return trimmed;
  // Raw base64 from some clients — store as JPEG data URL for Profile JSONB.
  if (/^[A-Za-z0-9+/=\s]+$/.test(trimmed) && trimmed.replace(/\s/g, '').length > 32) {
    return `data:image/jpeg;base64,${trimmed.replace(/\s/g, '')}`;
  }
  return null;
}

/**
 * Map Transformation Before/After uploads onto Profile Left/Right slots.
 * @param {{ beforeImageBase64?: string|null, afterImageBase64?: string|null }} input
 * @returns {{ left?: string, right?: string }}
 */
export function buildProfileSlotsFromTestimonialImages({
  beforeImageBase64,
  afterImageBase64,
} = {}) {
  const slots = {};
  const left = toProfileImageDataUrl(beforeImageBase64);
  const right = toProfileImageDataUrl(afterImageBase64);
  if (left) slots.left = left;
  if (right) slots.right = right;
  return slots;
}
