import { apiClient } from '../../../shared/services/apiClient';
import { ScreenTimePlugin } from '../../../shared/plugins/screenTimePlugin';

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
  return apiClient.post('/api/screen/save', {
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
  let url = `/api/screen/history?userId=${encodeURIComponent(userId)}&days=${days}`;
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

function toDateKey(date = new Date()) {
  return (
    date.getFullYear() + '-' +
    String(date.getMonth() + 1).padStart(2, '0') + '-' +
    String(date.getDate()).padStart(2, '0')
  );
}

/**
 * Smart backfill: reads device UsageStats history, compares with what's already
 * saved in the DB, and only saves days that are missing or have 0 seconds stored.
 * TODAY and YESTERDAY are always re-saved (today is in-progress; yesterday just
 * completed its full 24-hour window so the reading is now accurate).
 *
 * Equivalent to how StepCounter backfills missed days on app open.
 */
export async function backfillMissingScreenTimeDays(userId) {
  // 1. How many days back to check (from install date, max 14)
  const { syncDays } = await ScreenTimePlugin.getInstallDate();
  const days = Math.min(syncDays || 14, 14);

  // 2. Get per-day accurate OS data from UsageStatsManager
  const { history: deviceHistory } = await ScreenTimePlugin.getAccurateScreenTimeHistory(days);
  if (!Array.isArray(deviceHistory) || deviceHistory.length === 0) return [];

  // 3. Get what's already in the DB
  const today = toDateKey();
  const yesterday = toDateKey(new Date(Date.now() - 86400000));
  const dbResult = await fetchScreenTimeHistory(userId, days, today);
  const dbByDate = new Map((dbResult?.data || []).map(r => [r.Date, r.TotalScreenTimeSeconds || 0]));

  // 4. Decide what to save:
  //    - Always save today + yesterday (fresh/accurate readings)
  //    - Save any past day that is missing from DB or stored as 0
  const toSave = deviceHistory.filter(e => {
    if (!e.date || typeof e.seconds !== 'number' || e.seconds <= 0) return false;
    if (e.date === today || e.date === yesterday) return true;      // always refresh
    return !dbByDate.has(e.date) || dbByDate.get(e.date) === 0;    // missing/zero
  });

  if (toSave.length === 0) return [];

  await Promise.all(
    toSave.map(e =>
      saveScreenTime({ userId, date: e.date, totalScreenTimeSeconds: e.seconds })
    )
  );

  console.log(`âœ… [ScreenTime] Backfilled ${toSave.length} day(s):`, toSave.map(e => e.date));
  return toSave;
}

/**
 * Read accurate per-day screen time from UsageStatsManager (same as Android Digital Wellbeing).
 * Uses OS-level data â€” not affected by background service being killed mid-day.
 */
export async function getAccurateScreenTimeHistory(days = 7) {
  return ScreenTimePlugin.getAccurateScreenTimeHistory(days);
}

/**
 * Read per-day screen time history from the background service SharedPreferences.
 * NOTE: May be lower than actual if service was killed â€” prefer getAccurateScreenTimeHistory.
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
