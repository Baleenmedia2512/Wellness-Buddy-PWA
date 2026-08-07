// Profile REST helpers — fetch, save, snooze profile picture reminder.
import { getApiBaseUrl } from '../../../config/api.config.js';
import { getProfile } from './user.api.js';
import cacheManager from '../../../shared/services/cacheManager.js';

const DEMO_ACCOUNTS = ['testereasywork@gmail.com'];
export const isDemoAccount = (email) =>
  DEMO_ACCOUNTS.includes((email || '').toLowerCase().trim());
export const demoStorageKey = (email) => `demo_profile_${email}`;

export const fetchProfile = async (email) => {
  try {
    // Shared getProfile cache/dedup — avoids parallel Home profile storms.
    const data = await getProfile(email);
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

export const saveProfile = async (payload) => {
  const apiBase = getApiBaseUrl();
  const res = await fetch(`${apiBase}/api/user/profile`, {
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
  if (payload?.email) {
    cacheManager.clear(cacheManager.generateKey('userProfile', String(payload.email).toLowerCase()));
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
