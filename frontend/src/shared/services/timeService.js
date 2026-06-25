/**
 * @file timeService — server time utilities for features that need
 * to validate device clock against server time.
 *
 * Moved from `features/misc/services/misc.api.js` so features can
 * access server time without cross-feature imports.
 *
 * Named exports only.
 */


/**
 * Fetch the current server time.
 * Useful for detecting device clock manipulation.
 *
 * @returns {Promise<{serverTime: string, timestamp: number}>} Server time data
 */
export async function getServerTime() {
  const apiBaseUrl = process.env.REACT_APP_API_BASE_URL;
  
  try {
    const res = await fetch(`${apiBaseUrl}/api/misc/server-time`, { 
      cache: 'no-store' 
    });
    return res.json();
  } catch (err) {
    console.error('[timeService] Error fetching server time:', err);
    throw err;
  }
}
