import { apiClient } from './apiClient';
import { ScreenTimePlugin } from '../plugins/screenTimePlugin';

/**
 * Check if screen time permission is granted
 */
export async function hasScreenTimePermission() {
  const result = await ScreenTimePlugin.hasPermission();
  return !!result.granted;
}

/**
 * Detailed permission status for restricted/unsupported device handling.
 */
export async function getScreenTimePermissionStatus() {
  const result = await ScreenTimePlugin.hasPermission();
  return {
    granted: !!result?.granted,
    restricted: !!result?.restricted,
    canOpenSettings: result?.canOpenSettings !== false,
    message: result?.message || null
  };
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
 * @param {string|null} targetDate - YYYY-MM-DD device-local date (IST fix)
 */
export async function fetchScreenTimeHistory(userId, days = 7, targetDate = null) {
  let url = `/api/get-screen-time?userId=${encodeURIComponent(userId)}&days=${days}`;
  if (targetDate) url += `&targetDate=${encodeURIComponent(targetDate)}`;
  return apiClient.get(url, { cache: false });
}

/**
 * Refresh today's screen time: fetch from device and save to backend.
 * Accepts optional pre-fetched deviceData to avoid a redundant plugin call.
 */
export async function refreshAndSaveScreenTime(userId, existingDeviceData = null) {
  const deviceData = existingDeviceData || await getTodayScreenTime();

  if (!deviceData || !deviceData.totalScreenTimeSeconds) {
    return { success: false, message: 'No screen time data available from device' };
  }

  // Always use device-reported date (local timezone). Compute as fallback if missing.
  const localDate = deviceData.date || (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();

  const saveResult = await saveScreenTime({
    userId,
    date: localDate,
    totalScreenTimeSeconds: deviceData.totalScreenTimeSeconds
  });

  return {
    success: true,
    deviceData,
    saveResult
  };
}

/**
 * Get the app install date and recommended sync days (days since install, capped at 14).
 * Used to sync screen time from install day forward instead of a hardcoded 7-day window.
 */
export async function getInstallDate() {
  return ScreenTimePlugin.getInstallDate();
}

/**
 * Sync accurate screen time history from install day to today.
 * Queries UsageStatsManager (OS-level, like Digital Wellbeing) for each day.
 * Saves all days with data to DB — always overwrites stale values.
 */
export async function syncAccurateHistoryFromInstall(userId) {
  const { syncDays } = await ScreenTimePlugin.getInstallDate();
  const { history } = await ScreenTimePlugin.getAccurateScreenTimeHistory(syncDays);
  if (!Array.isArray(history) || history.length === 0) return [];

  const daysWithData = history.filter(e => e.seconds > 0);
  if (daysWithData.length === 0) return [];

  await Promise.all(
    daysWithData.map(e =>
      apiClient.post('/api/save-screen-time', {
        userId,
        date: e.date,
        totalScreenTimeSeconds: e.seconds
      })
    )
  );
  return daysWithData;
}

/**
 * Read accurate per-day screen time from UsageStatsManager (same as Android Digital Wellbeing).
 * Uses OS-level data — not affected by background service being killed mid-day.
 */
export async function getAccurateScreenTimeHistory(days = 7) {
  return ScreenTimePlugin.getAccurateScreenTimeHistory(days);
}

/**
 * Read per-day screen time history from the background service SharedPreferences.
 * NOTE: May be lower than actual if service was killed — prefer getAccurateScreenTimeHistory.
 */
export async function getBackgroundScreenTimeHistory(days = 7) {
  return ScreenTimePlugin.getBackgroundScreenTimeHistory(days);
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
