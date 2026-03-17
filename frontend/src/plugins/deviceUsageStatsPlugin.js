import { Capacitor, registerPlugin } from '@capacitor/core';

/**
 * Native plugin bridge for DeviceUsageStatsPlugin (Android).
 * Wraps the UsageStatsManager API to provide device-wide app usage data.
 */
const DeviceUsageStats = registerPlugin('DeviceUsageStats', {
  web: {}
});

// Fallback returned on non-Android or when the plugin call fails
const NOT_SUPPORTED = {
  permissionGranted: false,
  granted: false,
  opened: false,
  trend: []
};

const deviceUsageStatsPlugin = {
  /**
   * Check whether the special "Usage Access" permission is granted.
   * @returns {{ granted: boolean }}
   */
  async checkPermission() {
    try {
      if (!Capacitor.isNativePlatform()) return NOT_SUPPORTED;
      return await DeviceUsageStats.checkPermission();
    } catch (err) {
      console.warn('[DeviceUsageStats] checkPermission failed:', err);
      return NOT_SUPPORTED;
    }
  },

  /**
   * Open the OS "Usage Access" settings screen.
   * The user must manually enable access – poll checkPermission() after they return.
   * @returns {{ opened: boolean }}
   */
  async requestPermission() {
    try {
      if (!Capacitor.isNativePlatform()) return NOT_SUPPORTED;
      return await DeviceUsageStats.requestPermission();
    } catch (err) {
      console.warn('[DeviceUsageStats] requestPermission failed:', err);
      return NOT_SUPPORTED;
    }
  },

  /**
   * Fetch usage statistics for the last 24 hours for ALL apps on the device.
   *
   * @returns {{
   *   permissionGranted : boolean,
   *   totalScreenTime   : number,   // ms
   *   myAppUsage        : number,   // ms
   *   myAppRank         : number,   // 1-based rank; 0 if not in list
   *   mostUsedApp       : string,
   *   apps              : Array<{ appName: string, packageName: string, usageTime: number }>
   * }}
   */
  async getUsageStats() {
    try {
      if (!Capacitor.isNativePlatform()) {
        return {
          permissionGranted: false,
          totalScreenTime: 0,
          myAppUsage: 0,
          myAppRank: 0,
          mostUsedApp: '',
          apps: []
        };
      }
      return await DeviceUsageStats.getUsageStats();
    } catch (err) {
      console.warn('[DeviceUsageStats] getUsageStats failed:', err);
      return {
        permissionGranted: false,
        totalScreenTime: 0,
        myAppUsage: 0,
        myAppRank: 0,
        mostUsedApp: '',
        apps: []
      };
    }
  },

  /**
   * Fetch overall device screen-time totals grouped by day.
   *
   * @param {number} days Number of days to fetch, default 30.
   * @returns {{ permissionGranted: boolean, trend: Array<{ date: string, totalScreenTime: number }> }}
   */
  async getDailyUsage(days = 30) {
    try {
      if (!Capacitor.isNativePlatform()) {
        return {
          permissionGranted: false,
          trend: []
        };
      }

      const result = await DeviceUsageStats.getDailyUsage({ days });
      return {
        permissionGranted: !!result?.permissionGranted,
        trend: Array.isArray(result?.trend) ? result.trend : []
      };
    } catch (err) {
      console.warn('[DeviceUsageStats] getDailyUsage failed:', err);
      return {
        permissionGranted: false,
        trend: []
      };
    }
  }
};

export default deviceUsageStatsPlugin;
