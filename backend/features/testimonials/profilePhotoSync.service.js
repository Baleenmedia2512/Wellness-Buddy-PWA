/**
 * Sync Profile / BCM Left·Right slots onto testimonials Before·After.
 * Keeps status incomplete and skips OTP — direct Transformation submit still owns approval.
 */
import * as repo from './testimonials.repository.js';
import { validateSyncProfilePhotos } from './testimonials.validators.js';
import {
  buildProfileSlotsFromTestimonialImages,
  hasPositiveWeight,
  testimonialHasRealAfter,
} from './domain/profilePhotoSync.rules.js';
import { resolveOtpRecipientIds, toPositiveUserId } from './domain/otpRecipient.rules.js';
import {
  mergeTransformationPhotos,
  hasTransformationPhotoUpdates,
} from '../user/domain/transformationPhotos.rules.js';
import { getSupabaseClient } from '../../utils/supabaseClient.js';
import logger from '../../shared/lib/logger.js';

const FALLBACK_DURATION = '1 days';

function storagePath(userId, side, timestamp) {
  return `${userId}/${side}_${timestamp}.jpg`;
}

async function resolveCoachIdForSync(userId) {
  const userInfo = await repo.findCoachIdForUser(userId);
  if (!userInfo) return null;
  const coCoachPartnerId = toPositiveUserId(userInfo.coachId)
    ? null
    : await repo.findCoCoachPartnerId(userId);
  const { recipientId } = resolveOtpRecipientIds({
    memberCoachId: userInfo.coachId,
    coCoachPartnerId,
  });
  return recipientId ?? null;
}

/**
 * @param {object} rawBody
 * @returns {Promise<{ httpStatus: number, body: object }>}
 */
export async function syncProfilePhotosToTestimonial(rawBody) {
  const payload = validateSyncProfilePhotos(rawBody);
  const {
    userId,
    beforeImageBase64,
    afterImageBase64,
    beforeWeightKg,
    goalType,
    recoveredHealthIssues,
  } = payload;

  if (!beforeImageBase64 && !afterImageBase64 && beforeWeightKg == null) {
    return { httpStatus: 200, body: { success: true, skipped: true, reason: 'nothing_to_sync' } };
  }

  const existing = await repo.findByUserId(userId);
  const ts = Date.now();

  if (!existing) {
    if (!beforeImageBase64 || beforeWeightKg == null) {
      return {
        httpStatus: 200,
        body: { success: true, skipped: true, reason: 'no_before_for_create' },
      };
    }
    const coachId = await resolveCoachIdForSync(userId);
    if (!coachId) {
      return { httpStatus: 200, body: { success: true, skipped: true, reason: 'no_coach' } };
    }

    const beforePath = storagePath(userId, 'before', ts);
    await repo.uploadImage(beforeImageBase64, beforePath);
    let afterPath = beforePath;
    if (afterImageBase64) {
      afterPath = storagePath(userId, 'after', ts);
      await repo.uploadImage(afterImageBase64, afterPath);
    }

    const row = await repo.insertTestimonial({
      userId,
      coachId,
      beforeImagePath: beforePath,
      afterImagePath: afterPath,
      beforeWeightKg,
      afterWeightKg: beforeWeightKg,
      goalType,
      durationText: FALLBACK_DURATION,
      status: 'incomplete',
      otpHash: null,
      otpExpiresAt: null,
      recoveredHealthIssues: recoveredHealthIssues ?? [],
    });

    logger.info('[profilePhotoSync] created incomplete testimonial', { userId, testimonialId: row.id });
    return {
      httpStatus: 200,
      body: { success: true, testimonialId: row.id, status: 'incomplete', created: true },
    };
  }

  const updates = {};
  const hasCompleteAfter = testimonialHasRealAfter(existing, repo.isVideoOnlyPlaceholder);

  if (beforeImageBase64) {
    const beforePath = storagePath(userId, 'before', ts);
    await repo.uploadImage(beforeImageBase64, beforePath);
    updates.beforeImagePath = beforePath;
    if (!hasCompleteAfter) {
      updates.status = 'incomplete';
    }
  }

  if (afterImageBase64) {
    const afterPath = storagePath(userId, 'after', ts);
    await repo.uploadImage(afterImageBase64, afterPath);
    updates.afterImagePath = afterPath;
    // Profile Right always wins — reset approval so sponsor re-verifies the new After.
    updates.status = 'incomplete';
    updates.otpHash = null;
    updates.otpExpiresAt = null;
    updates.verifiedAt = null;
    if (!hasPositiveWeight(existing.after_weight_kg) && hasPositiveWeight(beforeWeightKg)) {
      updates.afterWeightKg = beforeWeightKg;
    }
  }

  if (beforeWeightKg != null && !hasPositiveWeight(existing.before_weight_kg)) {
    updates.beforeWeightKg = beforeWeightKg;
  }

  const incomplete = !existing.status || existing.status === 'incomplete';
  const realAfter = testimonialHasRealAfter(existing, repo.isVideoOnlyPlaceholder);
  if (
    beforeWeightKg != null
    && !realAfter
    && !hasPositiveWeight(existing.after_weight_kg)
  ) {
    updates.afterWeightKg = beforeWeightKg;
  }

  if (recoveredHealthIssues !== undefined && incomplete) {
    updates.recoveredHealthIssues = recoveredHealthIssues;
  }

  if (Object.keys(updates).length === 0) {
    return { httpStatus: 200, body: { success: true, skipped: true, reason: 'no_applicable_updates' } };
  }

  await repo.updateTestimonial(existing.id, updates);
  logger.info('[profilePhotoSync] updated testimonial from profile photos', {
    userId,
    testimonialId: existing.id,
    fields: Object.keys(updates),
  });

  return {
    httpStatus: 200,
    body: {
      success: true,
      testimonialId: existing.id,
      status: updates.status ?? existing.status,
      updated: true,
    },
  };
}

