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
export function buildUserAvatarUrl(apiBaseUrl, userId, version = generation) {
  if (!apiBaseUrl || userId == null || userId === '') return null;
  const base = `${apiBaseUrl}/api/user/avatar?userId=${encodeURIComponent(userId)}`;
  return version > 0 ? `${base}&_v=${version}` : base;
}
