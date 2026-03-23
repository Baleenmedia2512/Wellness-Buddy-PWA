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
 * ReminderBroadcastReceiver
 *
 * Receives alarm intents scheduled by ReminderPlugin and:
 *   1. Shows a local notification to the user.
 *   2. Re-schedules the same alarm for the NEXT day (daily repeat).
 *
 * Works even when the app is fully closed.
 */
public class ReminderBroadcastReceiver extends BroadcastReceiver {

    private static final String TAG = "ReminderReceiver";

    public static final String ACTION_REMINDER       = "com.wellnessvalley.app.ACTION_REMINDER";
    public static final String EXTRA_ALARM_ID        = "alarm_id";
    public static final String EXTRA_TITLE           = "title";
    public static final String EXTRA_BODY            = "body";
    public static final String EXTRA_HOUR            = "hour";
    public static final String EXTRA_MINUTE          = "minute";

    private static final String CHANNEL_ID           = "WellnessReminderChannel";
    private static final String CHANNEL_NAME         = "Wellness Reminders";
    private static final String CHANNEL_DESC         = "Daily activity reminders for Wellness Valley";

    // ─────────────────────────────────────────────────────────────────────
    @Override
    public void onReceive(Context context, Intent intent) {
        if (!ACTION_REMINDER.equals(intent.getAction())) return;

        int    alarmId = intent.getIntExtra(EXTRA_ALARM_ID, -1);
        String title   = intent.getStringExtra(EXTRA_TITLE);
        String body    = intent.getStringExtra(EXTRA_BODY);
        int    hour    = intent.getIntExtra(EXTRA_HOUR, -1);
        int    minute  = intent.getIntExtra(EXTRA_MINUTE, -1);

        Log.d(TAG, "⏰ Reminder fired — id=" + alarmId + " title=" + title);

        if (alarmId < 0 || title == null || body == null) {
            Log.w(TAG, "Invalid reminder extras, skipping");
            return;
        }

        // 1. Show notification
        showNotification(context, alarmId, title, body);

        // 2. Reschedule for tomorrow (daily repeat)
        if (hour >= 0 && minute >= 0) {
            rescheduleForTomorrow(context, alarmId, hour, minute, title, body);
        }
    }

