import { getApiBaseUrl } from '../../../config/api.config.js';

const base = () => getApiBaseUrl();

export async function saveLog(payload) {
  const res = await fetch(`${base()}/api/education/logs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function getLogs(userId, opts = {}) {
  const cacheBuster = opts.cacheBuster || Date.now();
  const res = await fetch(`${base()}/api/education/logs?userId=${encodeURIComponent(userId)}&_t=${cacheBuster}`, {
    headers: opts.headers || {},
  });
  return res.json();
}

export async function getLogImage(logId, userId) {
  const res = await fetch(`${base()}/api/education/log-image?logId=${encodeURIComponent(logId)}&userId=${encodeURIComponent(userId)}`);
  return res.json();
}

export async function getSummary(userId, opts = {}) {
  const cacheBuster = opts.cacheBuster || Date.now();
  const res = await fetch(`${base()}/api/education/summary?userId=${encodeURIComponent(userId)}&_t=${cacheBuster}`, {
    headers: opts.headers || {},
  });
  return res.json();
}

export async function deleteLog(payload) {
  const res = await fetch(`${base()}/api/education/logs`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function undoDelete(payload) {
  const res = await fetch(`${base()}/api/education/undo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json();
}
