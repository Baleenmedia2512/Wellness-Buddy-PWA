/**
 * Profile GET stores the row under a version suffix, not the bare key.
 * OTP saves must drop every variant or the next read paints the previous value.
 */
import { cache, cacheKeys } from '../../utils/cache.js';

export function clearUserProfileCache({ email, userId } = {}) {
  const bases = [];
  if (userId != null && String(userId).trim() !== '') {
    bases.push(cacheKeys.userProfile(`id:${userId}`));
  }
  const emailKey = String(email || '').trim().toLowerCase();
  if (emailKey) bases.push(cacheKeys.userProfile(emailKey));
  for (const base of bases) {
    try {
      cache.delete(base);
      cache.delete(`${base}:tp-r2`);
      cache.delete(`${base}:tp-legacy`);
    } catch { /* non-fatal */ }
  }
}
