/**
 * User feature — HTTP service layer.
 */
import { getApiBaseUrl } from '../../../config/api.config.js';

const base = () => getApiBaseUrl();

async function jsonFetch(url, opts = {}) {
  const res = await fetch(url, opts);
  let data = null;
  try { data = await res.json(); } catch { /* may be empty */ }
  return { ok: res.ok, status: res.status, data };
}

export async function lookupUserId(email) {
  return jsonFetch(`${base()}/api/user/lookup?email=${encodeURIComponent(email)}`);
}

export async function getUserProfile(email, { cacheBust = false } = {}) {
  const url = `${base()}/api/user/profile?email=${encodeURIComponent(email)}` + (cacheBust ? `&_t=${Date.now()}` : '');
  return jsonFetch(url);
}

export async function updateUserProfile(payload) {
  return jsonFetch(`${base()}/api/user/profile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function getUserContext(userId) {
  return jsonFetch(`${base()}/api/user/context?userId=${userId}`);
}

export async function saveGoogleUser({ email, displayName, photoURL }) {
  return jsonFetch(`${base()}/api/user/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, displayName, photoURL }),
  });
}

export async function snoozeProfilePic(userId) {
  return jsonFetch(`${base()}/api/user/snooze-pic`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  });
}

export async function deleteUserAccount(email) {
  return jsonFetch(`${base()}/api/user/account`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
}

export async function skipSetup({ email, coachId, coachName }) {
  return jsonFetch(`${base()}/api/user/skip-setup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, coachId, coachName }),
  });
}

export async function getUserStatus(email) {
  return jsonFetch(`${base()}/api/user/status?email=${encodeURIComponent(email)}`);
}
