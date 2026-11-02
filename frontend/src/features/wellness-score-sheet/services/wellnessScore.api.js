import { getApiBaseUrl } from '../../../config/api.config.js';
import { getLatestActivityLogId } from '../../../shared/services/homeDashboardActivity';
import {
  dedupeWellnessScoreInflight,
  wellnessScoreInflightKey,
} from './wellnessScoreInflight';

export { __resetWellnessScoreApiInFlightForTests } from './wellnessScoreInflight';

const base = (apiBaseUrl) => apiBaseUrl || getApiBaseUrl();

async function readJsonResponse(res) {
  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(payload?.message || payload?.error || 'Request failed');
  }
  return payload;
}

async function fetchDailyWellnessScoreOnce({ userId, date, apiBaseUrl }) {
  const params = new URLSearchParams({ userId, _t: String(Date.now()) });
  if (date) params.set('date', date);

  const res = await fetch(`${base(apiBaseUrl)}/api/wellness-score/daily?${params.toString()}`, {
    cache: 'no-store',
    headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
  });
  const payload = await readJsonResponse(res);
  return payload?.data ?? payload;
}

async function fetchWellnessScoreHistoryOnce({ userId, startDate, endDate, apiBaseUrl }) {
  const params = new URLSearchParams({
    userId,
    startDate,
    endDate,
    _t: String(Date.now()),
  });
  const res = await fetch(`${base(apiBaseUrl)}/api/wellness-score/history?${params.toString()}`, {
    cache: 'no-store',
    headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
  });
  const payload = await readJsonResponse(res);
  return payload?.data ?? payload;
}

/**
 * Concurrent Home + sheet + StrictMode callers share one /daily for the same
 * user/date/activity watermark so a slower stale response cannot win.
 */
export function fetchDailyWellnessScore({ userId, date, apiBaseUrl }) {
  const key = wellnessScoreInflightKey('daily', [userId, date || '', apiBaseUrl || ''], getLatestActivityLogId());
  return dedupeWellnessScoreInflight(key, () => fetchDailyWellnessScoreOnce({ userId, date, apiBaseUrl }));
}

export function fetchWellnessScoreHistory({ userId, startDate, endDate, apiBaseUrl }) {
  const key = wellnessScoreInflightKey('history', [userId, startDate || '', endDate || '', apiBaseUrl || ''], getLatestActivityLogId());
  return dedupeWellnessScoreInflight(key, () => fetchWellnessScoreHistoryOnce({
    userId,
    startDate,
    endDate,
    apiBaseUrl,
  }));
}

export async function fetchWellnessScoreAdminConfig({ requesterUserId, requesterEmail, apiBaseUrl }) {
  const params = new URLSearchParams();
  if (requesterUserId != null && requesterUserId !== '') {
    params.set('requesterUserId', String(requesterUserId));
  }
  if (requesterEmail) params.set('requesterEmail', requesterEmail);
  const res = await fetch(`${base(apiBaseUrl)}/api/wellness-score/admin-config?${params.toString()}`);
  const payload = await readJsonResponse(res);
  return payload?.data ?? payload;
}

export async function saveWellnessScoreAdminConfig({
  requesterUserId,
  requesterEmail,
  parameters,
  apiBaseUrl,
}) {
  const res = await fetch(`${base(apiBaseUrl)}/api/wellness-score/admin-config`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requesterUserId, requesterEmail, parameters }),
  });
  const payload = await readJsonResponse(res);
  return payload?.data ?? payload;
}
