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

function profileCacheKeyEmail(email) {
  if (!email) return null;
  return cacheManager.generateKey('userProfile', String(email).toLowerCase());
}

function profileCacheKeyUserId(userId) {
  if (userId == null || userId === '') return null;
  return cacheManager.generateKey('userProfile', `id:${userId}`);
}

/** Ordered cache keys for a profile lookup (id + email share the same payload). */
function profileCacheKeys({ email, userId } = {}) {
  return [profileCacheKeyUserId(userId), profileCacheKeyEmail(email)].filter(Boolean);
}

/** Sync read of the shared getProfile cache — null when missing or expired. */
export function getCachedProfile(emailOrOpts) {
  let email;
  let userId;
  if (emailOrOpts && typeof emailOrOpts === 'object' && !Array.isArray(emailOrOpts)) {
    ({ email, userId } = emailOrOpts);
  } else {
    email = emailOrOpts;
  }
  for (const key of profileCacheKeys({ email, userId })) {
    const hit = cacheManager.get(key, cacheManager.ttls.userProfile);
    if (hit !== null) return hit;
  }
  return null;
}

/** Write the same profile payload under email and userId keys so Header/Profile share cache. */
function mirrorProfileCache(data, { email, userId } = {}) {
  if (!data) return;
  const responseEmail = data?.data?.email || email;
  const responseUserId = data?.data?.userId ?? data?.data?.UserId ?? userId;
  for (const key of profileCacheKeys({ email: responseEmail, userId: responseUserId })) {
    cacheManager.set(key, data);
  }
}

/** Invalidate cached profile reads (e.g. after consent acceptance). */
export function clearProfileCache({ email, userId } = {}) {
  for (const key of profileCacheKeys({ email, userId })) {
    cacheManager.clear(key);
  }
}

/**
 * GET /api/user/profile — shared cache + in-flight dedup across Header,
 * NutritionDashboard, WeightDashboard, and nutrition BMR/macro hooks.
 * Pass `cacheBust: true` after a profile save to force a fresh read.
 * Accepts email string (legacy) or `{ email, userId, cacheBust, signal }`.
 *
 * Email and userId keys are mirrored so Home (email) and My Profile (userId)
 * reuse the same cached payload instead of refetching on every open.
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
  const keys = profileCacheKeys({ email, userId });
  // Prefer email key for in-flight dedup when present (Header / nutrition share it).
  // userId key is checked for hits and mirrored after fetch for Profile opens.
  const primaryKey = profileCacheKeyEmail(email) || profileCacheKeyUserId(userId);

  if (cacheBust) {
    keys.forEach((key) => cacheManager.clear(key));
  } else {
    // Hit either key — Header often caches by email while Profile loads by userId.
    for (const key of keys) {
      const hit = cacheManager.get(key, cacheManager.ttls.userProfile);
      if (hit !== null) return hit;
    }
    // Share in-flight work across email/id keys (Header + Profile opening together).
    for (const key of keys) {
      const pending = cacheManager.getPending(key);
      if (pending) return pending;
    }
  }

  return cacheManager.execute(
    primaryKey,
    async () => {
      const ts = cacheBust ? `&_t=${Date.now()}` : '';
      // Prefer userId for the network read when both exist (signed-in row).
      const qs = (userId != null && userId !== '')
        ? `userId=${encodeURIComponent(String(userId))}`
        : `email=${encodeURIComponent(email)}`;
      const res = await apiFetch(
        `${base()}/api/user/profile?${qs}${ts}`,
        signal ? { signal } : undefined,
      );
      const data = await res.json();
      handlePossibleAppUpdateRequired(res, data);
      if (data?.success && data?.data) {
        syncMarathonWeightComparisonFromProfile(data.data);
        mirrorProfileCache(data, { email, userId });
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

export async function deleteAccount({ userId, confirmPhrase = 'DELETE', email } = {}) {
  const body = {};
  if (userId != null && String(userId).trim() !== '') {
    body.userId = userId;
    body.confirmPhrase = confirmPhrase;
  } else if (email) {
    body.email = email;
  } else {
    throw new Error('userId is required to delete account.');
  }
  const res = await apiFetch(`${base()}/api/user/account`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
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
