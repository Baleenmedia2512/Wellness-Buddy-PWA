import { getApiBaseUrl } from '../../../config/api.config.js';
import { buildClientDeviceInfo, CURRENT_CONSENT_VERSION } from '../domain/consent.js';

export async function fetchConsentStatus({ userId, email }) {
  const params = new URLSearchParams();
  if (userId) params.set('userId', String(userId));
  if (email) params.set('email', String(email));
  const res = await fetch(`${getApiBaseUrl()}/api/user/consent?${params.toString()}`, {
    method: 'GET',
    cache: 'no-store',
    headers: { 'Cache-Control': 'no-cache' },
  });
  const data = await res.json().catch(() => ({}));
  return {
    ok: res.ok && data?.success === true,
    consentRequired: data?.consentRequired === true,
    consentAccepted: data?.consentAccepted === true,
    data,
  };
}

export async function recordConsentAcceptance({ userId, email }) {
  const res = await fetch(`${getApiBaseUrl()}/api/user/consent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: userId || undefined,
      email: email || undefined,
      consentAccepted: true,
      consentVersion: CURRENT_CONSENT_VERSION,
      deviceInfo: buildClientDeviceInfo(),
    }),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok && data?.success === true, status: res.status, data };
}

/** Decline: remove account that never accepted consent (new users). */
export async function discardUnconsentedUser({ userId, email }) {
  const res = await fetch(`${getApiBaseUrl()}/api/user/consent`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: userId || undefined,
      email: email || undefined,
    }),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok && data?.success === true, status: res.status, data };
}
