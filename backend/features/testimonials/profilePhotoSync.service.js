/**
 * Sync Profile / BCM Left·Right slots onto testimonials Before·After.
 * Keeps status incomplete and skips OTP — direct Transformation submit still owns approval.
 */
import * as repo from './testimonials.repository.js';
import { validateSyncProfilePhotos } from './testimonials.validators.js';
import {
  canSyncProfileAfterToTestimonial,
  hasPositiveWeight,
  testimonialHasRealAfter,
} from './domain/profilePhotoSync.rules.js';
import { resolveOtpRecipientIds, toPositiveUserId } from './domain/otpRecipient.rules.js';
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

  if (afterImageBase64 && canSyncProfileAfterToTestimonial(existing, repo.isVideoOnlyPlaceholder)) {
    const afterPath = storagePath(userId, 'after', ts);
    await repo.uploadImage(afterImageBase64, afterPath);
    updates.afterImagePath = afterPath;
    if (!existing.status || existing.status === 'incomplete') {
      updates.status = 'incomplete';
    }
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
