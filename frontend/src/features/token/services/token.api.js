import { getApiBaseUrl } from '../../../config/api.config.js';

const base = () => getApiBaseUrl();

export async function saveUsage(payload) {
  const res = await fetch(`${base()}/api/token/usage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function getUsage(email, params = {}) {
  const qs = new URLSearchParams({ email, ...params }).toString();
  const res = await fetch(`${base()}/api/token/usage?${qs}`);
  return res.json();
}

export async function saveCorrection(payload) {
  const res = await fetch(`${base()}/api/token/correction`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function getCorrection(email, params = {}) {
  const qs = new URLSearchParams({ email, ...params }).toString();
  const res = await fetch(`${base()}/api/token/correction?${qs}`);
  return res.json();
}

export async function getPricing(email, modelName) {
  const qs = new URLSearchParams({ email, ...(modelName ? { modelName } : {}) }).toString();
  const res = await fetch(`${base()}/api/token/pricing?${qs}`);
  return res.json();
}

export async function getLatestCosts(email) {
  const res = await fetch(`${base()}/api/token/latest-costs?email=${encodeURIComponent(email)}`);
  return res.json();
}

export async function reverseLookup(correctedName) {
  const res = await fetch(`${base()}/api/token/reverse-lookup?correctedName=${encodeURIComponent(correctedName)}`);
  return res.json();
}
