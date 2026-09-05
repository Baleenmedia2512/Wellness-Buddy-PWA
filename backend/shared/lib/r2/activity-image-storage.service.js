/**
 * Dual-write weight / education / good-habit photos to R2 (≤22 KB).
 * JSON image APIs stay Base64 — do not 302 (old clients parse JSON).
 */
import { isEnabled } from '../feature-flags.js';
import { isR2Configured } from './config.js';
import { uploadStoredImageToR2 } from './putCompressedJpeg.js';
import {
  buildWeightObjectKey,
  buildEducationObjectKey,
  buildGoodHabitObjectKey,
  R2_FOLDERS,
} from './objectKeys.js';
import logger from '../logger.js';
import * as weightRepo from '../../../features/weight/weight.repository.js';
import * as educationRepo from '../../../features/education/education.repository.js';
import * as habitRepo from '../../../features/good-habits/data/good-habits.repo.js';

export const ACTIVITY_R2_BACKFILL_START_YMD = '2026-08-30';
export const ACTIVITY_R2_BACKFILL_END_YMD = '2026-09-05';

export function r2ActivityImagesEnabled() {
  return isEnabled('ff.r2-activity-images') && isR2Configured();
}

export async function persistWeightImageKey(userId, recordId, imageBase64) {
  try {
    if (!r2ActivityImagesEnabled()) return null;
    const key = await uploadStoredImageToR2({
      imageBase64,
      folder: R2_FOLDERS.weight,
      buildKey: (hash) => buildWeightObjectKey(userId, recordId, hash, 'jpg'),
    });
    if (!key) return null;
    await weightRepo.updateWeightImageKey(recordId, userId, key);
    return key;
  } catch (err) {
    logger.warn('[activity-image-storage] weight persist skipped', {
      userId,
      recordId,
      message: err?.message || String(err),
    });
    return null;
  }
}

export async function persistEducationImageKey(userId, logId, imageBase64) {
  try {
    if (!r2ActivityImagesEnabled()) return null;
    const key = await uploadStoredImageToR2({
      imageBase64,
      folder: R2_FOLDERS.education,
      buildKey: (hash) => buildEducationObjectKey(userId, logId, hash, 'jpg'),
    });
    if (!key) return null;
    await educationRepo.updateEducationImageKey(logId, userId, key);
    return key;
  } catch (err) {
    logger.warn('[activity-image-storage] education persist skipped', {
      userId,
      logId,
      message: err?.message || String(err),
    });
    return null;
  }
}

export async function persistGoodHabitImageKeys(userId, habitId, images = {}) {
  try {
    if (!r2ActivityImagesEnabled()) return null;
    const patch = {};
    const slots = [
      ['main', images.imageBase64, 'ImageKey'],
      ['before', images.beforeImageBase64, 'BeforeImageKey'],
      ['after', images.afterImageBase64, 'AfterImageKey'],
    ];
    for (const [slot, blob, column] of slots) {
      if (!blob) continue;
      const key = await uploadStoredImageToR2({
        imageBase64: blob,
        folder: R2_FOLDERS.goodHabit,
        buildKey: (hash) => buildGoodHabitObjectKey(userId, habitId, slot, hash, 'jpg'),
      });
      if (key) patch[column] = key;
    }
    if (!Object.keys(patch).length) return null;
    await habitRepo.updateGoodHabitImageKeys(habitId, userId, patch);
    return patch;
  } catch (err) {
    logger.warn('[activity-image-storage] good-habit persist skipped', {
      userId,
      habitId,
      message: err?.message || String(err),
    });
    return null;
  }
}
