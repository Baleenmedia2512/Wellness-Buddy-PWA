/**
 * frontend/src/features/diary/api/diaryClient.js
 *
 * Thin axios wrapper around GET /api/diary/list (PR-B / ADR-0003).
 *
 * Per claude.md §2.1 this is the ONLY file in the feature allowed to
 * talk to the network. Hooks compose it; presentation components stay
 * I/O-free.
 */

import axios from 'axios';
import { getApiBaseUrl } from '../../../config/api.config';
import { debugLog } from '../../../shared/utils/logger';

/**
 * Fetch the diary feed for one owner + one IST day.
 *
 * @param {Object} params
 * @param {string} params.ownerUserId   the diary subject (owner)
 * @param {string} params.viewerUserId  the authenticated session user
 * @param {string} params.date          YYYY-MM-DD in IST
 * @param {AbortSignal} [params.signal] optional cancellation signal
 * @returns {Promise<{
 *   date: string,
 *   ownerUserId: string,
 *   isSelf: boolean,
 *   includesUnknown: boolean,
 *   entries: Array<{ kind, capturedAt, capture, payload }>,
 * }>}
 *
 * @throws Error on 401/403/404/500. Callers should catch and surface
 *         `err.response?.status` to the UI.
 */
export async function fetchDiary({ ownerUserId, viewerUserId, date, signal } = {}) {
  if (!ownerUserId)  throw new Error('fetchDiary: ownerUserId required');
  if (!viewerUserId) throw new Error('fetchDiary: viewerUserId required');
  if (!date)         throw new Error('fetchDiary: date required (YYYY-MM-DD)');

  const url = `${getApiBaseUrl()}/api/diary/list`;
  const params = {
    ownerUserId: String(ownerUserId),
    viewerUserId: String(viewerUserId),
    date,
  };

  debugLog('[diary] fetchDiary →', params);
  const res = await axios.get(url, { params, signal });
  // Backend envelope: { ok: true, data: {...} }. We unwrap to data so
  // the hook stays focused on UI state, not transport plumbing.
  const body = res?.data;
  if (!body || body.ok !== true || !body.data) {
    const err = new Error('fetchDiary: unexpected response shape');
    err.body = body;
    throw err;
  }
  return body.data;
}
