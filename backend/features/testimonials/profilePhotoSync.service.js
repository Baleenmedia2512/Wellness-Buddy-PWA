/**
 * Profile ↔ Transformation photo sync — DISABLED.
 * Profile Left/Centre/Right and Transformation Before/After stay independent.
 * Exports keep the old shapes so call sites and the sync-profile-photos API remain stable.
 */
import { validateSyncProfilePhotos } from './testimonials.validators.js';
import logger from '../../shared/lib/logger.js';

const DISABLED = 'profile_transformation_sync_disabled';

/**
 * @param {{ userId: number, existing?: object|null, coachId?: number|null }} input
 * @returns {Promise<object|null>}
 */
export async function hydrateTestimonialPhotosFromProfile({ existing = null } = {}) {
  return existing ?? null;
}

/**
 * @param {object} rawBody
 * @returns {Promise<{ httpStatus: number, body: object }>}
 */
export async function syncProfilePhotosToTestimonial(rawBody) {
  // Validate so bad clients still get 400; never write testimonial photos from profile.
  try {
    validateSyncProfilePhotos(rawBody);
  } catch (err) {
    throw err;
  }
  logger.info('[profilePhotoSync] skipped profile→testimonial sync', { reason: DISABLED });
  return {
    httpStatus: 200,
    body: { success: true, skipped: true, reason: DISABLED },
  };
}

/**
 * @param {{ userId: number, beforeImagePath?: string|null, afterImagePath?: string|null }} input
 */
export async function syncTestimonialPathsToProfile() {
  return { skipped: true, reason: DISABLED };
}

/**
 * @param {{ userId: number, beforeImageBase64?: string|null, afterImageBase64?: string|null }} input
 */
export async function syncTestimonialPhotosToProfile() {
  return { skipped: true, reason: DISABLED };
}

export async function syncTestimonialPhotosToProfileSafe(input) {
  try {
    return await syncTestimonialPhotosToProfile(input);
  } catch (err) {
    logger.warn('[profilePhotoSync] testimonial→profile sync failed (non-fatal)', {
      userId: input?.userId,
      message: err?.message,
    });
    return { skipped: true, reason: 'error', message: err?.message };
  }
}

export async function syncTestimonialPathsToProfileSafe(input) {
  try {
    return await syncTestimonialPathsToProfile(input);
  } catch (err) {
    logger.warn('[profilePhotoSync] testimonial path→profile sync failed (non-fatal)', {
      userId: input?.userId,
      message: err?.message,
    });
    return { skipped: true, reason: 'error', message: err?.message };
  }
}
