/**
 * frontend/src/features/captures/api/captureShareClient.js
 *
 * PR-E / ADR-0003 — network client for the `unknown` capture share viewer.
 *
 * Per claude.md §2.1 this is the ONLY file in the captures slice allowed to
 * talk to the network. Presentation (`UnknownShareViewer`) stays I/O-free;
 * App.js composes these calls.
 */

import axios from 'axios';
import { getApiBaseUrl } from '../../../config/api.config';
import { debugLog } from '../../../shared/utils/logger';

/**
 * Fetch an `unknown` capture by its public share token.
 *
 * @param {Object} params
 * @param {string} params.token          PublicShareToken (UUID).
 * @param {string} [params.viewerUserId] Authenticated session user. Omit for
 *                                        anonymous link recipients.
 * @param {AbortSignal} [params.signal]  Optional cancellation signal.
 * @returns {Promise<{ kind: 'unknown', captureId: string, imageBase64: string|null, createdAt: string|null, canMutate: boolean }>}
 * @throws Error on non-200. Callers should surface `err.response?.status`.
 */
export async function fetchUnknownShare({ token, viewerUserId, signal } = {}) {
  if (!token) throw new Error('fetchUnknownShare: token required');

  const url = `${getApiBaseUrl()}/api/background-analysis/captures/unknown-share`;
  const params = { token: String(token) };
  if (viewerUserId != null && viewerUserId !== '') {
    params.viewerUserId = String(viewerUserId);
  }

  debugLog('[captures] fetchUnknownShare →', params.token);
  const res = await axios.get(url, { params, signal });
  const body = res?.data;
  if (!body || body.ok !== true || !body.data) {
    const err = new Error('fetchUnknownShare: unexpected response shape');
    err.body = body;
    throw err;
  }
  return body.data;
}

/**
 * Promote an `unknown` capture to `food` with a nutrition analysis. Backs
 * both the Retry path (a fresh Gemini analysis) and the Edit path (a
 * user-picked / manually-entered nutrition object). The server re-checks the
 * owner-or-coach permission, so a tampered client cannot promote a capture it
 * may not mutate.
 *
 * @param {Object} params
 * @param {string} params.captureId       captures_table.ID to promote.
 * @param {string} params.viewerUserId    Authenticated session user.
 * @param {Object|string} params.analysisResult  Gemini analysis JSON / object.
 * @param {AbortSignal} [params.signal]   Optional cancellation signal.
 * @returns {Promise<Object>} the promotion result envelope `data`.
 */
export async function promoteUnknownToFood({ captureId, viewerUserId, analysisResult, signal } = {}) {
  if (!captureId) throw new Error('promoteUnknownToFood: captureId required');
  if (!viewerUserId) throw new Error('promoteUnknownToFood: viewerUserId required');
  if (analysisResult == null) throw new Error('promoteUnknownToFood: analysisResult required');

  const url = `${getApiBaseUrl()}/api/background-analysis/captures/retry-promotion`;
  debugLog('[captures] promoteUnknownToFood →', String(captureId));
  const res = await axios.post(
    url,
    {
      captureId: String(captureId),
      viewerUserId: String(viewerUserId),
      analysisResult,
    },
    { signal },
  );
  const body = res?.data;
  if (!body || body.ok !== true) {
    const err = new Error('promoteUnknownToFood: promotion failed');
    err.body = body;
    throw err;
  }
  return body.data;
}

/**
 * 2026-06-09: Soft-delete a capture. Only the owner may delete. Used when
 * users want to remove unwanted unknown captures from their diary feed.
 *
 * @param {Object} params
 * @param {string} params.captureId       captures_table.ID to delete.
 * @param {string} params.userId          Authenticated session user (owner).
 * @param {AbortSignal} [params.signal]   Optional cancellation signal.
 * @returns {Promise<{ deleted: boolean }>} Whether the capture was deleted.
 */
export async function deleteCapture({ captureId, userId, signal } = {}) {
  if (!captureId) throw new Error('deleteCapture: captureId required');
  if (!userId) throw new Error('deleteCapture: userId required');

  const url = `${getApiBaseUrl()}/api/captures/delete`;
  debugLog('[captures] deleteCapture →', String(captureId));
  const res = await axios.delete(url, {
    data: {
      captureId: String(captureId),
      userId: String(userId),
    },
    signal,
  });
  const body = res?.data;
  if (!body || body.ok !== true) {
    const err = new Error('deleteCapture: delete failed');
    err.body = body;
    throw err;
  }
  return body.data;
}

/**
 * 2026-06-09: Restore a soft-deleted capture (undo delete).
 * Sets IsDeleted=0 to bring the capture back into the user's feed.
 *
 * @param {Object} params
 * @param {string} params.captureId       captures_table.ID to restore.
 * @param {string} params.userId          Authenticated session user (must be owner).
 * @param {AbortSignal} [params.signal]   Optional cancellation signal.
 * @returns {Promise<{ restored: boolean }>} Whether the capture was restored.
 */
export async function undoDeleteCapture({ captureId, userId, signal } = {}) {
  if (!captureId) throw new Error('undoDeleteCapture: captureId required');
  if (!userId) throw new Error('undoDeleteCapture: userId required');

  const url = `${getApiBaseUrl()}/api/captures/undo`;
  debugLog('[captures] undoDeleteCapture →', String(captureId));
  const res = await axios.post(
    url,
    {
      captureId: String(captureId),
      userId: String(userId),
    },
    { signal },
  );
  const body = res?.data;
  if (!body || body.ok !== true) {
    const err = new Error('undoDeleteCapture: restore failed');
    err.body = body;
    throw err;
  }
  return body.data;
}
