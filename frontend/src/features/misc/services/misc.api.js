import { getApiBaseUrl } from '../../../config/api.config.js';

const base = () => getApiBaseUrl();

export async function getServerTime() {
  const res = await fetch(`${base()}/api/misc/server-time`, { cache: 'no-store' });
  return res.json();
}

export async function getTimeWindows() {
  const res = await fetch(`${base()}/api/misc/time-windows`);
  return res.json();
}

export async function detectFace(imageBase64) {
  const res = await fetch(`${base()}/api/misc/detect-face`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64 }),
  });
  return res.json();
}

export async function getMyClubAttendance({ userId, startDate, endDate } = {}) {
  const params = new URLSearchParams({ userId: String(userId) });
  if (startDate) params.set('startDate', startDate);
  if (endDate) params.set('endDate', endDate);
  const res = await fetch(`${base()}/api/misc/club-attendance?${params.toString()}`);
  return res.json();
}
