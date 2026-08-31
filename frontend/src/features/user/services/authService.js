// Auth REST helpers — OTP send/verify, account deletion.
import * as Session from '../../../shared/services/sessionStorage';
import { getApiBaseUrl } from '../../../config/api.config.js';
import { debugLog } from '../../../shared/utils/logger.js';
import { getDeviceTimezoneIana } from '../../../shared/utils/deviceTimezone.js';
import { apiFetch } from '../../../shared/services/apiFetch.js';
import { handlePossibleAppUpdateRequired } from '../../../shared/services/appVersionEnforce.client.js';

const post = async (path, body) => {
  const apiBase = getApiBaseUrl();
  const payload = body && typeof body === 'object' ? body : {};
  const res = await apiFetch(`${apiBase}${path}`, {
    method: 'POST',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const rawText = await res.text();
  let data = {};
  try {
    data = rawText ? JSON.parse(rawText) : {};
  } catch {
    // Next.js body-parser failures often return plain "Invalid JSON" / HTML,
    // which used to throw here and surface as a generic OTP failure.
    const snippet = String(rawText || '').slice(0, 160);
    // eslint-disable-next-line no-console -- intentional debug for SMS troubleshooting
    console.warn('[OTP/SMS] non-JSON response', {
      apiBase,
      path,
      httpStatus: res.status,
      snippet,
    });
    return {
      success: false,
      message:
        res.status === 400
          ? 'Server rejected the request body (Invalid JSON). Redeploy backend or check API URL.'
          : `Unexpected server response (${res.status}). Please try again.`,
      _httpStatus: res.status,
    };
  }
  handlePossibleAppUpdateRequired(res, data);
  const hasOtpField = Object.prototype.hasOwnProperty.call(data || {}, 'otp');
  const logPayload = {
    apiBase,
    path,
    httpStatus: res.status,
    success: data?.success,
    hasOtpInResponse: hasOtpField,
    message: data?.message || '',
    providerError: data?.providerError || '',
    senderIdHint: data?.senderIdHint || '',
    templateIdHint: data?.templateIdHint || '',
    apiKeyHint: data?.apiKeyHint || '',
    missingConfig: data?.missingConfig || [],
    contactType: payload?.contactType,
  };
  debugLog('[OTP/SMS] send-otp response', logPayload);
  if (!data?.success || hasOtpField) {
    // eslint-disable-next-line no-console -- intentional debug for SMS troubleshooting
    console.warn('[OTP/SMS] send-otp issue — check backend/MDT', logPayload);
  }
  return { ...data, _httpStatus: res.status };
};
export const sendOtp = (recipient, contactType = 'email') =>
  post('/api/auth/send-otp', { recipient, contactType });

export const verifyOtp = (recipient, otp, purpose, contactType = 'email') => {
  const body = {
    recipient,
    otp,
    contactType,
    timezoneIana: getDeviceTimezoneIana() ?? '',
  };
  if (purpose) body.purpose = purpose;
  return post('/api/auth/verify-otp', body);
};

export const deleteAccountRequest = async (email) => {
  const res = await fetch(`${getApiBaseUrl()}/api/user/account`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  return res.json();
};

// Wipe all client-side state after a successful account deletion.
// Sets userSignedOut+accountDeleted flags BEFORE Firebase signOut so that
// onAuthStateChanged cannot silently re-authenticate during the gap.
export const purgeLocalAfterDelete = () => {
  try {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k) keys.push(k);
    }
    keys.forEach((k) => localStorage.removeItem(k));
    Session.markUserSignedOut();
    Session.markAccountDeleted();
    sessionStorage.clear();
    if ('caches' in window) {
      caches.keys().then((names) => names.forEach((n) => caches.delete(n)));
    }
  } catch (err) {
    console.warn('[authService] purgeLocalAfterDelete error:', err);
  }
};
