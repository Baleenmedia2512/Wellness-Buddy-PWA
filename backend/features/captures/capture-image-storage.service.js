/**
 * Dual-write capture photos to R2 (≤22 KB). Feature rows pointer to this key.
 * Do not PUT the same JPEG again under food/ / weight/ / education/.
 */
import { isEnabled } from '../../shared/lib/feature-flags.js';
import { isR2Configured } from '../../shared/lib/r2/config.js';
import { avatarRedirectUrl } from '../../shared/lib/r2/s3.js';
import { uploadStoredImageToR2 } from '../../shared/lib/r2/putCompressedJpeg.js';
import { buildCaptureObjectKey, R2_FOLDERS } from '../../shared/lib/r2/objectKeys.js';
import logger from '../../shared/lib/logger.js';
import * as repo from './data/captures.repository.js';

export const CAPTURE_R2_BACKFILL_START_YMD = '2026-08-30';
export const CAPTURE_R2_BACKFILL_END_YMD = '2026-09-05';

export function r2CapturesEnabled() {
  return isEnabled('ff.r2-captures') && isR2Configured();
}

export function captureImageRedirectUrl(key) {
  if (!key) return null;
  return avatarRedirectUrl(key);
}

/** Public read for other domains — ImageKey only, never ImageBase64. */
export async function getStoredCaptureImageKey(captureId) {
  if (captureId == null || String(captureId).trim() === '') return null;
  try {
    return await repo.getImageKeyById(captureId);
  } catch (err) {
    logger.warn('[capture-image-storage] get key skipped', {
      captureId,
      message: err?.message || String(err),
    });
    return null;
  }
}

export async function persistCaptureImageKey(userId, captureId, imageBase64) {
  try {
    if (!r2CapturesEnabled()) return null;
    const key = await uploadStoredImageToR2({
      imageBase64,
      folder: R2_FOLDERS.captures,
      buildKey: (hash) => buildCaptureObjectKey(userId, captureId, hash, 'jpg'),
    });
    if (!key) return null;
    await repo.updateCaptureImageKey(captureId, userId, key);
    return key;
  } catch (err) {
    logger.warn('[capture-image-storage] persist skipped', {
      userId,
      captureId,
      message: err?.message || String(err),
    });
    return null;
  }
}
