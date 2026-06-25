/**
 * Screen feature — HTTP layer (frontend).
 * The ONLY place allowed to call /api/screen/*.
 */
import { getApiBaseUrl } from '../../../config/api.config.js';

async function request(path, opts = {}) {
  const res = await fetch(`${getApiBaseUrl()}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
  let data = null;
  try { data = await res.json(); } catch { /* tolerate */ }
  return { ok: res.ok, status: res.status, data };
}

export function saveScreenTime({ userId, date, totalScreenTimeSeconds }) {
  return request('/api/screen/save', {
    method: 'POST',
    body: JSON.stringify({ userId, date, totalScreenTimeSeconds }),
  });
}

export function getScreenTimeHistory(userId, days = 7, targetDate = null) {
  const params = new URLSearchParams({ userId: String(userId), days: String(days) });
  if (targetDate) params.set('targetDate', targetDate);
  return request(`/api/screen/history?${params.toString()}`, {
    method: 'GET',
    headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
  });
}
