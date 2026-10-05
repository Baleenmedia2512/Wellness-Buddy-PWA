/**
 * Profile image write routing.
 *
 * Legacy (app < 3.5.1, or missing / unknown version): write ProfileImage base64.
 * New (app >= 3.5.1 and R2 avatars enabled): do not write the data URI;
 * the caller stores ProfileImageKey only.
 *
 * Centre transformation photo (front) is also the profile avatar when no
 * explicit profileImage is sent on the same save.
 *
 * Removal: after MIN_REQUIRED >= 3.5.1 and no supported client still needs
 * a ProfileImage base64 write on POST /api/user/profile.
 */
import { isAtLeastVersion } from '../../app-version/domain/version.rules.js';
import { isDataTransformationPhoto } from './transformationPhotos.rules.js';

export const PROFILE_IMAGE_R2_ONLY_MIN_APP_VERSION = '3.5.1';

/**
 * @param {{ r2Enabled?: boolean, appVersion?: string|null, minAppVersion?: string }} args
 * @returns {boolean}
 */
export function shouldSkipProfileImageBase64({
  r2Enabled = false,
  appVersion = null,
  minAppVersion = PROFILE_IMAGE_R2_ONLY_MIN_APP_VERSION,
} = {}) {
  if (!r2Enabled) return false;
  return isAtLeastVersion(appVersion, minAppVersion) === true;
}

/**
 * Resolve the avatar data URI for a profile save.
 * Explicit profileImage wins; otherwise Centre (transformationPhotos.front).
 *
 * @param {{
 *   profileImage?: string|null,
 *   transformationPhotos?: { front?: string|null }|null,
 * }} [input]
 * @returns {string|null}
 */
export function resolveIncomingAvatarDataUri({
  profileImage = null,
  transformationPhotos = null,
} = {}) {
  if (typeof profileImage === 'string' && profileImage.trim().startsWith('data:image/')) {
    return profileImage.trim();
  }
  const front = transformationPhotos?.front;
  if (isDataTransformationPhoto(front)) return String(front).trim();
  return null;
}
