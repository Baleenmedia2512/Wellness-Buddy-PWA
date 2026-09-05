/**
 * Upload meal photos to R2 (≤22 KB / 256 px) and save ImageKey.
 * Non-fatal: callers keep writing food_nutrition_data_table.ImageBase64.
 */
import crypto from 'crypto';
import { isEnabled } from '../../shared/lib/feature-flags.js';
import { parseStoredImage, shouldStoreFoodImageInR2 } from '../../shared/lib/images/dataUri.js';
import { compressAvatarJpeg } from '../../shared/lib/images/avatarJpeg.js';
import {
  isR2Configured,
  putObject,
  avatarRedirectUrl,
} from '../../shared/lib/r2/s3.js';
import { buildFoodObjectKey, isKeyInFolder, R2_FOLDERS } from '../../shared/lib/r2/objectKeys.js';
import logger from '../../shared/lib/logger.js';
import * as repo from './food-corrections.repository.js';

export function r2FoodImagesEnabled() {
  return isEnabled('ff.r2-food-images') && isR2Configured();
}

/** Default IST backfill window for existing meal photos (inclusive). */
export const FOOD_R2_BACKFILL_START_YMD = '2026-08-30';
export const FOOD_R2_BACKFILL_END_YMD = '2026-09-05';

export function foodImageRedirectUrl(key) {
  if (!key) return null;
  return avatarRedirectUrl(key);
}

/**
 * @param {string|number} userId
 * @param {string|number} mealId
 * @param {string} imageBase64 data URI or raw base64
 * @returns {Promise<string|null>}
 */
export async function uploadFoodImage(userId, mealId, imageBase64) {
  if (!r2FoodImagesEnabled()) return null;
  if (!shouldStoreFoodImageInR2(imageBase64)) return null;
  const parsed = parseStoredImage(imageBase64);
  if (!parsed) return null;

  const compressed = await compressAvatarJpeg(parsed.bytes);
  const hash = crypto.createHash('sha256').update(compressed.bytes).digest('hex').slice(0, 16);
  const key = buildFoodObjectKey(userId, mealId, hash, 'jpg');
  if (!isKeyInFolder(key, R2_FOLDERS.food)) {
    throw new Error('Food image key must stay under food/');
  }

  await putObject({
    key,
    body: compressed.bytes,
    contentType: compressed.contentType,
  });
  return key;
}

/**
 * Upload (if needed) and persist ImageKey. Never throws to the caller.
 * @returns {Promise<string|null>}
 */
export async function persistFoodImageKey(userId, mealId, imageBase64) {
  try {
    if (!shouldStoreFoodImageInR2(imageBase64)) return null;
    const key = await uploadFoodImage(userId, mealId, imageBase64);
    if (!key) return null;
    await repo.updateFoodImageKey(mealId, userId, key);
    return key;
  } catch (err) {
    logger.warn('[food-image-storage] persist skipped', {
      userId,
      mealId,
      message: err?.message || String(err),
    });
    return null;
  }
}
