import { apiClient } from './apiClient';
import { ScreenTimePlugin } from '../plugins/screenTimePlugin';

/**
 * Check if screen time permission is granted
 */
export async function hasScreenTimePermission() {
  const result = await ScreenTimePlugin.hasPermission();
  return result.granted;
}

/**
 * Request screen time (usage stats) permission
 */
export async function requestScreenTimePermission() {
  return ScreenTimePlugin.requestPermission();
}

/**
 * Fetch today's screen time from Android UsageStatsManager
 */
export async function getTodayScreenTime() {
  return ScreenTimePlugin.getTodayScreenTime();
}

/**
 * Save screen time to backend
 */
export async function saveScreenTime({ userId, date, totalScreenTimeSeconds }) {
  return apiClient.post('/api/save-screen-time', {
    userId,
    date,
    totalScreenTimeSeconds
  });
}

/**
 * Fetch screen time history from backend
 * @param {number} userId
 * @param {number} days - 1 for today, 7 for last week, 30 for last month
 */
export async function fetchScreenTimeHistory(userId, days = 7) {
  return apiClient.get(
    `/api/get-screen-time?userId=${encodeURIComponent(userId)}&days=${days}`,
    { cache: false }
  );
}

/**
 * Refresh today's screen time: fetch from device and save to backend
 */
export async function refreshAndSaveScreenTime(userId) {
  const deviceData = await getTodayScreenTime();

  if (!deviceData || !deviceData.totalScreenTimeSeconds) {
    return { success: false, message: 'No screen time data available from device' };
  }

  const saveResult = await saveScreenTime({
    userId,
    date: deviceData.date,
    totalScreenTimeSeconds: deviceData.totalScreenTimeSeconds
  });

  return {
    success: true,
    deviceData,
    saveResult
  };
}

/**
 * Format seconds into human-readable string
 */
export function formatScreenTime(seconds) {
  if (!seconds || seconds <= 0) return '0m';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hrs > 0) return `${hrs}h ${mins}m`;
  return `${mins}m`;
}
