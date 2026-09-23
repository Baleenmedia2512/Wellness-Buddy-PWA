/**
 * Upload Left / Centre / Right transformation photos to R2.
 * New saves persist *Key only; front/left/right base64 stays as orphan history.
 * Request may still carry data URIs for upload — they are not written back to JSONB.
 */
import { isEnabled } from '../../shared/lib/feature-flags.js';
import { isR2Configured } from '../../shared/lib/r2/config.js';
import { uploadStoredImageToR2 } from '../../shared/lib/r2/putCompressedJpeg.js';
import { publicObjectUrl, avatarRedirectUrl } from '../../shared/lib/r2/s3.js';
import {
  buildTransformationObjectKey,
  isKeyInFolder,
  R2_FOLDERS,
} from '../../shared/lib/r2/objectKeys.js';
import logger from '../../shared/lib/logger.js';
import {
  TRANSFORMATION_PHOTO_KEY_FIELDS,
  TRANSFORMATION_PHOTO_SLOTS,
  finalizeTransformationPhotosOrphanSlots,
  isDataTransformationPhoto,
  mapTransformationPhotosRecord,
  mergeTransformationPhotos,
  slotsNeedingTransformationR2Upload,
} from './domain/transformationPhotos.rules.js';

export function r2TransformationPhotosEnabled() {
  return isEnabled('ff.r2-transformation-photos') && isR2Configured();
}

/** Public (or signed) URL for a transformation object key. */
export function transformationPhotoUrlForKey(key) {
  if (!key || !isKeyInFolder(key, R2_FOLDERS.transformation)) return null;
  return publicObjectUrl(key) || avatarRedirectUrl(key);
}

/**
 * Upload missing R2 keys for data:image slots on the in-memory record.
 *
 * @param {string|number} userId
 * @param {unknown} photosRaw
 * @returns {Promise<object>}
 */
export async function persistTransformationPhotoKeys(userId, photosRaw) {
  const record = mapTransformationPhotosRecord(photosRaw);
  if (!r2TransformationPhotosEnabled()) return record;

  const needing = slotsNeedingTransformationR2Upload(record);
  if (!needing.length) return record;

  const next = { ...record };
  await Promise.all(needing.map(async (slot) => {
    const dataUri = next[slot];
    if (!isDataTransformationPhoto(dataUri)) return;
    try {
      const key = await uploadStoredImageToR2({
        imageBase64: dataUri,
        folder: R2_FOLDERS.transformation,
        buildKey: (hash) => buildTransformationObjectKey(userId, slot, hash, 'jpg'),
      });
      if (!key) return;
      const keyField = TRANSFORMATION_PHOTO_KEY_FIELDS[slot];
      next[keyField] = key;
    } catch (err) {
      logger.warn('[transformation-photo-storage] slot upload skipped', {
        userId,
        slot,
        message: err?.message || String(err),
      });
    }
  }));
  return next;
}

function hasIncomingSlots(incoming) {
  if (incoming == null || typeof incoming !== 'object' || Array.isArray(incoming)) return false;
  return TRANSFORMATION_PHOTO_SLOTS.some((slot) => {
    if (!(slot in incoming)) return false;
    const value = incoming[slot];
    if (isDataTransformationPhoto(value)) return true;
    return typeof value === 'string' && /^https:\/\//i.test(value.trim());
  });
}

/**
 * Merge incoming → upload R2 → keys only (orphan prior front/left/right values).
 * @returns {Promise<object|null>}
 */
export async function persistTransformationPhotosR2Orphan(userId, existingRaw, incoming) {
  if (!hasIncomingSlots(incoming)) return null;
  const forUpload = mergeTransformationPhotos(existingRaw, incoming);
  if (!r2TransformationPhotosEnabled()) {
    logger.warn('[transformation-photo-storage] R2 off — skipping transformation photo persist', {
      userId,
    });
    return null;
  }
  const needing = slotsNeedingTransformationR2Upload(forUpload);
  const withKeys = await persistTransformationPhotoKeys(userId, forUpload);
  const missing = needing.filter((slot) => {
    const keyField = TRANSFORMATION_PHOTO_KEY_FIELDS[slot];
    return !withKeys[keyField];
  });
  if (missing.length) {
    throw new Error(`Failed to upload transformation photos (${missing.join(', ')}). Please try again.`);
  }
  return finalizeTransformationPhotosOrphanSlots(existingRaw, withKeys);
}

/**
 * Backfill: add keys; keep orphan base64 slots unchanged.
 * @returns {Promise<{ record: object, uploaded: string[] }>}
 */
export async function backfillTransformationPhotoKeys(userId, photosRaw) {
  const before = mapTransformationPhotosRecord(photosRaw);
  const after = await persistTransformationPhotoKeys(userId, before);
  const record = finalizeTransformationPhotosOrphanSlots(before, after);
  const uploaded = TRANSFORMATION_PHOTO_SLOTS.filter((slot) => {
    const keyField = TRANSFORMATION_PHOTO_KEY_FIELDS[slot];
    return !before[keyField] && Boolean(record[keyField]);
  });
  return { record, uploaded };
}
