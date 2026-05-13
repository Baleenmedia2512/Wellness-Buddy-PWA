/**
 * @file getUserId — looks up the canonical database UserID for an
 * authenticated principal, with a session-level email→userId cache
 * to avoid redundant `/api/user/lookup` calls.
 *
 * Moved from `features/user/services/getUserId.js` so non-user
 * features can resolve identity without crossing slice boundaries.
 *
 * Named exports only.
 */

const userIdCache = new Map();

/**
 * Clear the userId cache (call on logout).
 */
export function clearUserIdCache() {
  userIdCache.clear();
}

/**
 * Look up the real UserID from the backend using the principal's email.
 * Uses a session-level cache.
 *
 * @param {{ email?: string|null } | null | undefined} user
 * @returns {Promise<string|number|null>} the DB UserID, or `null` when unknown.
 */
export async function getUserId(user) {
  const apiBaseUrl = process.env.REACT_APP_API_BASE_URL;
  if (!user) return null;
  const email = user.email || null;
  if (!email) return null;

  if (userIdCache.has(email)) {
    console.log('[getUserId] Cache HIT for:', email);
    return userIdCache.get(email);
  }

  try {
    const res = await fetch(`${apiBaseUrl}/api/user/lookup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    if (data.success && data.userId) {
      userIdCache.set(email, data.userId);
      console.log('[getUserId] Cached userId for:', email);
      return data.userId;
    }
    return null;
  } catch (err) {
    console.error('[getUserId] Error:', err);
    return null;
  }
}
