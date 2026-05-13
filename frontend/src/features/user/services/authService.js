// Auth REST helpers — OTP send/verify, account deletion.
const API = process.env.REACT_APP_API_BASE_URL;

const post = async (path, body) => {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
};

export const sendOtp = (recipient) =>
  post('/api/auth/send-otp', { recipient, contactType: 'email' });

export const verifyOtp = (recipient, otp, purpose) => {
  const body = { recipient, otp, contactType: 'email' };
  if (purpose) body.purpose = purpose;
  return post('/api/auth/verify-otp', body);
};

export const deleteAccountRequest = async (email) => {
  const res = await fetch(`${API}/api/user/account`, {
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
    localStorage.setItem('userSignedOut', 'true');
    localStorage.setItem('accountDeleted', 'true');
    sessionStorage.clear();
    if ('caches' in window) {
      caches.keys().then((names) => names.forEach((n) => caches.delete(n)));
    }
  } catch (err) {
    console.warn('[authService] purgeLocalAfterDelete error:', err);
  }
};
