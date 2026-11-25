/**
 * Centre photos use the same file store as weight, education, and good-habit photos.
 * MySQL keeps the object key. The JPEG is written to MilesWeb (or R2).
 */
import logger from '../../shared/lib/logger.js';
import { uploadStoredImageToR2 } from '../../shared/lib/r2/putCompressedJpeg.js';
import { deleteObject } from '../../shared/lib/r2/s3.js';
import { R2_FOLDERS, buildNutritionCentreObjectKey } from '../../shared/lib/r2/objectKeys.js';
import { resolveStoredImageUrl } from '../../shared/lib/milesweb/storedImage.js';
import { CENTRE_PHOTO_SLOTS, centrePhotoRows, groupCentrePhotos } from './domain/centreProfile.rules.js';
import * as repo from './centers.repository.js';

async function deleteStoredKey(key) {
  if (!key) return;
  try {
    await deleteObject({ key });
  } catch (err) {
    logger.warn({ message: err?.message, key }, 'centre photo delete skipped');
  }
}

/**
 * Upload new JPEGs, keep photos that are already on disk, and drop removed files.
 * @param {number} centerId
 * @param {Record<string, Array<{ type: string, dataUrl?: string, key?: string }>>} photos
 */
export async function saveCentrePhotoFiles(centerId, photos) {
  const previous = await repo.listCenterPhotos(centerId);
  /** @type {Record<string, string[]>} */
  const keysBySlot = {};
  const uploaded = [];
  try {
    for (const slot of CENTRE_PHOTO_SLOTS) {
      keysBySlot[slot.key] = [];
      for (const item of photos[slot.key] || []) {
        if (item.type === 'keep' && item.key) {
          keysBySlot[slot.key].push(item.key);
          continue;
        }
        const key = await uploadStoredImageToR2({
          imageBase64: item.dataUrl,
          folder: R2_FOLDERS.nutritionCentre,
          buildKey: (hash) => buildNutritionCentreObjectKey(centerId, slot.key, hash, 'jpg'),
        });
        if (!key) throw new Error('Centre photo could not be saved');
        uploaded.push(key);
        keysBySlot[slot.key].push(key);
      }
    }
    await repo.replaceCenterPhotos(centerId, centrePhotoRows(centerId, keysBySlot));
  } catch (err) {
    await Promise.all(uploaded.map((key) => deleteStoredKey(key)));
    throw err;
  }

  const keep = new Set(Object.values(keysBySlot).flat());
  await Promise.all(previous.map((row) => (
    keep.has(row.image_key) ? null : deleteStoredKey(row.image_key)
  )));
}

export async function removeCentrePhotoFiles(centerId) {
  const previous = await repo.listCenterPhotos(centerId);
  await repo.deleteCenterPhotos(centerId);
  await Promise.all(previous.map((row) => deleteStoredKey(row.image_key)));
}

/**
 * @param {Array<{ category?: string, image_key?: string }>} rows
 * @returns {Promise<Record<string, string[]>>}
 */
export async function centrePhotoUrls(rows) {
  const grouped = groupCentrePhotos(rows);
  /** @type {Record<string, string[]>} */
  const urls = {};
  for (const slot of Object.keys(grouped)) {
    urls[slot] = [];
    for (const key of grouped[slot]) {
      const url = await resolveStoredImageUrl(key);
      urls[slot].push(url || key);
    }
  }
  return urls;
}
