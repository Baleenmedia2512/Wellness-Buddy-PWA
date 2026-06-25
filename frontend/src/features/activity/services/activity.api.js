import { getApiBaseUrl } from '../../../config/api.config.js';

const base = () => getApiBaseUrl();

export async function getDaily(userId, { days = 7, activityType, targetDate } = {}) {
  const params = new URLSearchParams({ userId: String(userId), days: String(days) });
  if (activityType) params.set('activityType', activityType);
  if (targetDate) params.set('targetDate', targetDate);
  const res = await fetch(`${base()}/api/activity?${params.toString()}`);
  return res.json();
}

export async function saveDaily(payload) {
  const res = await fetch(`${base()}/api/activity`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function getTimeReport(params) {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${base()}/api/activity/time-report?${qs}`);
  return res.json();
}

export async function getWatchCalories(userId, date) {
  const params = new URLSearchParams({ userId: String(userId) });
  if (date) params.set('date', date);
  const res = await fetch(`${base()}/api/activity/watch-calories?${params.toString()}`);
  return res.json();
}
