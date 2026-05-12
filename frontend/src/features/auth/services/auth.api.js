import { getApiBaseUrl } from '../../../config/api.config.js';

const base = () => getApiBaseUrl();

export async function sendOtp({ recipient, contactType }) {
  const res = await fetch(`${base()}/api/auth/send-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipient, contactType }),
  });
  return res.json();
}

export async function verifyOtp({ recipient, otp, contactType, purpose }) {
  const res = await fetch(`${base()}/api/auth/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipient, otp, contactType, purpose }),
  });
  return res.json();
}
