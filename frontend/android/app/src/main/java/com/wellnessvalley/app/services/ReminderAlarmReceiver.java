package com.wellnessvalley.app.services;

import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
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
    // Water slots — one per 90-min interval (up to 12 per day)
    public static final int RC_WATER_1   = 3001;
    public static final int RC_WATER_2   = 3002;
    public static final int RC_WATER_3   = 3003;
    public static final int RC_WATER_4   = 3004;
    public static final int RC_WATER_5   = 3005;
    public static final int RC_WATER_6   = 3006;
    public static final int RC_WATER_7   = 3007;
    public static final int RC_WATER_8   = 3008;
    public static final int RC_WATER_9   = 3009;
    public static final int RC_WATER_10  = 3010;
    public static final int RC_WATER_11  = 3011;
    public static final int RC_WATER_12  = 3012;
    // Sleep wind-down reminder
    public static final int RC_SLEEP     = 4001;

    // ── Notification IDs ─────────────────────────────────────────────────
    private static final int NOTIF_WEIGHT    = 2001;
    private static final int NOTIF_EDUCATION = 2002;
    private static final int NOTIF_BREAKFAST = 2003;
    private static final int NOTIF_LUNCH     = 2004;
    private static final int NOTIF_DINNER    = 2005;
    private static final int NOTIF_WATER     = 5001; // shared for all water slots
    private static final int NOTIF_SLEEP     = 5002;

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

        // 1. Start AlarmSoundService → plays alarm ringtone + shows foreground notification
        startAlarmSound(context, activityType, label, hour, minute);

        // 2. Reschedule for the SAME time tomorrow
        scheduleNextDay(context, activityType, label, hour, minute);
    }

    // ─────────────────────────────────────────────────────────────────────
    // Start alarm sound via foreground service
    // ─────────────────────────────────────────────────────────────────────

    private void startAlarmSound(Context context,
                                 String activityType,
                                 String label,
                                 int hour,
                                 int minute) {
        try {
            String title   = "🔔 " + (label != null ? label : capitalize(activityType)) + " Reminder";
            // Add 15 minutes (the reminder offset) to get the actual activity start time
            int totalMinutes = hour * 60 + minute + 15;
            int activityHour   = (totalMinutes / 60) % 24;
            int activityMinute = totalMinutes % 60;
            String message = getActivityMessage(activityType, activityHour, activityMinute);

            Intent serviceIntent = new Intent(context, AlarmSoundService.class);
            serviceIntent.setAction(AlarmSoundService.ACTION_START);
            serviceIntent.putExtra(AlarmSoundService.EXTRA_TITLE,   title);
            serviceIntent.putExtra(AlarmSoundService.EXTRA_MESSAGE, message);

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(serviceIntent);
            } else {
                context.startService(serviceIntent);
            }
            Log.d(TAG, "🔊 AlarmSoundService started for " + activityType);
        } catch (Exception e) {
            Log.e(TAG, "❌ Failed to start AlarmSoundService", e);
        }
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
        // Add 15 minutes (the reminder offset) to get the actual activity start time
        int totalMins = hour * 60 + minute + 15;
        int actHour   = (totalMins / 60) % 24;
        int actMinute = totalMins % 60;
        String message = getActivityMessage(activityType, actHour, actMinute);

        // Tap notification → open app
        Intent openApp = new Intent(context, MainActivity.class);
        openApp.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pendingOpen = PendingIntent.getActivity(
                context,
                getRequestCode(activityType),
                openApp,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        // "Dismiss" action → stops AlarmSoundService
        Intent dismissIntent = new Intent(context, AlarmDismissReceiver.class);
        dismissIntent.setAction(AlarmSoundService.ACTION_DISMISS);
        PendingIntent dismissPi = PendingIntent.getBroadcast(
                context,
                getRequestCode(activityType) + 100,
                dismissIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        // Wellness Valley logo as large icon
        Bitmap largeLogo = BitmapFactory.decodeResource(context.getResources(), R.mipmap.ic_launcher);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_notification)
                .setLargeIcon(largeLogo)
                .setContentTitle(title)
                .setContentText(message)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(message))
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .setAutoCancel(true)
                .setContentIntent(pendingOpen)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .addAction(R.drawable.ic_notification, "Dismiss", dismissPi);

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

            // Use exact alarms for precise reminder times
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && am.canScheduleExactAlarms()) {
                am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerMs, pi);
            } else {
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerMs, pi);
            }
            Log.d(TAG, "✅ Rescheduled for " + activityType + " at " + nextDay.getTime());

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

            // Use exact alarms for precise reminder times
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && am.canScheduleExactAlarms()) {
                am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,
                        trigger.getTimeInMillis(), pi);
            } else {
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,
                        trigger.getTimeInMillis(), pi);
            }
            Log.d(TAG, "✅ Scheduled " + activityType + " at " + trigger.getTime());

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
        String[] activities = {"weight", "education", "breakfast", "lunch", "dinner", "sleep"};
        for (String activity : activities) {
            cancelReminder(context, activity);
        }
        cancelWaterReminders(context);
        Log.d(TAG, "🛑 All reminders cancelled");
    }

    /**
     * Cancel all water reminder slots (water_1 through water_12).
     */
    public static void cancelWaterReminders(Context context) {
        for (int i = 1; i <= 12; i++) {
            cancelReminder(context, "water_" + i);
        }
        Log.d(TAG, "🛑 All water reminders cancelled");
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
            channel.enableVibration(false); // Vibration handled by AlarmSoundService

            // Use system alarm sound on the channel (fallback if service not running)
            Uri alarmUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
            if (alarmUri == null) {
                alarmUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
            }
            if (alarmUri != null) {
                AudioAttributes audioAttrs = new AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build();
                channel.setSound(alarmUri, audioAttrs);
            }

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
            case "sleep":     return RC_SLEEP;
            case "water_1":   return RC_WATER_1;
            case "water_2":   return RC_WATER_2;
            case "water_3":   return RC_WATER_3;
            case "water_4":   return RC_WATER_4;
            case "water_5":   return RC_WATER_5;
            case "water_6":   return RC_WATER_6;
            case "water_7":   return RC_WATER_7;
            case "water_8":   return RC_WATER_8;
            case "water_9":   return RC_WATER_9;
            case "water_10":  return RC_WATER_10;
            case "water_11":  return RC_WATER_11;
            case "water_12":  return RC_WATER_12;
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
            case "sleep":     return NOTIF_SLEEP;
            default:
                if (activityType.startsWith("water_")) return NOTIF_WATER;
                return 2000;
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
            case "sleep":
                return "🌙 Bedtime in 15 minutes! Wind down and prepare for a good night's sleep.";
            default:
                if (activityType.toLowerCase().startsWith("water_")) {
                    return "💧 Time to drink water! Stay hydrated throughout the day.";
                }
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
