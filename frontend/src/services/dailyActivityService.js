import { apiClient } from './apiClient';

export async function fetchDailyActivity(userId, days = 7, activityType = null, targetDate = null) {
  const typeParam = activityType ? `&activityType=${encodeURIComponent(activityType)}` : '';
  // Always pass the client's local date so the backend uses the device's calendar
  // date instead of the server's UTC date. Without this, IST users (UTC+5:30)
  // get wrong data between 00:00–05:30 IST because the server still thinks it's
  // the previous day./
  const today = targetDate || (() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  })();
  const dateParam = `&targetDate=${encodeURIComponent(today)}`;
  return apiClient.get(`/api/activity?userId=${encodeURIComponent(userId)}&days=${days}${typeParam}${dateParam}`, {
    cache: false
  });
}

export async function saveDailyActivity(payload) {
  return apiClient.post('/api/activity', payload);
}
