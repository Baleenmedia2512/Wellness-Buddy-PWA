import { getApiBaseUrl } from '../../../config/api.config.js';

const base = (apiBaseUrl) => apiBaseUrl || getApiBaseUrl();

async function readJsonResponse(res) {
  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(payload?.message || payload?.error || 'Request failed');
  }
  return payload;
}

export async function fetchDailyWellnessScore({ userId, date, apiBaseUrl }) {
  const params = new URLSearchParams({ userId });
  if (date) params.set('date', date);

  const res = await fetch(`${base(apiBaseUrl)}/api/wellness-score/daily?${params.toString()}`);
  const payload = await readJsonResponse(res);
  return payload?.data ?? payload;
}

export async function fetchWellnessScoreAdminConfig({ requesterUserId, apiBaseUrl }) {
  const params = new URLSearchParams({ requesterUserId });
  const res = await fetch(`${base(apiBaseUrl)}/api/wellness-score/admin-config?${params.toString()}`);
  const payload = await readJsonResponse(res);
  return payload?.data ?? payload;
}

export async function saveWellnessScoreAdminConfig({ requesterUserId, parameters, apiBaseUrl }) {
  const res = await fetch(`${base(apiBaseUrl)}/api/wellness-score/admin-config`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requesterUserId, parameters }),
  });
  const payload = await readJsonResponse(res);
  return payload?.data ?? payload;
}
