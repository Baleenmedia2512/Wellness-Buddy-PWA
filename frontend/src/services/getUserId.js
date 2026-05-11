// src/services/getUserId.js
/**
 * Session cache for email -> userId mapping
 * Prevents redundant API calls during same session
 */
const userIdCache = new Map();

/**
 * Clear the userId cache (call on logout)
 */
export function clearUserIdCache() {
  userIdCache.clear();
}

/**
 * Looks up the real UserID from the backend using email.
 * Returns the UserID from the DB, or null if not found.
 * Uses session-level caching to prevent redundant API calls.
 */
export async function getUserId(user) {
  const apiBaseUrl = process.env.REACT_APP_API_BASE_URL;
  if (!user) return null;
  const email = user.email || null;
  if (!email) return null;

  // Check session cache first
  if (userIdCache.has(email)) {
    console.log('[getUserId] Cache HIT for:', email);
    return userIdCache.get(email);
  }

  try {
    const res = await fetch(`${apiBaseUrl}/api/user/lookup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    const data = await res.json();
    if (data.success && data.userId) {
      // Cache for entire session
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
