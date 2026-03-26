import { Capacitor, registerPlugin } from '@capacitor/core';

const StepCounter = registerPlugin('StepCounter', {
  web: {}
});

const fallback = {
  available: false,
  granted: false,
  status: 'unavailable',
  started: false,
  stopped: true,
  totalSteps: null,
  isTracking: false
};

const wrappedPlugin = {
  _initialized: false,

  async init() {
    if (this._initialized) return true;
    if (!Capacitor.isNativePlatform()) return false;
    this._initialized = true;
    return true;
  },

  async isAvailable() {
    try {
      await this.init();
      if (!Capacitor.isNativePlatform()) return fallback;
      return await StepCounter.isAvailable();
    } catch (error) {
      console.warn('[StepCounter] isAvailable failed:', error);
      return fallback;
    }
  },

  async getPermissionStatus() {
    try {
      await this.init();
      if (!Capacitor.isNativePlatform()) return fallback;
      return await StepCounter.getPermissionStatus();
    } catch (error) {
      console.warn('[StepCounter] getPermissionStatus failed:', error);
      return fallback;
    }
  },

  async requestPermission() {
    try {
      await this.init();
      if (!Capacitor.isNativePlatform()) return fallback;
      return await StepCounter.requestPermission();
    } catch (error) {
      console.warn('[StepCounter] requestPermission failed:', error);
      return fallback;
    }
  },

  async startTracking() {
    try {
      await this.init();
      if (!Capacitor.isNativePlatform()) return fallback;
      return await StepCounter.startTracking();
    } catch (error) {
      console.warn('[StepCounter] startTracking failed:', error);
      return fallback;
    }
  },

  async stopTracking() {
    try {
      await this.init();
      if (!Capacitor.isNativePlatform()) return fallback;
      return await StepCounter.stopTracking();
    } catch (error) {
      console.warn('[StepCounter] stopTracking failed:', error);
      return fallback;
    }
  },

  async getCurrentStepCount() {
    try {
      await this.init();
      if (!Capacitor.isNativePlatform()) return fallback;
      return await StepCounter.getCurrentStepCount();
    } catch (error) {
      console.warn('[StepCounter] getCurrentStepCount failed:', error);
      return fallback;
    }
  },

  /**
   * Returns per-day step totals recorded by the background service.
   * Reads the "WellnessSteps" SharedPreferences written by GalleryMonitorService.
   * Used by StepCounter.js to backfill DB days that show 0 when the app was closed.
   */
  async getBackgroundStepHistory(days = 7) {
    try {
      await this.init();
      if (!Capacitor.isNativePlatform()) return { history: [] };
      return await StepCounter.getBackgroundStepHistory({ days });
    } catch (error) {
      console.warn('[StepCounter] getBackgroundStepHistory failed:', error);
      return { history: [] };
    }
  },

  addListener(eventName, listenerFunc) {
    if (!Capacitor.isNativePlatform()) {
      return { remove: async () => {} };
    }
    return StepCounter.addListener(eventName, listenerFunc);
  }
};

export const StepCounterPlugin = wrappedPlugin;
