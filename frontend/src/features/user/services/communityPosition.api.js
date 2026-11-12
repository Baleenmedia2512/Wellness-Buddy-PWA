/**
 * Community Position catalog + coach OTP.
 */
import { getApiBaseUrl } from '../../../config/api.config.js';
import { apiFetch } from '../../../shared/services/apiFetch.js';

function base() {
  return (getApiBaseUrl() || '').replace(/\/$/, '');
}

async function parse(res, fallback) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.success === false) {
    throw new Error(data?.message || data?.error || fallback);
  }
  return data;
}

export async function listCommunityPositions() {
  const res = await apiFetch(`${base()}/api/user/community-positions`);
  const data = await parse(res, 'Could not load community positions.');
  return Array.isArray(data.positions) ? data.positions : [];
}

export async function requestCommunityPosition({ userId, email, positionCode }) {
  const res = await apiFetch(`${base()}/api/user/community-position/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, email, positionCode }),
  });
  return parse(res, 'Could not send the approval request.');
}

export async function verifyCommunityPositionOtp({ userId, email, otp }) {
  const res = await apiFetch(`${base()}/api/user/community-position/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, email, otp }),
  });
  return parse(res, 'That approval code did not match.');
}
