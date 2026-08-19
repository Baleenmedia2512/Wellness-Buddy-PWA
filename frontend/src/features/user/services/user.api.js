/**
 * User feature — frontend HTTP layer.
 * Sole place that knows the URL paths for the user-feature endpoints.
 */
import { getApiBaseUrl } from '../../../config/api.config.js';
import { getDeviceTimezoneIana } from '../../../shared/utils/deviceTimezone.js';
import cacheManager from '../../../shared/services/cacheManager.js';
import { apiFetch } from '../../../shared/services/apiFetch.js';
import { handlePossibleAppUpdateRequired } from '../../../shared/services/appVersionEnforce.client.js';

const base = () => getApiBaseUrl();

/**
 * GET /api/user/profile — shared cache + in-flight dedup across Header,
 * NutritionDashboard, WeightDashboard, and nutrition BMR/macro hooks.
 * Pass `cacheBust: true` after a profile save to force a fresh read.
 */
export async function getProfile(email, { cacheBust = false, signal } = {}) {
  if (!email) throw new Error('getProfile: email required');
  const key = cacheManager.generateKey('userProfile', String(email).toLowerCase());
  if (cacheBust) cacheManager.clear(key);

  return cacheManager.execute(
    key,
    async () => {
      const ts = cacheBust ? `&_t=${Date.now()}` : '';
      const res = await apiFetch(
        `${base()}/api/user/profile?email=${encodeURIComponent(email)}${ts}`,
        signal ? { signal } : undefined,
      );
      const data = await res.json();
      handlePossibleAppUpdateRequired(res, data);
      return data;
    },
    cacheManager.ttls.userProfile,
  );
}

export async function updateProfile(payload) {
  const res = await apiFetch(`${base()}/api/user/profile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const email = payload?.email || payload?.Email;
  if (email) {
    cacheManager.clear(cacheManager.generateKey('userProfile', String(email).toLowerCase()));
  }
  const data = await res.json();
  handlePossibleAppUpdateRequired(res, data);
  return data;
}

export async function getContext(userId) {
  const res = await apiFetch(`${base()}/api/user/context?userId=${encodeURIComponent(userId)}`);
  const data = await res.json();
  handlePossibleAppUpdateRequired(res, data);
  return data;
}

export async function lookup(email, { method = 'POST' } = {}) {
  const timezoneIana = getDeviceTimezoneIana() ?? '';
  const url = method === 'GET'
    ? `${base()}/api/user/lookup?email=${encodeURIComponent(email)}&timezoneIana=${encodeURIComponent(timezoneIana)}`
    : `${base()}/api/user/lookup`;
  const init = method === 'GET'
    ? {}
    : {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, timezoneIana }),
    };
  const res = await apiFetch(url, init);
  const data = await res.json();
  handlePossibleAppUpdateRequired(res, data);
  return data;
}

export async function saveGoogleUser(payload) {
  const res = await apiFetch(`${base()}/api/user/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...payload,
      timezoneIana: getDeviceTimezoneIana() ?? '',
    }),
  });
  const data = await res.json();
  handlePossibleAppUpdateRequired(res, data);
  return data;
}

export async function snoozeProfilePic(userId) {
  const res = await apiFetch(`${base()}/api/user/snooze-pic`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  });
  return res.json();
}

export async function deleteAccount(email) {
  const res = await apiFetch(`${base()}/api/user/account`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  return res.json();
}

export async function skipSetup(payload) {
  const res = await apiFetch(`${base()}/api/user/skip-setup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function getStatus(email) {
  const res = await apiFetch(`${base()}/api/user/status?email=${encodeURIComponent(email)}`);
  const data = await res.json();
  handlePossibleAppUpdateRequired(res, data);
  return data;
}
