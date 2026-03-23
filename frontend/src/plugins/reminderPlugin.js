/**
 * reminderPlugin.js
 *
 * Capacitor JS bridge to the native Android ReminderPlugin.
 * Follows the same pattern as screenTimePlugin.js in this project.
 *
 * Native methods exposed:
 *   scheduleReminder({ id, hour, minute, title, body }) → { success: boolean }
 *   cancelReminder({ id })                              → { success: boolean }
 *   cancelAllReminders()                                → { success: boolean }
 *   checkPermission()                                   → { granted: boolean }
 *   requestExactAlarmPermission()                       → { granted: boolean }
 */

import { Capacitor, registerPlugin } from '@capacitor/core';

// Register native plugin — name must match @CapacitorPlugin(name = "Reminder") in Java
const NativeReminder = registerPlugin('Reminder', {
  web: {}, // No web implementation — Android only
});

const ReminderPluginWrapper = {
  // ─── scheduleReminder ────────────────────────────────────────────────────
  /**
   * Schedule a daily repeating alarm.
   * @param {{ id: number, hour: number, minute: number, title: string, body: string }} opts
   */
  async scheduleReminder(opts) {
    if (!Capacitor.isNativePlatform()) {
      console.log('[ReminderPlugin] Web stub — scheduleReminder:', opts);
      return { success: true };
    }
    try {
      return await NativeReminder.scheduleReminder(opts);
    } catch (err) {
      console.warn('[ReminderPlugin] scheduleReminder failed:', err);
      return { success: false, error: err?.message };
    }
  },

  // ─── cancelReminder ──────────────────────────────────────────────────────
  /**
   * Cancel a specific alarm by its id.
   * @param {{ id: number }} opts
   */
  async cancelReminder(opts) {
    if (!Capacitor.isNativePlatform()) {
      console.log('[ReminderPlugin] Web stub — cancelReminder:', opts);
      return { success: true };
    }
    try {
      return await NativeReminder.cancelReminder(opts);
    } catch (err) {
      console.warn('[ReminderPlugin] cancelReminder failed:', err);
      return { success: false, error: err?.message };
    }
  },

  // ─── cancelAllReminders ──────────────────────────────────────────────────
  async cancelAllReminders() {
    if (!Capacitor.isNativePlatform()) {
      console.log('[ReminderPlugin] Web stub — cancelAllReminders');
      return { success: true };
    }
    try {
      return await NativeReminder.cancelAllReminders();
    } catch (err) {
      console.warn('[ReminderPlugin] cancelAllReminders failed:', err);
      return { success: false, error: err?.message };
    }
  },

  // ─── checkPermission ─────────────────────────────────────────────────────
  /**
   * Check if SCHEDULE_EXACT_ALARM permission is granted (Android 12+).
   */
  async checkPermission() {
    if (!Capacitor.isNativePlatform()) return { granted: true };
    try {
      return await NativeReminder.checkPermission();
    } catch (err) {
      console.warn('[ReminderPlugin] checkPermission failed:', err);
      return { granted: false };
    }
  },

  // ─── requestExactAlarmPermission ────────────────────────────────────────
  /**
   * Open the system settings page to allow exact alarms (Android 12+).
   */
  async requestExactAlarmPermission() {
    if (!Capacitor.isNativePlatform()) return { granted: true };
    try {
      return await NativeReminder.requestExactAlarmPermission();
    } catch (err) {
      console.warn('[ReminderPlugin] requestExactAlarmPermission failed:', err);
      return { granted: false };
    }
  },
};

export { ReminderPluginWrapper as ReminderPlugin };
