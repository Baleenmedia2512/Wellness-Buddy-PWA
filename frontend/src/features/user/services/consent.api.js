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
  try {
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
  } catch (err) {
    return {
      ok: false,
      status: 0,
      data: {
        message:
          err?.message === 'Failed to fetch'
            || /Failed to fetch|NetworkError|Load failed/i.test(String(err?.message || ''))
            ? 'Cannot reach the server. Check that the backend is running and REACT_APP_API_BASE_URL is correct.'
            : (err?.message || 'Could not save your consent. Please try again.'),
      },
    };
  }
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
