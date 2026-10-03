/**
 * Profile image write routing.
 *
 * Legacy (app < 3.5.1, or missing / unknown version): write ProfileImage base64.
 * New (app >= 3.5.1 and R2 avatars enabled): do not write the data URI;
 * the caller stores ProfileImageKey only.
 *
 * Removal: after MIN_REQUIRED >= 3.5.1 and no supported client still needs
 * a ProfileImage base64 write on POST /api/user/profile.
 */
import { isAtLeastVersion } from '../../app-version/domain/version.rules.js';

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
