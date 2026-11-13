import { apiFetch } from '../../../shared/services/apiFetch.js';

async function readJson(response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body?.ok) {
    const message = body?.error?.message || body?.message || 'Request failed';
    throw new Error(message);
  }
  return body.data;
}

export async function fetchGbpMine(userId) {
  const params = new URLSearchParams({ userId: String(userId) });
  const response = await apiFetch(`/api/gbp-listing/mine?${params.toString()}`);
  return readJson(response);
}

/** Exact address for an owned center (GPS → Nominatim). */
export async function fetchGbpCenterPlace({ userId, centerId }) {
  const params = new URLSearchParams({
    userId: String(userId),
    centerId: String(centerId),
  });
  const response = await apiFetch(`/api/gbp-listing/center-place?${params.toString()}`);
  return readJson(response);
}

export async function saveGbpDraft({ userId, centerId, fields }) {
  const response = await apiFetch('/api/gbp-listing/draft', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, centerId, fields }),
  });
  return readJson(response);
}

export async function uploadGbpMedia({ userId, requestId, file }) {
  const body = new FormData();
  body.append('userId', String(userId));
  body.append('requestId', String(requestId));
  body.append('file', file);
  const response = await apiFetch('/api/gbp-listing/media', {
    method: 'POST',
    body,
  });
  return readJson(response);
}

export async function submitGbpRequest({ userId, requestId }) {
  const response = await apiFetch('/api/gbp-listing/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, requestId }),
  });
  return readJson(response);
}

export async function fetchAdminGbpList({ requesterUserId, status = '' }) {
  const params = new URLSearchParams({ requesterUserId: String(requesterUserId) });
  if (status) params.set('status', status);
  const response = await apiFetch(`/api/gbp-listing/admin?${params.toString()}`);
  return readJson(response);
}

export async function fetchAdminGbpDetail({ requesterUserId, requestId }) {
  const params = new URLSearchParams({
    requesterUserId: String(requesterUserId),
    requestId: String(requestId),
  });
  const response = await apiFetch(`/api/gbp-listing/admin?${params.toString()}`);
  return readJson(response);
}

export async function patchAdminGbpRequest({
  requesterUserId,
  requestId,
  status,
  mapsUrl,
  opsNote,
}) {
  const response = await apiFetch('/api/gbp-listing/admin', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requesterUserId,
      requestId,
      status,
      mapsUrl,
      opsNote,
    }),
  });
  return readJson(response);
}
