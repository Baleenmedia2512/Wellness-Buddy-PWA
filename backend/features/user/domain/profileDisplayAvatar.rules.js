/**
 * Display avatar resolution — same order as My Profile / Home header:
 *   1. R2 ProfileImageKey (explicit avatar upload / synced copy)
 *   2. https ProfileImage (e.g. Google)
 *   3. Legacy data:image ProfileImage
 *   4. Centre transformation R2 key (frontKey) when configured
 *   5. Centre transformation photo (transformationPhotos.front)
 *
 * Profile photo wins over Centre so leaderboard / lists match My Profile.
 * Centre is only a fallback when no profile image is set.
 * /api/user/avatar must follow this chain so ranking matches Home header.
 */
import { isHttpsImageUrl } from '../../../shared/lib/images/dataUri.js';
import { mapTransformationPhotosRecord } from './transformationPhotos.rules.js';

/**
 * @param {{
 *   profileImageKey?: string|null,
 *   profileImage?: string|null,
 *   transformationPhotos?: unknown,
 *   r2Enabled?: boolean,
 *   resolveR2Url?: (key: string) => string|null,
 * }} input
 * @returns {{ kind: 'redirect', url: string }
 *   | { kind: 'dataUri', value: string, persistAsProfileAvatar?: boolean }
 *   | { kind: 'none' }}
 */
export function resolveProfileDisplayAvatar({
  profileImageKey = null,
  profileImage = null,
  transformationPhotos = null,
  r2Enabled = false,
  resolveR2Url = null,
} = {}) {
  if (r2Enabled && profileImageKey && typeof resolveR2Url === 'function') {
    const url = resolveR2Url(profileImageKey);
    if (url) return { kind: 'redirect', url };
  }

  if (isHttpsImageUrl(profileImage)) {
    return { kind: 'redirect', url: String(profileImage).trim() };
  }

  if (typeof profileImage === 'string' && profileImage.startsWith('data:image/')) {
    return { kind: 'dataUri', value: profileImage, persistAsProfileAvatar: true };
  }

  const transform = mapTransformationPhotosRecord(transformationPhotos);
  if (r2Enabled && transform.frontKey && typeof resolveR2Url === 'function') {
    const url = resolveR2Url(transform.frontKey);
    if (url) return { kind: 'redirect', url };
  }

  const front = transform.front;
  if (front) {
    if (isHttpsImageUrl(front)) {
      return { kind: 'redirect', url: front };
    }
    if (front.startsWith('data:image/')) {
      return { kind: 'dataUri', value: front, persistAsProfileAvatar: false };
    }
  }

  return { kind: 'none' };
}
