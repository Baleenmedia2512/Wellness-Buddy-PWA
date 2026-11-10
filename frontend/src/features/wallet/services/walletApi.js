import { apiFetch } from '../../../shared/services/apiFetch.js';

async function readJson(response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.ok === false) {
    const message = body?.error?.message || body?.message || body?.error || 'Wallet request failed';
    const err = new Error(typeof message === 'string' ? message : 'Wallet request failed');
    err.code = body?.error?.code || '';
    throw err;
  }
  return body?.data || body;
}

export async function fetchWallet(userId) {
  const response = await apiFetch(
    `/api/wallet?userId=${encodeURIComponent(userId)}`,
    { method: 'GET', cache: 'no-store' },
  );
  return readJson(response);
}

export async function searchWalletPeople({ userId, q }) {
  const response = await apiFetch(
    `/api/wallet/people?userId=${encodeURIComponent(userId)}&q=${encodeURIComponent(q)}`,
    { method: 'GET', cache: 'no-store' },
  );
  const data = await readJson(response);
  return Array.isArray(data?.people) ? data.people : [];
}

export async function requestWalletCash({ userId, amount, approverUserId }) {
  const response = await apiFetch('/api/wallet/request-cash', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, amount, approverUserId }),
  });
  return readJson(response);
}

export async function verifyWalletOtp({ userId, otp }) {
  const response = await apiFetch('/api/wallet/verify-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, otp }),
  });
  return readJson(response);
}

export async function cancelWalletRequest({ userId }) {
  const response = await apiFetch('/api/wallet/cancel-request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  });
  return readJson(response);
}
