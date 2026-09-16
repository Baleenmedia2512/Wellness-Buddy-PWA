/**
 * Seed testimonial list/detail rows from profile transformation_photos (Left/Right slots).
 * Mirrors frontend seedMineTestimonialFromProfileSlots for read-only upline cards.
 */
import {
  isStoredTransformationPhoto,
  mapTransformationPhotos,
} from '../../user/domain/transformationPhotos.rules.js';
import { isRealImagePath } from './testimonials-list.pagination.js';
import { testimonialHasRealAfter } from './profilePhotoSync.rules.js';

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

function isStoredPath(value) {
  return isRealImagePath(value) || isInlineImageReference(value);
}

/**
 * @param {object|null|undefined} testimonial
 * @param {unknown} transformationPhotosRaw
 * @returns {object|null}
 */
export function seedTestimonialFromProfilePhotos(testimonial, transformationPhotosRaw) {
  const slots = mapTransformationPhotos(transformationPhotosRaw);
  const leftUrl = slots.left;
  const rightUrl = slots.right;
  const hasLeft = isStoredTransformationPhoto(leftUrl);
  const hasRight = isStoredTransformationPhoto(rightUrl);
  if (!hasLeft && !hasRight) {
    return testimonial ?? null;
  }

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

  const realAfter = testimonialHasRealAfter(next, (path) => (
    typeof path === 'string' && path.endsWith('_video_only_placeholder.jpg')
  ));

  if (hasLeft) {
    next.before_image_path = String(leftUrl).trim();
  }

  if (hasRight) {
    next.after_image_path = String(rightUrl).trim();
  } else if (!realAfter) {
    if (hasLeft) {
      next.after_image_path = String(leftUrl).trim();
    } else if (!isStoredPath(next.after_image_path) && isStoredPath(next.before_image_path)) {
      next.after_image_path = next.before_image_path;
    }
  }

  return next;
}

/**
 * True when a member has a visible photo from testimonial row or profile left/right slot.
 * @param {object|null|undefined} testimonial
 * @param {unknown} transformationPhotosRaw
 */
export function memberHasVisibleTransformationPhoto(testimonial, transformationPhotosRaw) {
  if (testimonial) {
    if (isVideoOnlyPlaceholder(testimonial.before_image_path)) return false;
    if (isRealImagePath(testimonial.before_image_path)) return true;
    if (isInlineImageReference(testimonial.before_image_path)) return true;
    if (isRealImagePath(testimonial.after_image_path)) return true;
    if (isInlineImageReference(testimonial.after_image_path)) return true;
  }
  const slots = mapTransformationPhotos(transformationPhotosRaw);
  return isStoredTransformationPhoto(slots.left) || isStoredTransformationPhoto(slots.right);
}

function isVideoOnlyPlaceholder(path) {
  return typeof path === 'string' && path.endsWith('_video_only_placeholder.jpg');
}
