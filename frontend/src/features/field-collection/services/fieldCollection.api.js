import { apiFetch } from '../../../shared/services/apiFetch.js';

function apiBase(explicit) {
  return explicit || process.env.REACT_APP_API_BASE_URL || '';
}

async function readJson(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) {
    throw new Error(data.message || 'Field collection request failed');
  }
  return data;
}

export async function fetchFieldCollectionPrompts({ userId, apiBaseUrl, defer }) {
  const params = new URLSearchParams({
    userId: String(userId),
    _t: String(Date.now()),
  });
  if (Array.isArray(defer) && defer.length) params.set('defer', defer.join(','));
  const url = `${apiBase(apiBaseUrl)}/api/field-collection/prompts?${params.toString()}`;
  const res = await apiFetch(url, {
    method: 'GET',
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  });
  const data = await readJson(res);
  return data.data;
}

export async function recordFieldCollectionAction({ userId, fieldKey, action, apiBaseUrl }) {
  const res = await apiFetch(`${apiBase(apiBaseUrl)}/api/field-collection/prompts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, fieldKey, action }),
  });
  return readJson(res);
}

export async function fetchFieldCollectionPolicy({ requesterUserId, requesterEmail, apiBaseUrl }) {
  const params = new URLSearchParams();
  if (requesterUserId != null) params.set('requesterUserId', String(requesterUserId));
  if (requesterEmail) params.set('requesterEmail', requesterEmail);
  const res = await apiFetch(
    `${apiBase(apiBaseUrl)}/api/field-collection/policy?${params.toString()}`,
    { method: 'GET', headers: { Accept: 'application/json' } },
  );
  const data = await readJson(res);
  return data.data;
}

export async function saveFieldCollectionPolicy({
  requesterUserId,
  requesterEmail,
  fields,
  apiBaseUrl,
}) {
  const res = await apiFetch(`${apiBase(apiBaseUrl)}/api/field-collection/policy`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requesterUserId, requesterEmail, fields }),
  });
  const data = await readJson(res);
  return data.data;
}
