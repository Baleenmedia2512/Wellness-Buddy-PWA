import { getApiBaseUrl } from '../../../config/api.config.js';

const base = () => getApiBaseUrl();

export async function checkName(name) {
  const res = await fetch(`${base()}/api/nutrition-centers/check-name?name=${encodeURIComponent(name)}`);
  return res.json();
}

export async function getCenters(params) {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${base()}/api/nutrition-centers?${qs}`);
  return res.json();
}

export async function register(payload) {
  const res = await fetch(`${base()}/api/nutrition-centers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function unregister(payload) {
  const res = await fetch(`${base()}/api/nutrition-centers/unregister`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json();
}
