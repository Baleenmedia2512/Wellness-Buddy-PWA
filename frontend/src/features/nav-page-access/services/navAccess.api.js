/**
 * Client for /api/nav-access/*
 */
import { getApiBaseUrl } from '../../../config/api.config.js';

function base(apiBaseUrl) {
  return (apiBaseUrl || getApiBaseUrl() || '').replace(/\/$/, '');
}

async function parseJson(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.ok === false) {
    const msg = data?.message || data?.error?.message || `Request failed (${res.status})`;
    const err = new Error(msg);
    err.status = res.status;
    err.body = data;
    throw err;
  }
  return data?.data ?? data;
}

export async function fetchNavAccessForMe({
  requesterUserId,
  requesterEmail,
  apiBaseUrl,
} = {}) {
  const params = new URLSearchParams();
  if (requesterUserId) params.set('requesterUserId', String(requesterUserId));
  if (requesterEmail) params.set('requesterEmail', String(requesterEmail));
  const res = await fetch(
    `${base(apiBaseUrl)}/api/nav-access/for-me?${params.toString()}`,
  );
  return parseJson(res);
}

export async function fetchNavAccessAdminConfig({
  requesterUserId,
  requesterEmail,
  apiBaseUrl,
} = {}) {
  const params = new URLSearchParams();
  if (requesterUserId) params.set('requesterUserId', String(requesterUserId));
  if (requesterEmail) params.set('requesterEmail', String(requesterEmail));
  const res = await fetch(
    `${base(apiBaseUrl)}/api/nav-access/admin-config?${params.toString()}`,
  );
  return parseJson(res);
}

export async function saveNavAccessAdminConfig({
  requesterUserId,
  requesterEmail,
  matrix,
  apiBaseUrl,
} = {}) {
  const res = await fetch(`${base(apiBaseUrl)}/api/nav-access/admin-config`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requesterUserId,
      requesterEmail,
      matrix,
    }),
  });
  return parseJson(res);
}
