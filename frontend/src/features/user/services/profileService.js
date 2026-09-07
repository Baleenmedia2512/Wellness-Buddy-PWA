// Profile REST helpers — fetch, save, snooze profile picture reminder.
import { getApiBaseUrl } from '../../../config/api.config.js';
import { getProfile } from './user.api.js';
import cacheManager from '../../../shared/services/cacheManager.js';
import { apiFetch } from '../../../shared/services/apiFetch.js';

const DEMO_ACCOUNTS = ['testereasywork@gmail.com'];
export const isDemoAccount = (email) =>
  DEMO_ACCOUNTS.includes((email || '').toLowerCase().trim());
export const demoStorageKey = (email) => `demo_profile_${email}`;

function clearProfileCaches({ email, userId } = {}) {
  if (email) {
    cacheManager.clear(cacheManager.generateKey('userProfile', String(email).toLowerCase()));
  }
  if (userId != null && String(userId).trim() !== '') {
    cacheManager.clear(cacheManager.generateKey('userProfile', `id:${userId}`));
  }
}

export const fetchProfile = async (emailOrUserId) => {
  try {
    const opts = typeof emailOrUserId === 'object' && emailOrUserId != null
      ? emailOrUserId
      : (String(emailOrUserId || '').includes('@')
        ? { email: emailOrUserId }
        : { userId: emailOrUserId });
    const email = opts.email;
    // Shared getProfile cache/dedup — avoids parallel Home profile storms.
    const data = await getProfile(opts);
    // Demo accounts: API returns top-level fields with no `data` wrapper.
    if (data.success && !data.data && isDemoAccount(email)) {
      const stored = localStorage.getItem(demoStorageKey(email));
      if (stored) {
        try { return { success: true, data: JSON.parse(stored), demo: true }; }
        catch { /* fall through */ }
      }
      return { success: true, data: null, demo: true };
    }
    return data;
  } catch (err) {
    throw err instanceof Error ? err : new Error('Failed to load profile.');
  }
};

/**
 * Attach display name (and optional email) for phone-OTP / BCM users.
 * POST /api/user/save-email — email may be omitted; name is required.
 */
export const saveEmailIdentity = async ({ userId, email, name }) => {
  const apiBase = getApiBaseUrl();
  const body = { userId, name };
  if (email) body.email = email;
  const res = await apiFetch(`${apiBase}/api/user/save-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    throw new Error(data.message || 'Failed to save. Please try again.');
  }
  if (userId != null && userId !== '') {
    cacheManager.clear(cacheManager.generateKey('userProfile', `id:${userId}`));
  }
  if (email) {
    cacheManager.clear(cacheManager.generateKey('userProfile', String(email).toLowerCase()));
  }
  return data;
};

export const saveProfile = async (payload) => {
  const apiBase = getApiBaseUrl();
  const res = await apiFetch(`${apiBase}/api/user/profile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const ct = res.headers.get('content-type');
  if (!ct || !ct.includes('application/json')) {
    throw new Error('Server returned an error. Please try with a smaller image.');
  }
  const data = await res.json();
  if (!res.ok || !data.success) {
    // Never surface raw Supabase / PostgREST error strings to the user.
    const raw = data.message || '';
    const isDbInternals = /PGRST|JSON object requested|multiple.*rows|no rows returned|relation.*does not exist|violates check constraint|check constraint/i.test(raw);
    throw new Error(isDbInternals ? 'Failed to save profile. Please try again.' : raw || 'Failed to save profile.');
  }
  if (payload?.email || payload?.userId) {
    clearProfileCaches({ email: payload.email, userId: payload.userId });
  }
  // Persist demo-account profiles locally since backend skips demo writes.
  if (isDemoAccount(payload.email)) {
    try {
      const existing = JSON.parse(localStorage.getItem(demoStorageKey(payload.email)) || '{}');
      const merged = { ...existing };
      if (payload.name !== undefined) merged.userName = payload.name;
      if (payload.height !== undefined) merged.height = payload.height;
      if (payload.bmr !== undefined) merged.latestBmr = payload.bmr;
      if (payload.dietType !== undefined) merged.dietType = payload.dietType;
      if (payload.phoneNumber !== undefined) merged.phoneNumber = payload.phoneNumber;
      if (payload.gender !== undefined) merged.gender = payload.gender;
      if (payload.profileImage !== undefined) merged.profileImage = payload.profileImage;
      if (payload.physicalActivityLevel !== undefined) merged.physicalActivityLevel = payload.physicalActivityLevel;
      if (payload.communityId !== undefined) merged.communityId = payload.communityId;
      if (payload.bodyFat !== undefined) merged.bodyFat = payload.bodyFat;
      localStorage.setItem(demoStorageKey(payload.email), JSON.stringify(merged));
    } catch { /* ignore */ }
  }
  return data;
};

export const snoozeProfilePicture = async (userId) => {
  const res = await fetch(`${getApiBaseUrl()}/api/user/snooze-pic`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  });
  return res.json();
};
