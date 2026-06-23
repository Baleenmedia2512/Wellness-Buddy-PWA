package com.wellnessvalley.app.services;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.util.Log;

import androidx.core.app.NotificationCompat;

import com.wellnessvalley.app.MainActivity;
import com.wellnessvalley.app.R;
import com.wellnessvalley.app.plugins.ReminderPlugin;

/**
 * AlarmSoundService
 *
 * Foreground Service that:
 * 1. Plays the device's system ALARM ringtone (not just notification sound)
 * 2. Vibrates in a repeating pattern
 * 3. Holds a WakeLock so CPU stays awake while playing
 * 4. Automatically stops after MAX_ALARM_DURATION_MS (60 seconds)
 * 5. Stops immediately when it receives ACTION_DISMISS
 *
 * Started by ReminderAlarmReceiver via startForegroundService().
 * Stopped by AlarmDismissReceiver (user taps "Dismiss") or auto-timeout.
 */
public class AlarmSoundService extends Service {

    private static final String TAG = "AlarmSoundService";

    public static final String ACTION_START   = "com.wellnessvalley.app.ALARM_START";
    public static final String ACTION_DISMISS = "com.wellnessvalley.app.ALARM_DISMISS";
    public static final String ACTION_SNOOZE  = "com.wellnessvalley.app.ALARM_SNOOZE";

    public static final String EXTRA_TITLE        = "alarmTitle";
    public static final String EXTRA_MESSAGE      = "alarmMessage";
    public static final String EXTRA_ACTIVITY_TYPE = "activityType";
    public static final String EXTRA_TASK_ID       = "taskId";

    /** How long the alarm rings before auto-stopping (120 seconds) */
    private static final long MAX_ALARM_DURATION_MS = 120_000L;

    /** Snooze duration: 5 minutes */
    private static final long SNOOZE_DURATION_MS = 5 * 60 * 1000L;

    /** Notification ID for the foreground notification (different from reminder notification) */
    private static final int FOREGROUND_NOTIF_ID = 9001;
    private static final String CHANNEL_ID       = "WellnessAlarmSound";
    private static final String CHANNEL_NAME     = "Wellness Alarm Sound";

    /** Vibration pattern: 0ms delay, 800ms on, 400ms off, repeat */
    private static final long[] VIBRATION_PATTERN = {0, 800, 400};

    private MediaPlayer     mMediaPlayer;
    private PowerManager.WakeLock mWakeLock;
    private Vibrator        mVibrator;
    private Handler         mAutoStopHandler;
    private Runnable        mAutoStopRunnable;

    // ─────────────────────────────────────────────────────────────────────
    // Service lifecycle
    // ─────────────────────────────────────────────────────────────────────

    @Override
    public void onCreate() {
        super.onCreate();
        mAutoStopHandler = new Handler(Looper.getMainLooper());
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) {
            stopSelf();
            return START_NOT_STICKY;
        }

        String action = intent.getAction();

        if (ACTION_DISMISS.equals(action)) {
            Log.d(TAG, "🔕 Dismiss received — stopping alarm");
            stopAlarm();
            return START_NOT_STICKY;
        }

        if (ACTION_SNOOZE.equals(action)) {
            Log.d(TAG, "💤 Snooze received — stopping alarm and rescheduling in 5 min");
            String title   = intent.getStringExtra(EXTRA_TITLE);
            String message = intent.getStringExtra(EXTRA_MESSAGE);
            snoozeAlarm(title, message);
            return START_NOT_STICKY;
        }

        // Default: start playing alarm
        String title        = intent.getStringExtra(EXTRA_TITLE);
        String message      = intent.getStringExtra(EXTRA_MESSAGE);
        String activityType = intent.getStringExtra(EXTRA_ACTIVITY_TYPE);
        String taskId       = intent.getStringExtra(EXTRA_TASK_ID);
        if (title   == null) title   = "Wellness Alarm";
        if (message == null) message = "Time for your activity!";

