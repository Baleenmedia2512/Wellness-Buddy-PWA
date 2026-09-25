/**
 * Seed testimonial list/detail from profile Left — **new users only**.
 * If the row already has a real Before path, Profile Left/Right are ignored.
 * New / empty: Left → Before; After defaults to Left. Profile Right is ignored.
 */
import {
  isStoredTransformationPhoto,
  mapTransformationPhotos,
} from '../../user/domain/transformationPhotos.rules.js';
import { isRealImagePath } from './testimonials-list.pagination.js';
import { isIncompleteProfileMappedAfter, testimonialHasRealAfter } from './profilePhotoSync.rules.js';
import { hasRealBeforePhoto } from './photoCompleteness.rules.js';

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
  // Existing Transformation Before — do not overlay Profile Left.
  if (testimonial && hasRealBeforePhoto(testimonial)) {
    return testimonial;
  }

  const slots = mapTransformationPhotos(transformationPhotosRaw);
  const leftUrl = slots.left;
  const hasLeft = isStoredTransformationPhoto(leftUrl);
  if (!hasLeft) {
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
  const storedAfter = isStoredPath(testimonial?.after_image_path)
    && !isIncompleteProfileMappedAfter(next, testimonial?.after_image_path);

  next.before_image_path = String(leftUrl).trim();

  if (!realAfter && !storedAfter) {
    next.after_image_path = String(leftUrl).trim();
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
