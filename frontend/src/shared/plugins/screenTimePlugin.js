import { Capacitor, registerPlugin } from '@capacitor/core';

const ScreenTime = registerPlugin('ScreenTime', {
  web: {}
});

const fallback = {
  granted: false,
  restricted: false,
  canOpenSettings: true,
  message: null,
  totalScreenTimeSeconds: 0,
  appUsage: [],
  date: null
};

const wrappedPlugin = {
  _initialized: false,

  async init() {
    if (this._initialized) return true;
    if (!Capacitor.isNativePlatform()) return false;
    this._initialized = true;
    return true;
  },

  async hasPermission() {
    try {
      await this.init();
      if (!Capacitor.isNativePlatform()) return { granted: false };
      return await ScreenTime.hasPermission();
    } catch (error) {
      console.warn('[ScreenTime] hasPermission failed:', error);
      return {
        granted: false,
        restricted: true,
        canOpenSettings: false,
        message: 'Usage access is unavailable on this device.'
      };
    }
  },

  async requestPermission() {
    try {
      await this.init();
      if (!Capacitor.isNativePlatform()) return { granted: false };
      const result = await ScreenTime.requestPermission();
      if (result?.granted) return result;
      return {
        granted: false,
        restricted: false,
        canOpenSettings: true,
        message: result?.message || 'Open Usage Access settings and allow this app.'
      };
    } catch (error) {
      console.warn('[ScreenTime] requestPermission failed:', error);
      return {
        granted: false,
        restricted: true,
        canOpenSettings: false,
        message: 'This phone blocks Usage Access for this app/device profile.'
      };
    }
  },

  async getTodayScreenTime() {
    try {
      await this.init();
      if (!Capacitor.isNativePlatform()) return fallback;
      return await ScreenTime.getTodayScreenTime();
    } catch (error) {
      console.warn('[ScreenTime] getTodayScreenTime failed:', error);
      return {
        ...fallback,
        restricted: true,
        canOpenSettings: false,
        message: 'Could not read UsageStats on this device.'
      };
    }
  },

  /**
   * Returns app install date and how many days to sync (1-14).
   * Used to sync screen time history from install day → today.
   */
  async getInstallDate() {
    try {
      await this.init();
      if (!Capacitor.isNativePlatform()) return { installDate: null, syncDays: 14 };
      return await ScreenTime.getInstallDate();
    } catch (error) {
      console.warn('[ScreenTime] getInstallDate failed:', error);
      return { installDate: null, syncDays: 14 };
    }
  },

  /**
   * Returns per-day screen time by querying UsageStatsManager directly for each day.
   * ACCURATE: same data source as Android Digital Wellbeing — not affected by service kills.
   */
  async getAccurateScreenTimeHistory(days = 7) {
    try {
      await this.init();
      if (!Capacitor.isNativePlatform()) return { history: [] };
      return await ScreenTime.getAccurateScreenTimeHistory({ days });
    } catch (error) {
      console.warn('[ScreenTime] getAccurateScreenTimeHistory failed:', error);
      return { history: [] };
    }
  },

  /**
   * Returns per-day screen time totals recorded by GalleryMonitorService.
   * Reads the "WellnessScreen" SharedPreferences written by the background service.
   * NOTE: Values may be lower than actual if service was killed mid-day.
   * Prefer getAccurateScreenTimeHistory() when permission is granted.
   */
  async getBackgroundScreenTimeHistory(days = 7) {
    try {
      await this.init();
      if (!Capacitor.isNativePlatform()) return { history: [] };
      return await ScreenTime.getBackgroundScreenTimeHistory({ days });
    } catch (error) {
      console.warn('[ScreenTime] getBackgroundScreenTimeHistory failed:', error);
      return { history: [] };
    }
  }
};

export const ScreenTimePlugin = wrappedPlugin;
