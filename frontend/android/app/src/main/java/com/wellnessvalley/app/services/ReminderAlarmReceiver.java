package com.wellnessvalley.app.services;

import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.util.Log;

import androidx.core.app.NotificationCompat;

import com.wellnessvalley.app.MainActivity;
import com.wellnessvalley.app.R;

import java.util.Calendar;

/**
 * ReminderAlarmReceiver
 *
 * Fires at the scheduled reminder time for a specific activity.
 * - Shows a local notification: "15 minutes until your [Activity] time!"
 * - Self-reschedules for the NEXT day so the reminder repeats daily.
 *
 * Activities supported: weight, education, breakfast, lunch, dinner
 *
 * Request codes per activity (must be unique across all alarms):
 *   weight    → 1001
 *   education → 1002
 *   breakfast → 1003
 *   lunch     → 1004
 *   dinner    → 1005
 */
public class ReminderAlarmReceiver extends BroadcastReceiver {

    private static final String TAG = "ReminderAlarmReceiver";

    // Intent extras
    public static final String EXTRA_ACTIVITY_TYPE = "activityType";
    public static final String EXTRA_HOUR          = "hour";
    public static final String EXTRA_MINUTE        = "minute";
    public static final String EXTRA_LABEL         = "label";

    // Notification channel
    private static final String CHANNEL_ID   = "WellnessReminders";
    private static final String CHANNEL_NAME = "Wellness Reminders";

    // ── Request codes (unique per activity) ──────────────────────────────
    public static final int RC_WEIGHT    = 1001;
    public static final int RC_EDUCATION = 1002;
    public static final int RC_BREAKFAST = 1003;
    public static final int RC_LUNCH     = 1004;
    public static final int RC_DINNER    = 1005;

    // ── Notification IDs ─────────────────────────────────────────────────
    private static final int NOTIF_WEIGHT    = 2001;
    private static final int NOTIF_EDUCATION = 2002;
    private static final int NOTIF_BREAKFAST = 2003;
    private static final int NOTIF_LUNCH     = 2004;
    private static final int NOTIF_DINNER    = 2005;

    @Override
    public void onReceive(Context context, Intent intent) {
        String activityType = intent.getStringExtra(EXTRA_ACTIVITY_TYPE);
        int    hour         = intent.getIntExtra(EXTRA_HOUR,   -1);
        int    minute       = intent.getIntExtra(EXTRA_MINUTE, -1);
        String label        = intent.getStringExtra(EXTRA_LABEL);

        if (activityType == null || hour < 0 || minute < 0) {
            Log.e(TAG, "❌ Invalid intent extras — activityType=" + activityType
                    + " hour=" + hour + " minute=" + minute);
            return;
        }

        Log.d(TAG, "⏰ Reminder fired for " + activityType
                + " at " + formatTime(hour, minute));

        // 1. Show the notification
        showReminderNotification(context, activityType, label, hour, minute);

        // 2. Reschedule for the SAME time tomorrow
        scheduleNextDay(context, activityType, label, hour, minute);
    }

    // ─────────────────────────────────────────────────────────────────────
    // Show Notification
    // ─────────────────────────────────────────────────────────────────────

    private void showReminderNotification(Context context,
                                          String activityType,
                                          String label,
                                          int hour,
                                          int minute) {
        NotificationManager nm =
                (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;

        ensureChannel(nm);

        String title   = "🔔 " + (label != null ? label : capitalize(activityType)) + " Reminder";
        String message = getActivityMessage(activityType, hour, minute + 15);

        // Tap notification → open app
        Intent openApp = new Intent(context, MainActivity.class);
        openApp.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pendingOpen = PendingIntent.getActivity(
                context,
                getRequestCode(activityType),
                openApp,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_notification)
                .setContentTitle(title)
                .setContentText(message)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(message))
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setAutoCancel(true)
                .setContentIntent(pendingOpen)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC);

