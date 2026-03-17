import { apiClient } from './apiClient';

export async function fetchDailyActivity(userId, days = 7, activityType = null) {
  const typeParam = activityType ? `&activityType=${encodeURIComponent(activityType)}` : '';
  return apiClient.get(`/api/get-daily-activity?userId=${encodeURIComponent(userId)}&days=${days}${typeParam}`, {
    cache: false
  });
}

export async function saveDailyActivity(payload) {
  return apiClient.post('/api/save-daily-activity', payload);
}
