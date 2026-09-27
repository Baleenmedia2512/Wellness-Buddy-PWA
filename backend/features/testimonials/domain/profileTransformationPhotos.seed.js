/**
 * Profile transformation_photos no longer seed Transformation Before/After.
 * Helpers stay for list visibility checks on real testimonial image paths.
 */
import { isRealImagePath } from './testimonials-list.pagination.js';

const DATA_IMAGE_RE = /^data:image\/[a-zA-Z0-9+.-]+;base64,/;
const HTTPS_RE = /^https:\/\//i;

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isInlineImageReference(value) {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  return DATA_IMAGE_RE.test(trimmed) || HTTPS_RE.test(trimmed);
}

/**
 * Passthrough — Profile Left/Right do not populate Before/After.
 * @param {object|null|undefined} testimonial
 * @returns {object|null}
 */
export function seedTestimonialFromProfilePhotos(testimonial) {
  return testimonial ?? null;
}

/**
 * True when a member has a visible photo on the Transformation testimonial row.
 * Profile Left/Centre/Right alone do not count.
 * @param {object|null|undefined} testimonial
 * @param {unknown} [_transformationPhotosRaw] unused — kept for call-site compatibility
 */
export function memberHasVisibleTransformationPhoto(testimonial, _transformationPhotosRaw) {
  if (!testimonial) return false;
  if (isVideoOnlyPlaceholder(testimonial.before_image_path)) return false;
  if (isRealImagePath(testimonial.before_image_path)) return true;
  if (isInlineImageReference(testimonial.before_image_path)) return true;
  if (isRealImagePath(testimonial.after_image_path)) return true;
  if (isInlineImageReference(testimonial.after_image_path)) return true;
  return false;
}

function isVideoOnlyPlaceholder(path) {
  return typeof path === 'string' && path.endsWith('_video_only_placeholder.jpg');
}
