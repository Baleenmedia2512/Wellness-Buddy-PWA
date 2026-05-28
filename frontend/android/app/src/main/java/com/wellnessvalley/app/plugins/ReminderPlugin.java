package com.wellnessvalley.app.plugins;

import android.app.AlarmManager;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.util.Log;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.wellnessvalley.app.services.ReminderAlarmReceiver;
import com.wellnessvalley.app.services.ReminderBootReceiver;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * ReminderPlugin
 *
 * Capacitor bridge that exposes alarm scheduling to JavaScript.
 *
 * JS usage:
 *   import { ReminderPlugin } from '../plugins/reminderPlugin';
 *
 *   // Schedule a reminder
 *   await ReminderPlugin.scheduleReminder({ activityType: 'weight', label: 'Weight', hour: 2, minute: 45 });
 *
 *   // Cancel one
 *   await ReminderPlugin.cancelReminder({ activityType: 'weight' });
 *
 *   // Cancel all
 *   await ReminderPlugin.cancelAllReminders();
 *
 *   // Check exact-alarm permission (Android 12+)
 *   const { canScheduleExact } = await ReminderPlugin.canScheduleExactAlarms();
 *
 *   // Open system settings to grant exact-alarm permission
 *   await ReminderPlugin.openExactAlarmSettings();
 *
 *   // Schedule multiple at once
 *   await ReminderPlugin.scheduleAll({ reminders: [ {activityType, label, hour, minute}, ... ] });
 */
@CapacitorPlugin(name = "ReminderPlugin")
public class ReminderPlugin extends Plugin {

    private static final String TAG = "ReminderPlugin";

    // ── scheduleReminder ─────────────────────────────────────────────────

    @PluginMethod
    public void scheduleReminder(PluginCall call) {
        String activityType = call.getString("activityType");
        String label        = call.getString("label", activityType);
        Integer hour        = call.getInt("hour");
        Integer minute      = call.getInt("minute");

        if (activityType == null || hour == null || minute == null) {
            call.reject("Missing required parameters: activityType, hour, minute");
            return;
        }

        if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
            call.reject("Invalid time: hour=" + hour + " minute=" + minute);
            return;
        }

