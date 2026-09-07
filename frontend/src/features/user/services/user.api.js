/**
 * User feature — frontend HTTP layer.
 * Sole place that knows the URL paths for the user-feature endpoints.
 */
import { getApiBaseUrl } from '../../../config/api.config.js';
import { getDeviceTimezoneIana } from '../../../shared/utils/deviceTimezone.js';
import cacheManager from '../../../shared/services/cacheManager.js';
import { apiFetch } from '../../../shared/services/apiFetch.js';
import { handlePossibleAppUpdateRequired } from '../../../shared/services/appVersionEnforce.client.js';
import { syncMarathonWeightComparisonFromProfile } from '../../marathon/marathonWeightComparisonCache.js';

const base = () => getApiBaseUrl();

/** Sync read of the shared getProfile cache — null when missing or expired. */
export function getCachedProfile(email) {
  if (!email) return null;
  const key = cacheManager.generateKey('userProfile', String(email).toLowerCase());
  return cacheManager.get(key, cacheManager.ttls.userProfile);
}

/**
 * GET /api/user/profile — shared cache + in-flight dedup across Header,
 * NutritionDashboard, WeightDashboard, and nutrition BMR/macro hooks.
 * Pass `cacheBust: true` after a profile save to force a fresh read.
 * Accepts email string (legacy) or `{ email, userId, cacheBust, signal }`.
 */
export async function getProfile(emailOrOpts, maybeOpts = {}) {
  let email;
  let userId;
  let cacheBust = false;
  let signal;
  if (emailOrOpts && typeof emailOrOpts === 'object' && !Array.isArray(emailOrOpts)) {
    ({ email, userId, cacheBust = false, signal } = emailOrOpts);
  } else {
    email = emailOrOpts;
    ({ cacheBust = false, signal } = maybeOpts);
  }
  if (!email && (userId == null || userId === '')) {
    throw new Error('getProfile: email or userId required');
  }
  const key = email
    ? cacheManager.generateKey('userProfile', String(email).toLowerCase())
    : cacheManager.generateKey('userProfile', `id:${userId}`);
  if (cacheBust) cacheManager.clear(key);

  return cacheManager.execute(
    key,
    async () => {
      const ts = cacheBust ? `&_t=${Date.now()}` : '';
      const qs = email
        ? `email=${encodeURIComponent(email)}`
        : `userId=${encodeURIComponent(String(userId))}`;
      const res = await apiFetch(
        `${base()}/api/user/profile?${qs}${ts}`,
        signal ? { signal } : undefined,
      );
      const data = await res.json();
      handlePossibleAppUpdateRequired(res, data);
      if (data?.success && data?.data) {
        syncMarathonWeightComparisonFromProfile(data.data);
      }
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

/** GET /api/user/status — pass email string (legacy) or { email, userId }. */
export async function getStatus(emailOrOpts) {
  const opts = typeof emailOrOpts === 'string'
    ? { email: emailOrOpts }
    : (emailOrOpts || {});
  const { email, userId } = opts;
  const qs = email
    ? `email=${encodeURIComponent(email)}`
    : `userId=${encodeURIComponent(String(userId))}`;
  const res = await apiFetch(`${base()}/api/user/status?${qs}`);
  const data = await res.json();
  handlePossibleAppUpdateRequired(res, data);
  return data;
}
