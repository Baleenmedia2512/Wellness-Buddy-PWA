import { debugLog } from '../utils/logger.js';

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
    debugLog('[getUserId] Cache HIT for:', email);
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
      debugLog('[getUserId] Cached userId for:', email);
      return data.userId;
    }
    return null;
  } catch (err) {
    console.error('[getUserId] Error:', err);
    return null;
  }
}

/**
 * Look up user by email and return the full API response.
 * Useful when you need access to success status and other metadata.
 *
 * @param {string} email - The email address to lookup
 * @returns {Promise<{success: boolean, userId?: number}>} Full API response
 */
export async function lookupUserByEmail(email) {
  const apiBaseUrl = process.env.REACT_APP_API_BASE_URL;
  if (!email) return { success: false };

  try {
    const res = await fetch(`${apiBaseUrl}/api/user/lookup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    
    // Cache the userId if successful
    if (data.success && data.userId) {
      userIdCache.set(email, data.userId);
      debugLog('[lookupUserByEmail] Cached userId for:', email);
    }
    
    return data;
  } catch (err) {
    console.error('[lookupUserByEmail] Error:', err);
    return { success: false, error: err.message };
  }
}
