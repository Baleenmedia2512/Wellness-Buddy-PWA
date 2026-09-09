/**
 * Pending vs stored transformation photo merge helpers.
 * Existing users reload profile often; unsaved picks must not be wiped.
 */
import { POSE_SLOT_KEYS } from './transformationPoseGuide.js';

export function isDataImageUrl(value) {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  return trimmed.length > 0 && /^data:image\//i.test(trimmed);
}

/**
 * Prefer in-progress uploads over server slots when rebuilding previews.
 * @param {{ front?: string|null, left?: string|null, right?: string|null }|null|undefined} stored
 * @param {{ front?: string|null, left?: string|null, right?: string|null }|null|undefined} pending
 */
export function mergePreviewsPreservingPending(stored, pending) {
  const next = { front: null, left: null, right: null };
  POSE_SLOT_KEYS.forEach((slot) => {
    next[slot] = pending?.[slot] || stored?.[slot] || null;
  });
  return next;
}

/**
 * @param {{ front?: string|null, left?: string|null, right?: string|null }} pendingSlots
 * @param {{ front?: string|null, left?: string|null, right?: string|null }} [previews]
 * @param {{ includeFilledDataUrls?: boolean }} [options]
 * @returns {{ transformationPhotos: object } | {}}
 */
export function buildTransformationPhotoPayload(pendingSlots, previews = {}, options = {}) {
  const includeFilledDataUrls = options.includeFilledDataUrls === true;
  const extras = {};
  POSE_SLOT_KEYS.forEach((slot) => {
    const pending = pendingSlots?.[slot];
    if (isDataImageUrl(pending)) {
      extras[slot] = pending.trim();
      return;
    }
    if (!includeFilledDataUrls) return;
    const preview = previews?.[slot];
    if (isDataImageUrl(preview)) extras[slot] = preview.trim();
  });
  return Object.keys(extras).length > 0 ? { transformationPhotos: extras } : {};
}

export function hasPendingTransformationUploads(pendingSlots) {
  return POSE_SLOT_KEYS.some((slot) => isDataImageUrl(pendingSlots?.[slot]));
}
