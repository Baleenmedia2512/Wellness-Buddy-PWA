/**
 * Display avatar resolution — same order as My Profile UI:
 *   1. R2 ProfileImageKey (when configured)
 *   2. https ProfileImage (e.g. Google)
 *   3. Centre transformation photo (transformationPhotos.front)
 *   4. Legacy data:image ProfileImage (only when no centre transform)
 *
 * Profile GET exposes (1)+(2) as `profileImage`; the FE then falls back to (3).
 * /api/user/avatar must follow this full chain so leaderboards match My Profile.
 */
import { isHttpsImageUrl } from '../../../shared/lib/images/dataUri.js';
import { mapTransformationPhotos } from './transformationPhotos.rules.js';

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

  const front = mapTransformationPhotos(transformationPhotos).front;
  if (front) {
    if (isHttpsImageUrl(front)) {
      return { kind: 'redirect', url: front };
    }
    if (front.startsWith('data:image/')) {
      return { kind: 'dataUri', value: front, persistAsProfileAvatar: false };
    }
  }

  if (typeof profileImage === 'string' && profileImage.startsWith('data:image/')) {
    return { kind: 'dataUri', value: profileImage, persistAsProfileAvatar: true };
  }

  return { kind: 'none' };
}
