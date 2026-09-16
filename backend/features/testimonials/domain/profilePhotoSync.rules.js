/**
 * Rules for Profile / BCM Left·Right → testimonial Before·After sync.
 * After is never overwritten when the row already has a real approved/pending After.
 */

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
