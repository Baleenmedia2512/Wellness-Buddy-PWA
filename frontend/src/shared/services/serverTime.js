/**
 * @file serverTime — fetch current server time for clock drift detection.
 *
 * Moved from `features/misc/services/misc.api.js` so features like
 * activity can detect device clock drift without crossing slice boundaries.
 *
 * Named exports only.
 */
import { getApiBaseUrl } from '../../config/api.config.js';

const base = () => getApiBaseUrl();

/**
 * Fetch the current server time.
 * @returns {Promise<{ serverTime: string }>} ISO8601 timestamp from server
 */
export async function getServerTime() {
  const res = await fetch(`${base()}/api/misc/server-time`, { cache: 'no-store' });
  return res.json();
}
