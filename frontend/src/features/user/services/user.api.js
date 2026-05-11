/**
 * User feature — frontend HTTP layer.
 * Sole place that knows the URL paths for the user-feature endpoints.
 */
import { getApiBaseUrl } from '../../../config/api.config.js';

const base = () => getApiBaseUrl();

export async function getProfile(email, { cacheBust = false } = {}) {
  const ts = cacheBust ? `&_t=${Date.now()}` : '';
  const res = await fetch(`${base()}/api/user/profile?email=${encodeURIComponent(email)}${ts}`);
  return res.json();
}

export async function updateProfile(payload) {
  const res = await fetch(`${base()}/api/user/profile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function getContext(userId) {
  const res = await fetch(`${base()}/api/user/context?userId=${encodeURIComponent(userId)}`);
  return res.json();
}

export async function lookup(email, { method = 'POST' } = {}) {
  const url = method === 'GET'
    ? `${base()}/api/user/lookup?email=${encodeURIComponent(email)}`
    : `${base()}/api/user/lookup`;
  const init = method === 'GET'
    ? {}
    : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) };
  const res = await fetch(url, init);
  return res.json();
}

export async function saveGoogleUser(payload) {
  const res = await fetch(`${base()}/api/user/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function snoozeProfilePic(userId) {
  const res = await fetch(`${base()}/api/user/snooze-pic`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  });
  return res.json();
}

export async function deleteAccount(email) {
  const res = await fetch(`${base()}/api/user/account`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  return res.json();
}

export async function skipSetup(payload) {
  const res = await fetch(`${base()}/api/user/skip-setup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function getStatus(email) {
  const res = await fetch(`${base()}/api/user/status?email=${encodeURIComponent(email)}`);
  return res.json();
}
