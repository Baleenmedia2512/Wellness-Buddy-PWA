// Profile REST helpers — fetch, save, snooze profile picture reminder.
const API = process.env.REACT_APP_API_BASE_URL;

const DEMO_ACCOUNTS = ['testereasywork@gmail.com'];
export const isDemoAccount = (email) =>
  DEMO_ACCOUNTS.includes((email || '').toLowerCase().trim());
export const demoStorageKey = (email) => `demo_profile_${email}`;

export const fetchProfile = async (email) => {
  const res = await fetch(
    `${API}/api/user/profile?email=${encodeURIComponent(email)}&_t=${Date.now()}`,
    { cache: 'no-store', headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' } },
  );
  if (!res.ok) throw new Error('Failed to load profile.');
  const data = await res.json();
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
};

export const saveProfile = async (payload) => {
  const res = await fetch(`${API}/api/user/profile`, {
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
    const isDbInternals = /PGRST|JSON object requested|multiple.*rows|no rows returned|relation.*does not exist/i.test(raw);
    throw new Error(isDbInternals ? 'Failed to save profile. Please try again.' : raw || 'Failed to save profile.');
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
      if (payload.profileImage !== undefined) merged.profileImage = payload.profileImage;
      if (payload.weightGoalMode !== undefined) merged.weightGoalMode = payload.weightGoalMode;
      localStorage.setItem(demoStorageKey(payload.email), JSON.stringify(merged));
    } catch { /* ignore */ }
  }
  return data;
};

export const snoozeProfilePicture = async (userId) => {
  const res = await fetch(`${API}/api/user/snooze-pic`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  });
  return res.json();
};