        nm.notify(getNotificationId(activityType), builder.build());
        Log.d(TAG, "✅ Notification shown for " + activityType);
    }

    // ─────────────────────────────────────────────────────────────────────
    // Reschedule for next day
    // ─────────────────────────────────────────────────────────────────────

    private void scheduleNextDay(Context context,
                                 String activityType,
                                 String label,
                                 int hour,
                                 int minute) {
        try {
            Calendar nextDay = Calendar.getInstance();
            nextDay.add(Calendar.DAY_OF_YEAR, 1);
            nextDay.set(Calendar.HOUR_OF_DAY, hour);
            nextDay.set(Calendar.MINUTE, minute);
            nextDay.set(Calendar.SECOND, 0);
            nextDay.set(Calendar.MILLISECOND, 0);

            long triggerMs = nextDay.getTimeInMillis();

            Intent intent = new Intent(context, ReminderAlarmReceiver.class);
            intent.setAction("com.wellnessvalley.app.REMINDER_" + activityType.toUpperCase());
            intent.putExtra(EXTRA_ACTIVITY_TYPE, activityType);
            intent.putExtra(EXTRA_HOUR,   hour);
            intent.putExtra(EXTRA_MINUTE, minute);
            intent.putExtra(EXTRA_LABEL,  label);

            int requestCode = getRequestCode(activityType);
            PendingIntent pi = PendingIntent.getBroadcast(
                    context,
                    requestCode,
                    intent,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );

            AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
            if (am == null) return;

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                if (am.canScheduleExactAlarms()) {
                    am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerMs, pi);
                    Log.d(TAG, "✅ Rescheduled (exact) for " + activityType + " at " + nextDay.getTime());
                } else {
                    am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerMs, pi);
                    Log.w(TAG, "⚠️ Rescheduled (inexact) for " + activityType);
                }
            } else {
                am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerMs, pi);
                Log.d(TAG, "✅ Rescheduled for " + activityType + " at " + nextDay.getTime());
            }

        } catch (Exception e) {
            Log.e(TAG, "❌ Failed to reschedule for " + activityType, e);
        }
    }

    // ─────────────────────────────────────────────────────────────────────
    // Static helpers — called from ReminderPlugin
    // ─────────────────────────────────────────────────────────────────────

    /**
     * Schedule (or reschedule) a daily reminder for an activity.
     * If the computed time for today has already passed, the first fire
     * will be tomorrow; otherwise it fires today.
     */
    public static void scheduleReminder(Context context,
                                        String activityType,
                                        String label,
                                        int hour,
                                        int minute) {
        try {
            Calendar trigger = Calendar.getInstance();
            trigger.set(Calendar.HOUR_OF_DAY, hour);
            trigger.set(Calendar.MINUTE, minute);
            trigger.set(Calendar.SECOND, 0);
            trigger.set(Calendar.MILLISECOND, 0);

            // If the time has already passed today, schedule for tomorrow
            if (trigger.getTimeInMillis() <= System.currentTimeMillis()) {
                trigger.add(Calendar.DAY_OF_YEAR, 1);
                Log.d(TAG, "⏩ Time already passed today — scheduling for tomorrow");
            }

            Intent intent = new Intent(context, ReminderAlarmReceiver.class);
            intent.setAction("com.wellnessvalley.app.REMINDER_" + activityType.toUpperCase());
            intent.putExtra(EXTRA_ACTIVITY_TYPE, activityType);
            intent.putExtra(EXTRA_HOUR,   hour);
            intent.putExtra(EXTRA_MINUTE, minute);
            intent.putExtra(EXTRA_LABEL,  label);

            int requestCode = getRequestCode(activityType);
            PendingIntent pi = PendingIntent.getBroadcast(
                    context,
                    requestCode,
                    intent,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );

            AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
            if (am == null) {
                Log.e(TAG, "❌ AlarmManager null");
                return;
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                if (am.canScheduleExactAlarms()) {
                    am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,
                            trigger.getTimeInMillis(), pi);
                    Log.d(TAG, "✅ Scheduled (exact) " + activityType
                            + " at " + trigger.getTime());
                } else {
                    am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,
                            trigger.getTimeInMillis(), pi);
                    Log.w(TAG, "⚠️ Scheduled (inexact) " + activityType
                            + " — exact alarm permission not granted");
                }
            } else {
                am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,
                        trigger.getTimeInMillis(), pi);
                Log.d(TAG, "✅ Scheduled " + activityType + " at " + trigger.getTime());
            }

        } catch (Exception e) {
            Log.e(TAG, "❌ Failed to schedule reminder for " + activityType, e);
        }
    }

    /**
     * Cancel the daily reminder for a specific activity.
     */
    public static void cancelReminder(Context context, String activityType) {
        try {
            Intent intent = new Intent(context, ReminderAlarmReceiver.class);
            intent.setAction("com.wellnessvalley.app.REMINDER_" + activityType.toUpperCase());

            PendingIntent pi = PendingIntent.getBroadcast(
                    context,
                    getRequestCode(activityType),
                    intent,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );

            AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
            if (am != null) {
                am.cancel(pi);
                Log.d(TAG, "🛑 Cancelled reminder for " + activityType);
            }
        } catch (Exception e) {
            Log.e(TAG, "❌ Failed to cancel reminder for " + activityType, e);
        }
    }

    /**
     * Cancel ALL activity reminders at once.
     */
    public static void cancelAllReminders(Context context) {
        String[] activities = {"weight", "education", "breakfast", "lunch", "dinner"};
        for (String activity : activities) {
            cancelReminder(context, activity);
        }
        Log.d(TAG, "🛑 All reminders cancelled");
    }

    // ─────────────────────────────────────────────────────────────────────
    // Internal helpers
    // ─────────────────────────────────────────────────────────────────────

    private void ensureChannel(NotificationManager nm) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    CHANNEL_NAME,
                    NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription("Daily activity reminders for Wellness Valley");
            channel.enableVibration(true);
            channel.setShowBadge(true);
            nm.createNotificationChannel(channel);
        }
    }

    public static int getRequestCode(String activityType) {
        if (activityType == null) return 1000;
        switch (activityType.toLowerCase()) {
            case "weight":    return RC_WEIGHT;
            case "education": return RC_EDUCATION;
            case "breakfast": return RC_BREAKFAST;
            case "lunch":     return RC_LUNCH;
            case "dinner":    return RC_DINNER;
            default:          return 1000;
        }
    }

    private int getNotificationId(String activityType) {
        if (activityType == null) return 2000;
        switch (activityType.toLowerCase()) {
            case "weight":    return NOTIF_WEIGHT;
            case "education": return NOTIF_EDUCATION;
            case "breakfast": return NOTIF_BREAKFAST;
            case "lunch":     return NOTIF_LUNCH;
            case "dinner":    return NOTIF_DINNER;
            default:          return 2000;
        }
    }

    private String getActivityMessage(String activityType, int scheduledHour, int scheduledMinute) {
        String timeStr = formatTime(scheduledHour, scheduledMinute);
        switch (activityType.toLowerCase()) {
            case "weight":
                return "⚖️ Your Weight tracking time starts at " + timeStr
                        + ". Log your weight now to stay on track!";
            case "education":
                return "📚 Education session starts at " + timeStr
                        + ". Get ready to learn!";
            case "breakfast":
                return "🥗 Breakfast window opens at " + timeStr
                        + ". Time to prepare your meal and log it!";
            case "lunch":
                return "🍱 Lunch window opens at " + timeStr
                        + ". Don't forget to log your meal!";
            case "dinner":
                return "🌙 Dinner window opens at " + timeStr
                        + ". Plan your evening meal!";
            default:
                return "Your " + capitalize(activityType) + " time starts at " + timeStr + ".";
        }
    }

    private static String formatTime(int hour, int minute) {
        String period = hour >= 12 ? "PM" : "AM";
        int displayHour = hour % 12;
        if (displayHour == 0) displayHour = 12;
        return String.format("%d:%02d %s", displayHour, minute, period);
    }

    private static String capitalize(String s) {
        if (s == null || s.isEmpty()) return s;
        return s.substring(0, 1).toUpperCase() + s.substring(1).toLowerCase();
    }
}
