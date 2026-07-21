import { apiClient } from '../../../shared/services/apiClient';
import { todayBusinessDate, DEFAULT_BUSINESS_TIMEZONE } from '../../../shared/utils/datetimeUtils';

export async function fetchDailyActivity(userId, days = 7, activityType = null, targetDate = null) {
  const typeParam = activityType ? `&activityType=${encodeURIComponent(activityType)}` : '';
  const today = targetDate || todayBusinessDate(DEFAULT_BUSINESS_TIMEZONE);
  const dateParam = `&targetDate=${encodeURIComponent(today)}`;
  return apiClient.get(`/api/activity?userId=${encodeURIComponent(userId)}&days=${days}${typeParam}${dateParam}`, {
    cache: false
  });
}

export async function saveDailyActivity(payload) {
  return apiClient.post('/api/activity', payload);
}
