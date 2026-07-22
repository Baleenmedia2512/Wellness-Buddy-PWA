// Profile email change — request OTP and confirm after verification.
const API = process.env.REACT_APP_API_BASE_URL;

const post = async (path, body) => {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.message || 'Request failed.');
  }
  return data;
};

export const normalizeProfileEmail = (value) =>
  String(value || '').trim().toLowerCase();

export const isValidProfileEmail = (value) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeProfileEmail(value));

export const requestEmailChange = ({ userId, currentEmail, newEmail }) =>
  post('/api/user/request-email-change', { userId, currentEmail, newEmail });

export const confirmEmailChange = ({ userId, currentEmail, newEmail }) =>
  post('/api/user/change-email', { userId, currentEmail, newEmail });
