package com.wellnessvalley.app.plugins;

import android.app.AlarmManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
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

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

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

    /** Intent / JS bridge extras for task-panel deep links */
    public static final String EXTRA_OPEN_TASK_PANEL = "openTaskPanel";
    public static final String EXTRA_TASK_TYPE       = "taskType";
    public static final String EXTRA_TASK_ID         = "taskId";
    public static final String EXTRA_UPLOAD_NOW      = "uploadNow";
    public static final String ACTION_OPEN_TASK_PANEL = "openTaskPanel";

    private static final String PENDING_PREFS = "WellnessTaskNotification";
    private static final String PENDING_KEY   = "pending_action";

    private static ReminderPlugin instance = null;

    @Override
    public void load() {
        super.load();
        instance = this;
    }

    /**
     * Deliver a task-reminder action to JS (panel open / upload now).
     * Persists to SharedPreferences when the WebView bridge is not ready yet.
     */
    public static void deliverTaskReminderAction(Context ctx,
                                                 String taskType,
                                                 String taskId,
                                                 boolean uploadNow) {
        try {
            JSObject data = new JSObject();
            data.put("action", ACTION_OPEN_TASK_PANEL);
            if (taskType != null && !taskType.isEmpty()) data.put("taskType", taskType);
            if (taskId != null && !taskId.isEmpty()) data.put("taskId", taskId);
            data.put("uploadNow", uploadNow);

            if (instance != null) {
                instance.notifyListeners("taskReminderAction", data);
                Log.d(TAG, "✅ taskReminderAction delivered to JS");
            } else if (ctx != null) {
                SharedPreferences sp = ctx.getSharedPreferences(PENDING_PREFS, Context.MODE_PRIVATE);
                sp.edit()
                    .putString(PENDING_KEY + "_action", ACTION_OPEN_TASK_PANEL)
                    .putString(PENDING_KEY + "_taskType", taskType != null ? taskType : "")
                    .putString(PENDING_KEY + "_taskId", taskId != null ? taskId : "")
                    .putBoolean(PENDING_KEY + "_uploadNow", uploadNow)
                    .apply();
                Log.d(TAG, "💾 taskReminderAction persisted for cold start");
            }
        } catch (Exception e) {
            Log.e(TAG, "❌ deliverTaskReminderAction failed", e);
        }
    }

    /** Build a MainActivity intent that opens the Task Notification Panel. */
    public static Intent buildTaskPanelIntent(Context ctx,
                                              String taskType,
                                              String taskId,
                                              boolean uploadNow) {
        Intent intent = new Intent(ctx, com.wellnessvalley.app.MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        intent.putExtra(EXTRA_OPEN_TASK_PANEL, true);
        if (taskType != null) intent.putExtra(EXTRA_TASK_TYPE, taskType);
        if (taskId != null) intent.putExtra(EXTRA_TASK_ID, taskId);
        intent.putExtra(EXTRA_UPLOAD_NOW, uploadNow);
        return intent;
    }

    // ── consumePendingTaskNotification ────────────────────────────────────

    /**
     * Return a pending task-notification action saved during cold start, then clear it.
     * JS: await ReminderPlugin.consumePendingTaskNotification()
     */
    @PluginMethod
    public void consumePendingTaskNotification(PluginCall call) {
        try {
            SharedPreferences sp = getContext().getSharedPreferences(PENDING_PREFS, Context.MODE_PRIVATE);
            String action = sp.getString(PENDING_KEY + "_action", null);
            if (action == null) {
                call.resolve(new JSObject());
                return;
            }
            JSObject data = new JSObject();
            data.put("action", action);
            String taskType = sp.getString(PENDING_KEY + "_taskType", "");
            String taskId   = sp.getString(PENDING_KEY + "_taskId", "");
            if (!taskType.isEmpty()) data.put("taskType", taskType);
            if (!taskId.isEmpty())   data.put("taskId", taskId);
            data.put("uploadNow", sp.getBoolean(PENDING_KEY + "_uploadNow", false));

            sp.edit()
                .remove(PENDING_KEY + "_action")
                .remove(PENDING_KEY + "_taskType")
                .remove(PENDING_KEY + "_taskId")
                .remove(PENDING_KEY + "_uploadNow")
                .apply();

            call.resolve(data);
        } catch (Exception e) {
            Log.e(TAG, "❌ consumePendingTaskNotification failed", e);
            call.reject("Failed to consume pending notification: " + e.getMessage());
        }
    }

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

                // Optional personalised body built by reminderService.js when learned average exists
                String personalizedBody = item.optString("personalizedBody", null);
                if (personalizedBody != null && personalizedBody.isEmpty()) {
                    personalizedBody = null; // treat empty string as absent
                }

                if (masterEnabled && enabled) {
                    ReminderAlarmReceiver.scheduleReminder(ctx, activityType, label, hour, minute, personalizedBody);
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

    // ── scheduleSnooze ────────────────────────────────────────────────────

    /**
     * Schedule a one-shot local notification at the snooze expiry time.
     *
     * JS call: await ReminderPlugin.scheduleSnooze({ taskId, taskType, label, snoozeMinutes })
     */
    @PluginMethod
    public void scheduleSnooze(PluginCall call) {
        Integer taskId        = call.getInt("taskId");
        String  taskType      = call.getString("taskType", "task");
        String  label         = call.getString("label", taskType);
        Integer snoozeMinutes = call.getInt("snoozeMinutes");
        String  body          = call.getString("body");
        Integer hour          = call.getInt("hour", -1);
        Integer minute        = call.getInt("minute", -1);

        if (taskId == null || snoozeMinutes == null) {
            call.reject("Missing required parameters: taskId, snoozeMinutes");
            return;
        }
        if (snoozeMinutes <= 0 || snoozeMinutes > 120) {
            call.reject("snoozeMinutes must be between 1 and 120");
            return;
        }

        try {
            long triggerAtMs = System.currentTimeMillis() + (long) snoozeMinutes * 60 * 1000;
            int alarmHour   = hour    != null ? hour    : -1;
            int alarmMinute = minute  != null ? minute  : -1;
            ReminderAlarmReceiver.scheduleOneShot(
                    getContext(), taskId, taskType, label, triggerAtMs,
                    body, alarmHour, alarmMinute);

            JSObject res = new JSObject();
            res.put("success",   true);
            res.put("taskId",    taskId);
            res.put("triggerAt", triggerAtMs);
            call.resolve(res);

            Log.d(TAG, "✅ scheduleSnooze: taskId=" + taskId + " snoozeMinutes=" + snoozeMinutes);
        } catch (Exception e) {
            Log.e(TAG, "❌ scheduleSnooze failed", e);
            call.reject("Failed to schedule snooze: " + e.getMessage());
        }
    }

    // ── cancelSnooze ──────────────────────────────────────────────────────

    /**
     * Cancel a previously scheduled snooze alarm.
     *
     * JS call: await ReminderPlugin.cancelSnooze({ taskId })
     */
    @PluginMethod
    public void cancelSnooze(PluginCall call) {
        Integer taskId = call.getInt("taskId");
        if (taskId == null) {
            call.reject("Missing required parameter: taskId");
            return;
        }
        try {
            ReminderAlarmReceiver.cancelOneShot(getContext(), taskId);

            JSObject res = new JSObject();
            res.put("success", true);
            res.put("taskId",  taskId);
            call.resolve(res);

            Log.d(TAG, "🛑 cancelSnooze: taskId=" + taskId);
        } catch (Exception e) {
            Log.e(TAG, "❌ cancelSnooze failed", e);
            call.reject("Failed to cancel snooze: " + e.getMessage());
        }
    }

    // ── updateWaterIntake ─────────────────────────────────────────────────
    /**
     * Cache today's water intake totals in SharedPreferences so that alarm
     * notifications can display a smart remaining-balance message without
     * needing network access at fire time.
     *
     * Key: "WellnessWaterToday"  (SharedPreferences file: "WellnessWater")
     * Value: JSON  { "date": "YYYY-MM-DD", "drunkMl": N, "goalMl": N }
     *
     * JS usage:
     *   await ReminderPlugin.updateWaterIntake({ drunkMl: 500, goalMl: 3000 });
     */
    @PluginMethod
    public void updateWaterIntake(PluginCall call) {
        int drunkMl = call.getInt("drunkMl", 0);
        int goalMl  = call.getInt("goalMl",  2500);

        try {
            String today = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());

            JSONObject data = new JSONObject();
            data.put("date",    today);
            data.put("drunkMl", drunkMl);
            data.put("goalMl",  goalMl);

            SharedPreferences sp = getContext()
                    .getSharedPreferences("WellnessWater", Context.MODE_PRIVATE);
            sp.edit().putString("WellnessWaterToday", data.toString()).apply();

            JSObject result = new JSObject();
            result.put("success", true);
            call.resolve(result);

            Log.d(TAG, "💧 updateWaterIntake cached: " + drunkMl + "/" + goalMl + " ml on " + today);

        } catch (Exception e) {
            Log.e(TAG, "❌ updateWaterIntake failed", e);
            call.reject("Failed to update water intake cache: " + e.getMessage());
        }
    }
}
