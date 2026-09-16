/**
 * Seed testimonial list/detail rows from profile transformation_photos (Left slot).
 * Mirrors frontend seedMineTestimonialFromLeftSlot for read-only upline cards.
 */
import {
  isStoredTransformationPhoto,
  mapTransformationPhotos,
} from '../../user/domain/transformationPhotos.rules.js';
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
 * @param {object|null|undefined} testimonial
 * @param {unknown} transformationPhotosRaw
 * @returns {object|null}
 */
export function seedTestimonialFromProfilePhotos(testimonial, transformationPhotosRaw) {
  const slots = mapTransformationPhotos(transformationPhotosRaw);
  const leftUrl = slots.left;
  if (!isStoredTransformationPhoto(leftUrl)) {
    return testimonial ?? null;
  }

  const left = String(leftUrl).trim();

  const next = testimonial ? { ...testimonial } : {
    id: null,
    user_id: null,
    status: 'incomplete',
    recovered_health_issues: [],
    before_image_path: null,
    after_image_path: null,
    health_video_path: null,
    business_video_path: null,
    video_status: 'none',
  };

  const incomplete = !next.status || next.status === 'incomplete';
  const originalBefore = next.before_image_path;
  const originalAfter = next.after_image_path;
  const realAfter = !incomplete
    && (isRealImagePath(originalAfter) || isInlineImageReference(originalAfter))
    && originalAfter !== originalBefore;

  // Profile Left always drives Before for read models (matches Option A persist).
  next.before_image_path = left;

  if (!realAfter) {
    next.after_image_path = left;
  }

  return next;
}

/**
 * True when a member has a visible photo from testimonial row or profile left slot.
 * @param {object|null|undefined} testimonial
 * @param {unknown} transformationPhotosRaw
 */
export function memberHasVisibleTransformationPhoto(testimonial, transformationPhotosRaw) {
  if (testimonial) {
    if (isVideoOnlyPlaceholder(testimonial.before_image_path)) return false;
    if (isRealImagePath(testimonial.before_image_path)) return true;
    if (isInlineImageReference(testimonial.before_image_path)) return true;
  }
  const slots = mapTransformationPhotos(transformationPhotosRaw);
  return isStoredTransformationPhoto(slots.left);
}

function isVideoOnlyPlaceholder(path) {
  return typeof path === 'string' && path.endsWith('_video_only_placeholder.jpg');
}
