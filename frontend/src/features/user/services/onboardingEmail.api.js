/**
 * Phone onboarding email check + OTP verify (ownership / recover-account).
 */
import { getApiBaseUrl } from '../../../config/api.config.js';
import { apiFetch } from '../../../shared/services/apiFetch.js';
import { handlePossibleAppUpdateRequired } from '../../../shared/services/appVersionEnforce.client.js';

const base = () => getApiBaseUrl();

async function postJson(path, body) {
  const res = await apiFetch(`${base()}${path}`, {
    method: 'POST',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  handlePossibleAppUpdateRequired(res, data);
  return { ok: res.ok, status: res.status, data };
}

export async function checkOnboardingEmail({ userId, email, sendOtp = false }) {
  return postJson('/api/user/check-onboarding-email', {
    userId,
    email,
    sendOtp: sendOtp === true,
  });
}

export async function verifyOnboardingEmail({ userId, email, otp, name, adoptExisting }) {
  return postJson('/api/user/verify-onboarding-email', {
    userId,
    email,
    otp,
    name,
    adoptExisting: adoptExisting === true,
  });
}
