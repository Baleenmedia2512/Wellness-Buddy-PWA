package com.wellnessvalley.app.plugins;

import android.app.AlarmManager;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.wellnessvalley.app.services.ReminderBroadcastReceiver;

/**
 * ReminderPlugin
 *
 * Capacitor plugin that exposes Android AlarmManager to JavaScript.
 * Registered in MainActivity.java as:  registerPlugin(ReminderPlugin.class);
 *
 * JS name: 'Reminder'  (must match registerPlugin('Reminder', ...) in JS bridge)
 */
@CapacitorPlugin(name = "Reminder")
public class ReminderPlugin extends Plugin {

    private static final String TAG = "ReminderPlugin";

    // Alarm IDs must match ALARM_IDS in reminderService.js
    private static final int[] ALL_ALARM_IDS = {1001, 1002, 1003, 1004, 1005};

    // ─────────────────────────────────────────────────────────────────────
    // scheduleReminder
    // ─────────────────────────────────────────────────────────────────────
    /**
     * Schedule a daily alarm.
     *
     * JS call:  ReminderPlugin.scheduleReminder({ id, hour, minute, title, body })
     * Returns:  { success: true }
     */
    @PluginMethod
    public void scheduleReminder(PluginCall call) {
        Integer id     = call.getInt("id");
        Integer hour   = call.getInt("hour");
        Integer minute = call.getInt("minute");
        String  title  = call.getString("title");
        String  body   = call.getString("body");

        if (id == null || hour == null || minute == null || title == null || body == null) {
            call.reject("Missing required parameters: id, hour, minute, title, body");
            return;
        }

        if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
            call.reject("hour must be 0–23, minute must be 0–59");
            return;
        }

        try {
            ReminderBroadcastReceiver.scheduleReminder(
                getContext(), id, hour, minute, title, body
            );
            Log.d(TAG, "✅ scheduleReminder: id=" + id + " at " + hour + ":" + String.format("%02d", minute));

            JSObject result = new JSObject();
            result.put("success", true);
            call.resolve(result);

        } catch (Exception e) {
            Log.e(TAG, "❌ scheduleReminder failed", e);
            call.reject("Failed to schedule reminder: " + e.getMessage());
        }
    }

    // ─────────────────────────────────────────────────────────────────────
    // cancelReminder
    // ─────────────────────────────────────────────────────────────────────
    /**
     * Cancel a specific alarm.
     *
     * JS call:  ReminderPlugin.cancelReminder({ id })
     * Returns:  { success: true }
     */
    @PluginMethod
    public void cancelReminder(PluginCall call) {
        Integer id = call.getInt("id");

        if (id == null) {
            call.reject("Missing required parameter: id");
            return;
        }

        try {
            ReminderBroadcastReceiver.cancelReminder(getContext(), id);
            Log.d(TAG, "✅ cancelReminder: id=" + id);

            JSObject result = new JSObject();
            result.put("success", true);
            call.resolve(result);

        } catch (Exception e) {
            Log.e(TAG, "❌ cancelReminder failed", e);
            call.reject("Failed to cancel reminder: " + e.getMessage());
        }
    }

    // ─────────────────────────────────────────────────────────────────────
    // cancelAllReminders
    // ─────────────────────────────────────────────────────────────────────
    /**
     * Cancel all 5 activity reminders.
     *
     * JS call:  ReminderPlugin.cancelAllReminders()
     * Returns:  { success: true }
     */
    @PluginMethod
    public void cancelAllReminders(PluginCall call) {
        try {
            for (int id : ALL_ALARM_IDS) {
                ReminderBroadcastReceiver.cancelReminder(getContext(), id);
            }
            Log.d(TAG, "✅ All reminders cancelled");

            JSObject result = new JSObject();
            result.put("success", true);
            call.resolve(result);

        } catch (Exception e) {
            Log.e(TAG, "❌ cancelAllReminders failed", e);
            call.reject("Failed to cancel all reminders: " + e.getMessage());
        }
    }

    // ─────────────────────────────────────────────────────────────────────
    // checkPermission
    // ─────────────────────────────────────────────────────────────────────
    /**
     * Check if SCHEDULE_EXACT_ALARM is granted (Android 12+).
     *
     * JS call:  ReminderPlugin.checkPermission()
     * Returns:  { granted: boolean }
     */
    @PluginMethod
    public void checkPermission(PluginCall call) {
        JSObject result = new JSObject();

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            AlarmManager am = (AlarmManager) getContext().getSystemService(android.content.Context.ALARM_SERVICE);
            boolean granted = (am != null) && am.canScheduleExactAlarms();
            result.put("granted", granted);
        } else {
            // Below Android 12, no special permission needed
            result.put("granted", true);
        }

        call.resolve(result);
    }

    // ─────────────────────────────────────────────────────────────────────
    // requestExactAlarmPermission
    // ─────────────────────────────────────────────────────────────────────
    /**
     * Open system settings to let user grant exact alarm permission (Android 12+).
     *
     * JS call:  ReminderPlugin.requestExactAlarmPermission()
     * Returns:  { granted: boolean }  (reflects current state, not after grant)
     */
    @PluginMethod
    public void requestExactAlarmPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            AlarmManager am = (AlarmManager) getContext().getSystemService(android.content.Context.ALARM_SERVICE);

            if (am != null && !am.canScheduleExactAlarms()) {
                // Open the "Alarms & reminders" settings page
                Intent intent = new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM);
                intent.setData(Uri.parse("package:" + getContext().getPackageName()));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(intent);
                Log.d(TAG, "📲 Opened exact alarm settings page");
            }

            JSObject result = new JSObject();
            result.put("granted", am != null && am.canScheduleExactAlarms());
            call.resolve(result);

        } else {
            JSObject result = new JSObject();
            result.put("granted", true);
            call.resolve(result);
        }
    }
}
