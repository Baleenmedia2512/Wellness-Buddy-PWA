/**
 * URL for an image key.
 * MilesWeb file when it is already on disk, otherwise the existing R2 URL.
 * Missing disk file and no R2 config returns null so callers keep the old fallback.
 */
import { isEnabled } from '../feature-flags.js';
import { isR2Configured } from '../r2/config.js';
import { avatarRedirectUrl } from '../r2/s3.js';
import { isMileswebStorageEnabled } from './config.js';
import { isAllowedUploadKey, mileswebRedirectUrl } from './objectKey.js';

export async function resolveStoredImageUrl(key) {
  if (!isAllowedUploadKey(key)) return null;
  if (isMileswebStorageEnabled()) {
    try {
      const { mileswebObjectExists } = await import('./ftpStorage.js');
      if (await mileswebObjectExists(key)) return mileswebRedirectUrl(key);
    } catch {
      /* keep the previous R2 or base64 path */
    }
  }
  if (!isR2Configured()) return null;
  return avatarRedirectUrl(key);
}

export async function redirectUrlForImageKey(key, flagName) {
  if (!key || !flagName || !isEnabled(flagName)) return null;
  if (!isR2Configured() && !isMileswebStorageEnabled()) return null;
  return resolveStoredImageUrl(key);
}