    // ─────────────────────────────────────────────────────────────────────
    // Show local notification
    // ─────────────────────────────────────────────────────────────────────
    private void showNotification(Context context, int alarmId, String title, String body) {
        createNotificationChannel(context);

        // Tap notification → open app
        Intent launchIntent = new Intent(context, MainActivity.class);
        launchIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(
            context,
            alarmId,
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setDefaults(NotificationCompat.DEFAULT_ALL)   // sound + vibrate + lights
            .setAutoCancel(true)
            .setContentIntent(pendingIntent);

        NotificationManager nm =
            (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) {
            nm.notify(alarmId, builder.build());
            Log.d(TAG, "✅ Notification shown for alarmId=" + alarmId);
        }
    }

    // ─────────────────────────────────────────────────────────────────────
    // Create notification channel (Android 8+)
    // ─────────────────────────────────────────────────────────────────────
    private void createNotificationChannel(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;

        NotificationManager nm =
            (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;

        if (nm.getNotificationChannel(CHANNEL_ID) != null) return; // already created

        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID, CHANNEL_NAME, NotificationManager.IMPORTANCE_HIGH
        );
        channel.setDescription(CHANNEL_DESC);
        channel.enableVibration(true);
        channel.setShowBadge(true);
        nm.createNotificationChannel(channel);
        Log.d(TAG, "✅ Notification channel created");
    }

    // ─────────────────────────────────────────────────────────────────────
    // Reschedule for next day at same time (daily repeat)
    // ─────────────────────────────────────────────────────────────────────
    private void rescheduleForTomorrow(Context context, int alarmId,
                                       int hour, int minute,
                                       String title, String body) {
        try {
            AlarmManager alarmManager =
                (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
            if (alarmManager == null) return;

            // Build the same intent
            Intent intent = buildIntent(context, alarmId, hour, minute, title, body);
            PendingIntent pendingIntent = PendingIntent.getBroadcast(
                context,
                alarmId,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );

            // Set trigger for same time TOMORROW
            Calendar cal = Calendar.getInstance();
            cal.set(Calendar.HOUR_OF_DAY, hour);
            cal.set(Calendar.MINUTE, minute);
            cal.set(Calendar.SECOND, 0);
            cal.set(Calendar.MILLISECOND, 0);
            cal.add(Calendar.DAY_OF_YEAR, 1); // ← next day

            long triggerAt = cal.getTimeInMillis();

            setExactAlarm(alarmManager, triggerAt, pendingIntent);
            Log.d(TAG, "✅ Rescheduled alarmId=" + alarmId + " for tomorrow at " + hour + ":" + String.format("%02d", minute));

        } catch (Exception e) {
            Log.e(TAG, "❌ Failed to reschedule alarm", e);
        }
    }

    // ─────────────────────────────────────────────────────────────────────
    // Static helpers used by ReminderPlugin
    // ─────────────────────────────────────────────────────────────────────

    /**
     * Schedule a daily reminder.
     * Called from ReminderPlugin.scheduleReminder().
     */
    public static void scheduleReminder(Context context, int alarmId,
                                        int hour, int minute,
                                        String title, String body) {
        try {
            AlarmManager alarmManager =
                (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
            if (alarmManager == null) {
                Log.e(TAG, "AlarmManager is null");
                return;
            }

            Intent intent = buildIntent(context, alarmId, hour, minute, title, body);
            PendingIntent pendingIntent = PendingIntent.getBroadcast(
                context,
                alarmId,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );

            // Next occurrence of this time (today if in future, else tomorrow)
            Calendar cal = Calendar.getInstance();
            cal.set(Calendar.HOUR_OF_DAY, hour);
            cal.set(Calendar.MINUTE, minute);
            cal.set(Calendar.SECOND, 0);
            cal.set(Calendar.MILLISECOND, 0);

            if (cal.getTimeInMillis() <= System.currentTimeMillis()) {
                cal.add(Calendar.DAY_OF_YEAR, 1);
            }

            setExactAlarm(alarmManager, cal.getTimeInMillis(), pendingIntent);
            Log.d(TAG, "✅ Scheduled alarmId=" + alarmId + " at " + hour + ":" + String.format("%02d", minute)
                + " → " + cal.getTime());

        } catch (Exception e) {
            Log.e(TAG, "❌ scheduleReminder failed", e);
        }
    }

    /**
     * Cancel a reminder by alarmId.
     */
    public static void cancelReminder(Context context, int alarmId) {
        try {
            AlarmManager alarmManager =
                (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
            if (alarmManager == null) return;

            Intent intent = new Intent(context, ReminderBroadcastReceiver.class);
            intent.setAction(ACTION_REMINDER);
            PendingIntent pendingIntent = PendingIntent.getBroadcast(
                context,
                alarmId,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );

            alarmManager.cancel(pendingIntent);
            pendingIntent.cancel();
            Log.d(TAG, "✅ Cancelled alarmId=" + alarmId);
        } catch (Exception e) {
            Log.e(TAG, "❌ cancelReminder failed", e);
        }
    }

    // ─────────────────────────────────────────────────────────────────────
    // Private helpers
    // ─────────────────────────────────────────────────────────────────────

    private static Intent buildIntent(Context context, int alarmId,
                                      int hour, int minute,
                                      String title, String body) {
        Intent intent = new Intent(context, ReminderBroadcastReceiver.class);
        intent.setAction(ACTION_REMINDER);
        intent.putExtra(EXTRA_ALARM_ID, alarmId);
        intent.putExtra(EXTRA_TITLE, title);
        intent.putExtra(EXTRA_BODY, body);
        intent.putExtra(EXTRA_HOUR, hour);
        intent.putExtra(EXTRA_MINUTE, minute);
        return intent;
    }

    private static void setExactAlarm(AlarmManager am, long triggerAt, PendingIntent pi) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            if (am.canScheduleExactAlarms()) {
                am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pi);
            } else {
                // Fallback: inexact alarm (slightly delayed but still works)
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pi);
                Log.w(TAG, "⚠️ Exact alarm permission not granted — using inexact alarm");
            }
        } else {
            am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pi);
        }
    }
}
