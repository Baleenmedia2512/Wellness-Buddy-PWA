/**
 * Weight feature — HTTP layer.
 * The ONLY place in the frontend allowed to call /api/weight/*.
 * Components and hooks must import from here.
 */
import { getApiBaseUrl } from '../../../config/api.config.js';

async function request(path, opts = {}) {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
  let json = null;
  try { json = await res.json(); } catch { /* tolerate empty body */ }
  return { ok: res.ok, status: res.status, data: json };
}

export function saveWeight(payload) {
  return request('/api/weight/save', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function getWeightHistory(userId, { includeImage = false, cacheBust = true } = {}) {
  const params = new URLSearchParams({ userId, includeImage: String(includeImage) });
  if (cacheBust) params.set('_t', String(Date.now()));
  return request(`/api/weight/history?${params.toString()}`, {
    method: 'GET',
    headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
  });
}

export function deleteWeight({ userId, entryId }) {
  return request('/api/weight/delete', {
    method: 'DELETE',
    body: JSON.stringify({ userId, entryId }),
  });
}

export function undoDeleteWeight({ id, userId }) {
  return request('/api/weight/undo', {
    method: 'POST',
    body: JSON.stringify({ id, userId }),
  });
}
