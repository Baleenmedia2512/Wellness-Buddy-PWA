/**
 * User feature — frontend HTTP layer.
 * Sole place that knows the URL paths for the user-feature endpoints.
 */
import { getApiBaseUrl } from '../../../config/api.config.js';
import { getDeviceTimezoneIana } from '../../../shared/utils/deviceTimezone.js';
import cacheManager from '../../../shared/services/cacheManager.js';

const base = () => getApiBaseUrl();

/**
 * GET /api/user/profile — shared cache + in-flight dedup across Header,
 * NutritionDashboard, WeightDashboard, and nutrition BMR/macro hooks.
 * Pass `cacheBust: true` after a profile save to force a fresh read.
 */
export async function getProfile(email, { cacheBust = false } = {}) {
  if (!email) throw new Error('getProfile: email required');
  const key = cacheManager.generateKey('userProfile', String(email).toLowerCase());
  if (cacheBust) cacheManager.clear(key);

  return cacheManager.execute(
    key,
    async () => {
      const ts = cacheBust ? `&_t=${Date.now()}` : '';
      const res = await fetch(`${base()}/api/user/profile?email=${encodeURIComponent(email)}${ts}`);
      return res.json();
    },
    cacheManager.ttls.userProfile,
  );
}

export async function updateProfile(payload) {
  const res = await fetch(`${base()}/api/user/profile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const email = payload?.email || payload?.Email;
  if (email) {
    cacheManager.clear(cacheManager.generateKey('userProfile', String(email).toLowerCase()));
  }
  return res.json();
}

export async function getContext(userId) {
  const res = await fetch(`${base()}/api/user/context?userId=${encodeURIComponent(userId)}`);
  return res.json();
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
  const res = await fetch(url, init);
  return res.json();
}

export async function saveGoogleUser(payload) {
  const res = await fetch(`${base()}/api/user/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...payload,
      timezoneIana: getDeviceTimezoneIana() ?? '',
    }),
  });
  return res.json();
}

export async function snoozeProfilePic(userId) {
  const res = await fetch(`${base()}/api/user/snooze-pic`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  });
  return res.json();
}

export async function deleteAccount(email) {
  const res = await fetch(`${base()}/api/user/account`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  return res.json();
}

export async function skipSetup(payload) {
  const res = await fetch(`${base()}/api/user/skip-setup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function getStatus(email) {
  const res = await fetch(`${base()}/api/user/status?email=${encodeURIComponent(email)}`);
  return res.json();
}