        try {
            Context ctx = getContext();
            ReminderAlarmReceiver.scheduleReminder(ctx, activityType, label, hour, minute);

            JSObject result = new JSObject();
            result.put("success", true);
            result.put("activityType", activityType);
            result.put("hour", hour);
            result.put("minute", minute);
            result.put("message", "Reminder scheduled for " + activityType
                    + " at " + hour + ":" + String.format("%02d", minute));
            call.resolve(result);

            Log.d(TAG, "✅ scheduleReminder: " + activityType + " at " + hour + ":" + minute);

        } catch (Exception e) {
            Log.e(TAG, "❌ scheduleReminder failed", e);
            call.reject("Failed to schedule reminder: " + e.getMessage());
        }
    }

    // ── cancelReminder ───────────────────────────────────────────────────

    @PluginMethod
    public void cancelReminder(PluginCall call) {
        String activityType = call.getString("activityType");

        if (activityType == null) {
            call.reject("Missing required parameter: activityType");
            return;
        }

        try {
            ReminderAlarmReceiver.cancelReminder(getContext(), activityType);

            JSObject result = new JSObject();
            result.put("success", true);
            result.put("activityType", activityType);
            call.resolve(result);

            Log.d(TAG, "🛑 cancelReminder: " + activityType);

        } catch (Exception e) {
            Log.e(TAG, "❌ cancelReminder failed", e);
            call.reject("Failed to cancel reminder: " + e.getMessage());
        }
    }

    // ── cancelAllReminders ───────────────────────────────────────────────

    @PluginMethod
    public void cancelAllReminders(PluginCall call) {
        try {
            ReminderAlarmReceiver.cancelAllReminders(getContext());

            JSObject result = new JSObject();
            result.put("success", true);
            call.resolve(result);

            Log.d(TAG, "🛑 cancelAllReminders called");

        } catch (Exception e) {
            Log.e(TAG, "❌ cancelAllReminders failed", e);
            call.reject("Failed to cancel all reminders: " + e.getMessage());
        }
    }

    // ── scheduleAll ──────────────────────────────────────────────────────

    /**
     * Schedule multiple reminders in a single call.
     * Expects: { reminders: [ {activityType, label, hour, minute}, ... ] }
     */
    @PluginMethod
    public void scheduleAll(PluginCall call) {
        JSArray remindersArray = call.getArray("reminders");
        Boolean masterEnabled  = call.getBoolean("masterEnabled", true);

        if (remindersArray == null) {
            call.reject("Missing required parameter: reminders (array)");
            return;
        }

        try {
            Context ctx = getContext();
            int scheduledCount = 0;
            JSONArray persistArray = new JSONArray();

            for (int i = 0; i < remindersArray.length(); i++) {
                JSONObject item = remindersArray.getJSONObject(i);
                String activityType = item.optString("activityType", null);
                String label        = item.optString("label", activityType);
                int    hour         = item.optInt("hour",    -1);
                int    minute       = item.optInt("minute",  -1);
                boolean enabled     = item.optBoolean("enabled", true);

                if (activityType == null || hour < 0 || minute < 0) {
                    Log.w(TAG, "⚠️ Skipping invalid reminder item at index " + i);
                    continue;
                }

                if (masterEnabled && enabled) {
                    ReminderAlarmReceiver.scheduleReminder(ctx, activityType, label, hour, minute);
                    scheduledCount++;
                } else {
                    ReminderAlarmReceiver.cancelReminder(ctx, activityType);
                }

                // Always persist full state (including disabled) for boot recovery
                JSONObject persistItem = new JSONObject();
                persistItem.put("activityType", activityType);
                persistItem.put("label",        label);
                persistItem.put("hour",         hour);
                persistItem.put("minute",       minute);
                persistItem.put("enabled",      enabled);
                persistArray.put(persistItem);
            }

            // Persist to SharedPreferences so ReminderBootReceiver can restore after reboot
            ReminderBootReceiver.persistPreferences(ctx, masterEnabled, persistArray);

            JSObject result = new JSObject();
            result.put("success", true);
            result.put("scheduledCount", scheduledCount);
            call.resolve(result);

            Log.d(TAG, "✅ scheduleAll: scheduled " + scheduledCount + " reminders");

        } catch (Exception e) {
            Log.e(TAG, "❌ scheduleAll failed", e);
            call.reject("Failed to schedule reminders: " + e.getMessage());
        }
    }

    // ── canScheduleExactAlarms ───────────────────────────────────────────

    /**
     * Check whether the app has permission to schedule exact alarms (Android 12+).
     * On Android < 12 this always returns true.
     */
    @PluginMethod
    public void canScheduleExactAlarms(PluginCall call) {
        try {
            boolean canSchedule = true;

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                AlarmManager am = (AlarmManager) getContext()
                        .getSystemService(Context.ALARM_SERVICE);
                if (am != null) {
                    canSchedule = am.canScheduleExactAlarms();
                }
            }

            JSObject result = new JSObject();
            result.put("canScheduleExact", canSchedule);
            call.resolve(result);

        } catch (Exception e) {
            Log.e(TAG, "❌ canScheduleExactAlarms failed", e);
            call.reject("Failed to check exact alarm permission: " + e.getMessage());
        }
    }

    // ── openExactAlarmSettings ───────────────────────────────────────────

    /**
     * Opens the exact alarm permission settings on Android 12+,
     * or app notification settings on older versions.
     * SCHEDULE_EXACT_ALARM is declared in the manifest so the app
     * will appear in the Alarms & Reminders list.
     */
    @PluginMethod
    public void openExactAlarmSettings(PluginCall call) {
        Context ctx = getContext();
        try {
            Intent intent;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                // Android 12+ — open Alarms & Reminders screen for this app
                intent = new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM,
                        Uri.parse("package:" + ctx.getPackageName()));
            } else {
                // Android 8–11 — open app notification settings
                intent = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
                intent.putExtra(Settings.EXTRA_APP_PACKAGE, ctx.getPackageName());
            }
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx.startActivity(intent);
        } catch (Exception e) {
            // Fallback: app details settings
            try {
                Intent fallback = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                        Uri.parse("package:" + ctx.getPackageName()));
                fallback.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                ctx.startActivity(fallback);
            } catch (Exception ignored) {}
        }
        JSObject result = new JSObject();
        result.put("success", true);
        call.resolve(result);
    }
}
