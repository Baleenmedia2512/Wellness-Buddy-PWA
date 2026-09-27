/**
 * Client-side generation counter for /api/user/avatar?userId= URLs.
 * R2 object keys change on upload, but the avatar redirect URL is stable —
 * bumping this version appends &_v= so browsers do not keep a stale 302.
 */
let generation = 0;
const listeners = new Set();

export function getAvatarDisplayVersion() {
  return generation;
}

export function bumpAvatarDisplayVersion() {
  generation += 1;
  listeners.forEach((fn) => {
    try {
      fn(generation);
    } catch {
      /* ignore subscriber errors */
    }
  });
  return generation;
}

export function subscribeAvatarDisplayVersion(fn) {
  if (typeof fn !== 'function') return () => {};
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Build avatar GET URL with optional cache-bust query. */
export function buildUserAvatarUrl(apiBaseUrl, userId, version = generation, options = {}) {
  if (!apiBaseUrl || userId == null || userId === '') return null;
  const params = new URLSearchParams();
  params.set('userId', String(userId));
  if (Number(version) > 0) params.set('_v', String(version));
  if (options.inline) params.set('inline', '1');
  return `${apiBaseUrl}/api/user/avatar?${params.toString()}`;
}

/**
 * Avatar for html2canvas share cards.
 * Prefer data: URIs — R2/Google https URLs fail browser CORS on canvas capture.
 * Order: legacy base64 ProfileImage → CORS-safe sharePhotoBase64 → other https.
 */
export function pickShareAvatarSrc({
  savedProfileImage = null,
  sharePhotoBase64 = null,
  photoURL = null,
} = {}) {
  const saved = typeof savedProfileImage === 'string' ? savedProfileImage.trim() : '';
  const share = typeof sharePhotoBase64 === 'string' ? sharePhotoBase64.trim() : '';
  const photo = typeof photoURL === 'string' ? photoURL.trim() : '';
  if (saved.startsWith('data:image/')) return saved;
  if (share.startsWith('data:image/')) return share;
  if (share) return share;
  return saved || photo || null;
}