function bufferToProfileDataUrl(buffer) {
  return `data:image/jpeg;base64,${buffer.toString('base64')}`;
}

/**
 * Transformation storage paths → Profile Left/Right (after testimonial upload).
 * @param {{ userId: number, beforeImagePath?: string|null, afterImagePath?: string|null }} input
 */
export async function syncTestimonialPathsToProfile({
  userId,
  beforeImagePath,
  afterImagePath,
}) {
  const uid = Number.parseInt(String(userId), 10);
  if (!Number.isFinite(uid) || uid < 1) return { skipped: true, reason: 'bad_user' };

  const slots = {};
  if (beforeImagePath && !repo.isVideoOnlyPlaceholder(beforeImagePath)) {
    const buf = await repo.downloadBuffer(beforeImagePath);
    slots.left = bufferToProfileDataUrl(buf);
  }
  if (afterImagePath && !repo.isVideoOnlyPlaceholder(afterImagePath)) {
    const buf = await repo.downloadBuffer(afterImagePath);
    slots.right = bufferToProfileDataUrl(buf);
  }
  if (!hasTransformationPhotoUpdates(slots)) {
    return { skipped: true, reason: 'no_paths' };
  }

  const supabase = getSupabaseClient();
  const { data: row, error: readErr } = await supabase
    .from('team_table')
    .select('transformation_photos')
    .eq('UserId', uid)
    .maybeSingle();
  if (readErr) throw readErr;

  const merged = mergeTransformationPhotos(row?.transformation_photos ?? null, slots);
  const { error: writeErr } = await supabase
    .from('team_table')
    .update({ transformation_photos: merged })
    .eq('UserId', uid);
  if (writeErr) throw writeErr;

  logger.info('[profilePhotoSync] synced testimonial storage paths to profile', {
    userId: uid,
    slots: Object.keys(slots),
  });
  return { success: true, slots: Object.keys(slots) };
}

/**
 * Transformation Before/After → Profile Left/Right (bidirectional sync).
 * Non-throwing wrapper available via syncTestimonialPhotosToProfileSafe.
 *
 * @param {{ userId: number, beforeImageBase64?: string|null, afterImageBase64?: string|null }} input
 */
export async function syncTestimonialPhotosToProfile({
  userId,
  beforeImageBase64,
  afterImageBase64,
}) {
  const uid = Number.parseInt(String(userId), 10);
  if (!Number.isFinite(uid) || uid < 1) return { skipped: true, reason: 'bad_user' };

  const slots = buildProfileSlotsFromTestimonialImages({
    beforeImageBase64,
    afterImageBase64,
  });
  if (!hasTransformationPhotoUpdates(slots)) {
    return { skipped: true, reason: 'no_images' };
  }

  const supabase = getSupabaseClient();
  const { data: row, error: readErr } = await supabase
    .from('team_table')
    .select('transformation_photos')
    .eq('UserId', uid)
    .maybeSingle();
  if (readErr) throw readErr;

  const merged = mergeTransformationPhotos(row?.transformation_photos ?? null, slots);
  const { error: writeErr } = await supabase
    .from('team_table')
    .update({ transformation_photos: merged })
    .eq('UserId', uid);
  if (writeErr) throw writeErr;

  logger.info('[profilePhotoSync] synced testimonial photos to profile', {
    userId: uid,
    slots: Object.keys(slots),
  });
  return { success: true, slots: Object.keys(slots) };
}

/**
 * Same as syncTestimonialPhotosToProfile but never throws (testimonial save already succeeded).
 */
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

/** Same as syncTestimonialPathsToProfile but never throws. */
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
