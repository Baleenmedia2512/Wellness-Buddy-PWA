/**
 * stepCounterPlugin.js — JavaScript bridge to native StepCounterPlugin
 */

import { registerPlugin } from '@capacitor/core';

const webFallback = {
  async isAvailable() { return { available: false }; },
  async getPermissionStatus() { return { granted: false }; },
  async startTracking() { return {}; },
  async stopTracking() { return {}; },
  async getStepCount() { return { steps: 0 }; },
  async isLocationEnabled() { return { enabled: true }; },
  async openLocationSettings() { return {}; },
};

export const StepCounterPlugin = registerPlugin('StepCounter', {
  web: () => webFallback,
});