        startAlarm(title, message, activityType, taskId);
        return START_NOT_STICKY;
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null; // Not a bound service
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        releaseResources();
    }

    // ─────────────────────────────────────────────────────────────────────
    // Alarm start / stop
    // ─────────────────────────────────────────────────────────────────────

    private void startAlarm(String title, String message, String activityType, String taskId) {
        Log.d(TAG, "🔔 Starting alarm sound");

        // 1. Acquire WakeLock so CPU stays awake
        acquireWakeLock();

        // 2. Promote to foreground with an ongoing notification
        startForeground(FOREGROUND_NOTIF_ID, buildForegroundNotification(title, message, activityType, taskId));

        // 3. Play system alarm ringtone
        playAlarmSound();

        // 4. Vibrate
        startVibration();

        // 5. Auto-stop after MAX_ALARM_DURATION_MS
        mAutoStopRunnable = () -> {
            Log.d(TAG, "⏱ Auto-stop after 120s");
            stopAlarm();  // stopAlarm() already broadcasts ACTION_CLOSE_ALARM
        };
        mAutoStopHandler.postDelayed(mAutoStopRunnable, MAX_ALARM_DURATION_MS);
    }

    private void stopAlarm() {
        // Cancel auto-stop timer
        if (mAutoStopRunnable != null) {
            mAutoStopHandler.removeCallbacks(mAutoStopRunnable);
            mAutoStopRunnable = null;
        }
        releaseResources();
        // Tell AlarmFullScreenActivity to close itself
        sendBroadcast(new Intent(AlarmFullScreenActivity.ACTION_CLOSE_ALARM));
        stopForeground(true);
        stopSelf();
        Log.d(TAG, "✅ Alarm stopped");
    }

    /**
     * Snooze: stop the current alarm and re-fire it after SNOOZE_DURATION_MS (5 minutes).
     * A one-shot AlarmManager fires a new ACTION_START intent to this service.
     */
    private void snoozeAlarm(String title, String message) {
        // Stop current alarm sound first
        if (mAutoStopRunnable != null) {
            mAutoStopHandler.removeCallbacks(mAutoStopRunnable);
            mAutoStopRunnable = null;
        }
        releaseResources();
        stopForeground(true);

        try {
            // Schedule a one-shot alarm to re-trigger in 5 minutes
            long triggerMs = System.currentTimeMillis() + SNOOZE_DURATION_MS;

            Intent restartIntent = new Intent(this, AlarmSoundService.class);
            restartIntent.setAction(ACTION_START);
            if (title   != null) restartIntent.putExtra(EXTRA_TITLE,   title);
            if (message != null) restartIntent.putExtra(EXTRA_MESSAGE, message);

            // Use PendingIntent for a Service (startForegroundService)
            PendingIntent pi = PendingIntent.getForegroundService(
                    this,
                    9010,
                    restartIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );

            AlarmManager am = (AlarmManager) getSystemService(Context.ALARM_SERVICE);
            if (am != null) {
                // Use inexact alarm — no exact alarm permission needed
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerMs, pi);
                Log.d(TAG, "💤 Snoozed — will re-ring in 5 minutes");
            }
        } catch (Exception e) {
            Log.e(TAG, "❌ Failed to schedule snooze", e);
        }

        // Tell AlarmFullScreenActivity to close itself
        sendBroadcast(new Intent(AlarmFullScreenActivity.ACTION_CLOSE_ALARM));
        stopSelf();
    }

    // ─────────────────────────────────────────────────────────────────────
    // Sound
    // ─────────────────────────────────────────────────────────────────────

    private void playAlarmSound() {
        try {
            // Get system alarm ringtone URI
            Uri alarmUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
            if (alarmUri == null) {
                // Fallback to notification sound if alarm URI not set
                alarmUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
            }
            if (alarmUri == null) {
                Log.w(TAG, "⚠️ No alarm URI available");
                return;
            }

            mMediaPlayer = new MediaPlayer();

            // Use STREAM_ALARM for actual alarm volume
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                AudioAttributes attrs = new AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build();
                mMediaPlayer.setAudioAttributes(attrs);
            } else {
                //noinspection deprecation
                mMediaPlayer.setAudioStreamType(AudioManager.STREAM_ALARM);
            }

            mMediaPlayer.setDataSource(getApplicationContext(), alarmUri);
            mMediaPlayer.setLooping(true); // Loop until auto-stop or dismiss
            mMediaPlayer.prepareAsync();

            mMediaPlayer.setOnPreparedListener(mp -> {
                mp.start();
                Log.d(TAG, "▶️ Alarm ringtone playing");
            });

            mMediaPlayer.setOnErrorListener((mp, what, extra) -> {
                Log.e(TAG, "❌ MediaPlayer error: what=" + what + " extra=" + extra);
                mp.reset();
                return true;
            });

        } catch (Exception e) {
            Log.e(TAG, "❌ Failed to play alarm sound", e);
        }
    }

    // ─────────────────────────────────────────────────────────────────────
    // Vibration
    // ─────────────────────────────────────────────────────────────────────

    private void startVibration() {
        try {
            mVibrator = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
            if (mVibrator == null || !mVibrator.hasVibrator()) return;

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                // Repeating vibration pattern (index 0 = repeat from start)
                mVibrator.vibrate(
                        VibrationEffect.createWaveform(VIBRATION_PATTERN, 0)
                );
            } else {
                //noinspection deprecation
                mVibrator.vibrate(VIBRATION_PATTERN, 0);
            }
            Log.d(TAG, "📳 Vibration started");
        } catch (Exception e) {
            Log.e(TAG, "❌ Failed to vibrate", e);
        }
    }

    // ─────────────────────────────────────────────────────────────────────
    // WakeLock
    // ─────────────────────────────────────────────────────────────────────

    private void acquireWakeLock() {
        try {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (pm == null) return;

            mWakeLock = pm.newWakeLock(
                    PowerManager.PARTIAL_WAKE_LOCK,
                    "WellnessValley:AlarmWakeLock"
            );
            // Hold for 65s max (slightly longer than alarm duration)
            mWakeLock.acquire(MAX_ALARM_DURATION_MS + 5_000L);
            Log.d(TAG, "🔒 WakeLock acquired");
        } catch (Exception e) {
            Log.e(TAG, "❌ Failed to acquire WakeLock", e);
        }
    }

    // ─────────────────────────────────────────────────────────────────────
    // Resource cleanup
    // ─────────────────────────────────────────────────────────────────────

    private void releaseResources() {
        // Stop MediaPlayer
        if (mMediaPlayer != null) {
            try {
                if (mMediaPlayer.isPlaying()) mMediaPlayer.stop();
                mMediaPlayer.release();
            } catch (Exception e) {
                Log.e(TAG, "Error releasing MediaPlayer", e);
            }
            mMediaPlayer = null;
        }

        // Stop Vibrator
        if (mVibrator != null) {
            try {
                mVibrator.cancel();
            } catch (Exception e) {
                Log.e(TAG, "Error cancelling vibrator", e);
            }
            mVibrator = null;
        }

        // Release WakeLock
        if (mWakeLock != null && mWakeLock.isHeld()) {
            try {
                mWakeLock.release();
                Log.d(TAG, "🔓 WakeLock released");
            } catch (Exception e) {
                Log.e(TAG, "Error releasing WakeLock", e);
            }
            mWakeLock = null;
        }
    }

    // ─────────────────────────────────────────────────────────────────────
    // Foreground notification (required to keep service running)
    // ─────────────────────────────────────────────────────────────────────

    private Notification buildForegroundNotification(String title,
                                                     String message,
                                                     String activityType,
                                                     String taskId) {
        NotificationManager nm =
                (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        ensureAlarmChannel(nm);

        // "Dismiss" action — sends ACTION_DISMISS to stop alarm completely
        Intent dismissIntent = new Intent(this, AlarmDismissReceiver.class);
        dismissIntent.setAction(ACTION_DISMISS);
        PendingIntent dismissPi = PendingIntent.getBroadcast(
                this,
                9002,
                dismissIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        // "Snooze" action — sends ACTION_SNOOZE to pause and re-ring in 5 min
        Intent snoozeIntent = new Intent(this, AlarmDismissReceiver.class);
        snoozeIntent.setAction(ACTION_SNOOZE);
        snoozeIntent.putExtra(EXTRA_TITLE,   title);
        snoozeIntent.putExtra(EXTRA_MESSAGE, message);
        PendingIntent snoozePi = PendingIntent.getBroadcast(
                this,
                9004,
                snoozeIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        // Tap notification → open Task Notification Panel
        Intent openApp = ReminderPlugin.buildTaskPanelIntent(this, activityType, taskId, false);
        PendingIntent openPi = PendingIntent.getActivity(
                this,
                9003,
                openApp,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        // "Upload Now" → open panel and launch camera / water dashboard
        Intent uploadIntent = ReminderPlugin.buildTaskPanelIntent(this, activityType, taskId, true);
        PendingIntent uploadPi = PendingIntent.getActivity(
                this,
                9006,
                uploadIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        // Full-screen intent → opens AlarmFullScreenActivity on top of lock screen
        Intent fullScreenIntent = new Intent(this, AlarmFullScreenActivity.class);
        fullScreenIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_NO_USER_ACTION);
        fullScreenIntent.putExtra(EXTRA_TITLE,        title);
        fullScreenIntent.putExtra(EXTRA_MESSAGE,      message);
        fullScreenIntent.putExtra(EXTRA_ACTIVITY_TYPE, activityType);
        fullScreenIntent.putExtra(EXTRA_TASK_ID,       taskId);
        PendingIntent fullScreenPi = PendingIntent.getActivity(
                this,
                9005,
                fullScreenIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        // Wellness Valley logo as large icon
        Bitmap largeLogo = BitmapFactory.decodeResource(getResources(), R.mipmap.ic_launcher);

        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_notification)
                .setLargeIcon(largeLogo)
                .setContentTitle(title)
                .setContentText(message)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(message))
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setOngoing(true)             // Cannot be swiped away while alarm rings
                .setAutoCancel(false)
                .setContentIntent(openPi)
                .setFullScreenIntent(fullScreenPi, true)   // ← pops up full screen immediately
                .addAction(R.drawable.ic_notification, "Upload Now", uploadPi)
                .addAction(R.drawable.ic_notification, "⏰ Snooze 5 min", snoozePi)
                .addAction(R.drawable.ic_notification, "✖ Dismiss", dismissPi)
                .build();
    }

    private void ensureAlarmChannel(NotificationManager nm) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && nm != null) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    CHANNEL_NAME,
                    NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription("Alarm sound for Wellness Valley activity reminders");
            channel.enableVibration(false); // We handle vibration manually
            channel.setSound(null, null);   // We handle sound manually via MediaPlayer
            channel.setShowBadge(true);
            nm.createNotificationChannel(channel);
        }
    }
}
