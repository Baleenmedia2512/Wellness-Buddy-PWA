package com.wellnessvalley.app.services;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * ReminderBootReceiver
 *
 * Android clears ALL AlarmManager alarms on device reboot.
 * This receiver fires on BOOT_COMPLETED and MY_PACKAGE_REPLACED to
 * re-register every enabled reminder from SharedPreferences.
 *
 * The JS layer (reminderService.js) stores reminder preferences in
 * localStorage, but on Android the Capacitor WebView's localStorage is
 * persisted as a file and is available after reboot.  We mirror key
 * preferences into SharedPreferences so this receiver can read them
 * without waiting for the WebView to start.
 *
 * SharedPreferences name : "WellnessReminders"
 * Format stored by ReminderPlugin.savePreferencesForBoot():
 *   masterEnabled : boolean
 *   reminders_json: JSON array string
 *     [ { "activityType":"weight", "label":"Weight", "hour":2, "minute":45, "enabled":true }, ... ]
 */
public class ReminderBootReceiver extends BroadcastReceiver {

    private static final String TAG   = "ReminderBootReceiver";
    static final String PREFS_NAME    = "WellnessReminders";
    static final String KEY_MASTER    = "masterEnabled";
    static final String KEY_REMINDERS = "reminders_json";

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        if (action == null) return;

        if (!Intent.ACTION_BOOT_COMPLETED.equals(action)
                && !"android.intent.action.MY_PACKAGE_REPLACED".equals(action)) {
            return;
        }

        Log.d(TAG, "📱 Boot completed / package replaced — rescheduling reminders");
        rescheduleFromPreferences(context);
    }

    /**
     * Read persisted reminder preferences and re-register all enabled alarms.
     * Called both from onReceive() and from ReminderPlugin after saving prefs,
     * so alarms are always in sync.
     */
    public static void rescheduleFromPreferences(Context context) {
        SharedPreferences sp = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);

        boolean masterEnabled = sp.getBoolean(KEY_MASTER, false);
        String  remindersJson = sp.getString(KEY_REMINDERS, null);

        if (!masterEnabled || remindersJson == null) {
            Log.d(TAG, "Master disabled or no saved reminders — cancelling all");
            ReminderAlarmReceiver.cancelAllReminders(context);
            return;
        }

        try {
            JSONArray arr = new JSONArray(remindersJson);
            int rescheduled = 0;
            int cancelled   = 0;

            for (int i = 0; i < arr.length(); i++) {
                JSONObject item = arr.getJSONObject(i);
                String  activityType = item.optString("activityType", null);
                String  label        = item.optString("label", activityType);
                int     hour         = item.optInt("hour",   -1);
                int     minute       = item.optInt("minute", -1);
                boolean enabled      = item.optBoolean("enabled", false);

                if (activityType == null || hour < 0 || minute < 0) continue;

                if (enabled) {
                    ReminderAlarmReceiver.scheduleReminder(context, activityType, label, hour, minute);
                    rescheduled++;
                    Log.d(TAG, "✅ Rescheduled: " + activityType + " at " + hour + ":" + minute);
                } else {
                    ReminderAlarmReceiver.cancelReminder(context, activityType);
                    cancelled++;
                    Log.d(TAG, "🛑 Cancelled: " + activityType);
                }
            }

            Log.d(TAG, "Boot reschedule complete — scheduled=" + rescheduled
                    + " cancelled=" + cancelled);

        } catch (Exception e) {
            Log.e(TAG, "❌ Failed to parse reminders JSON", e);
        }
    }

    // ── Helper: persist preferences from ReminderPlugin ─────────────────

    /**
     * Save the current reminder state into SharedPreferences so it survives reboot.
     * Called by ReminderPlugin.scheduleAll() / cancelAll().
     */
    public static void persistPreferences(Context context,
                                          boolean masterEnabled,
                                          JSONArray remindersArray) {
        try {
            SharedPreferences.Editor ed = context
                    .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                    .edit();
            ed.putBoolean(KEY_MASTER,    masterEnabled);
            ed.putString(KEY_REMINDERS,  remindersArray.toString());
            ed.apply();
            Log.d(TAG, "💾 Preferences persisted (masterEnabled=" + masterEnabled
                    + ", count=" + remindersArray.length() + ")");
        } catch (Exception e) {
            Log.e(TAG, "❌ Failed to persist preferences", e);
        }
    }
}
