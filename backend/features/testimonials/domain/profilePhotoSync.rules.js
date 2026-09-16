/**
 * Bidirectional Profile ↔ Transformation photo sync rules.
 * Left ↔ Before, Right ↔ After. Centre never maps either way.
 * Profile After sync never overwrites a real approved/pending After.
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
 * @param {object|null|undefined} row
 * @param {(path: string) => boolean} [isPlaceholder]
 * @returns {boolean}
 */
export function canSyncProfileAfterToTestimonial(row, isPlaceholder = () => false) {
  if (!row) return true;
  return !testimonialHasRealAfter(row, isPlaceholder);
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
