import { Capacitor, registerPlugin } from '@capacitor/core';

const ScreenTime = registerPlugin('ScreenTime', {
  web: {}
});

const fallback = {
  granted: false,
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
      return { granted: false };
    }
  },

  async requestPermission() {
    try {
      await this.init();
      if (!Capacitor.isNativePlatform()) return { granted: false };
      return await ScreenTime.requestPermission();
    } catch (error) {
      console.warn('[ScreenTime] requestPermission failed:', error);
      return { granted: false };
    }
  },

  async getTodayScreenTime() {
    try {
      await this.init();
      if (!Capacitor.isNativePlatform()) return fallback;
      return await ScreenTime.getTodayScreenTime();
    } catch (error) {
      console.warn('[ScreenTime] getTodayScreenTime failed:', error);
      return fallback;
    }
  }
};

export const ScreenTimePlugin = wrappedPlugin;
