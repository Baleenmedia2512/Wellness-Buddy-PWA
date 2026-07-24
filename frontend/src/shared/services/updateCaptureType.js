/**
 * PATCH /api/background-analysis/captures with retries.
 * Prevents orphan pending rows when a single network blip drops the type update.
 */
import { getApiBaseUrl } from '../../config/api.config';
import { debugLog } from '../utils/logger.js';

const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 500;

/**
 * @param {object} opts
 * @param {string|number} opts.captureId
 * @param {string|number} opts.userId
 * @param {string} opts.imageType
 * @param {string} [opts.apiBaseUrl]
 * @returns {Promise<{ ok: boolean, reason?: string }>}
 */
export async function updateCaptureTypeWithRetry({
  captureId,
  userId,
  imageType,
  apiBaseUrl = getApiBaseUrl(),
}) {
  if (captureId == null || captureId === '' || userId == null || userId === '') {
    return { ok: false, reason: 'MISSING_PARAMS' };
  }

  let lastReason = 'UNKNOWN';
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(`${apiBaseUrl}/api/background-analysis/captures`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: captureId, userId, imageType }),
      });
      if (res.ok) return { ok: true };
      lastReason = `HTTP_${res.status}`;
      // 4xx won't self-heal — stop retrying.
      if (res.status >= 400 && res.status < 500) break;
    } catch (err) {
      lastReason = err?.message ?? 'NETWORK_ERROR';
    }
    if (attempt < MAX_ATTEMPTS) {
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * attempt));
    }
  }

  debugLog(`[Share] updateCaptureType(${imageType}) failed after ${MAX_ATTEMPTS} attempts:`, lastReason);
  return { ok: false, reason: lastReason };
}

/**
 * Resolve a share promise then PATCH the capture type with retries.
 *
 * @param {Promise<{ id?: string|number }>|{ id?: string|number }} sharePromise
 * @param {string} imageType
 * @param {string|number|null|undefined} userId
 * @param {string} [apiBaseUrl]
 */
export async function updatePendingCaptureTypeWithRetry(
  sharePromise,
  imageType,
  userId,
  apiBaseUrl = getApiBaseUrl(),
) {
  const share = await Promise.resolve(sharePromise);
  if (!share?.id || userId == null || userId === '') {
    return { ok: false, reason: 'MISSING_SHARE' };
  }
  return updateCaptureTypeWithRetry({
    captureId: share.id,
    userId,
    imageType,
    apiBaseUrl,
  });
}
