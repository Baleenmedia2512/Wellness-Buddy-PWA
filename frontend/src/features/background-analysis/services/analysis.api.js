import { getApiBaseUrl } from '../../../config/api.config.js';

const base = () => getApiBaseUrl();

export async function save(payload) {
  const res = await fetch(`${base()}/api/background-analysis`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function list(userId, { limit = 50, offset = 0 } = {}) {
  const res = await fetch(`${base()}/api/background-analysis?userId=${encodeURIComponent(userId)}&limit=${limit}&offset=${offset}`);
  return res.json();
}

export async function deleteAnalysis(payload) {
  const res = await fetch(`${base()}/api/background-analysis`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function undoDelete(payload) {
  const res = await fetch(`${base()}/api/background-analysis/undo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json();
}
