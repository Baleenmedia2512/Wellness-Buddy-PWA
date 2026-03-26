package com.wellnessvalley.app.services;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.SystemClock;
import android.util.Log;
import android.app.ActivityManager;

/**
 * ServiceAlarmReceiver
 * 
 * AlarmManager-based heartbeat for GalleryMonitorService.
 * This is a MORE AGGRESSIVE fallback to WorkManager.
 * 
 * Why this exists:
 * - WorkManager can be cleared by force-stop on some devices
 * - AlarmManager is more persistent and harder to kill
 * - Runs every 15 minutes (same as WorkManager for consistency)
 * 
 * Trade-offs:
 * - Battery-optimized (only 96 checks per day vs 288 at 5-min interval)
 * - Requires SCHEDULE_EXACT_ALARM permission on Android 12+
 * - More reliable restart after force-stop
 * 
 * Architecture: Hybrid Defense
 * ┌─ Layer 1: WorkManager (battery-efficient, 5-15 min)
 * └─ Layer 2: AlarmManager (exact timing, 15 min) ← THIS FILE
 */
public class ServiceAlarmReceiver extends BroadcastReceiver {
    private static final String TAG = "ServiceAlarmReceiver";
    private static final String ACTION_HEARTBEAT = "com.wellnessvalley.app.ACTION_SERVICE_HEARTBEAT";
    private static final int HEARTBEAT_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes (battery optimized)
    private static final int REQUEST_CODE = 1001;

    @Override
    public void onReceive(Context context, Intent intent) {
        if (ACTION_HEARTBEAT.equals(intent.getAction())) {
            Log.d(TAG, "⏰ AlarmManager heartbeat fired at " + new java.util.Date());
            performHeartbeatCheck(context);
            
            // Reschedule the alarm (self-perpetuating)
            scheduleNextAlarm(context);
        }
    }

    /**
     * Check if GalleryMonitorService is running and restart if needed
     */
    private void performHeartbeatCheck(Context context) {
        // ✅ Check if service is running
        if (!isServiceRunning(context, GalleryMonitorService.class)) {
            Log.w(TAG, "⚠️ Service not running, restarting...");
            restartService(context);
        } else {
            Log.d(TAG, "✅ Service is running");
        }
    }

    /**
     * Check if a specific service is currently running
     */
    private boolean isServiceRunning(Context context, Class<?> serviceClass) {
        ActivityManager manager = (ActivityManager) context.getSystemService(Context.ACTIVITY_SERVICE);
        if (manager == null) return false;
        
        try {
            for (ActivityManager.RunningServiceInfo service : manager.getRunningServices(Integer.MAX_VALUE)) {
                if (serviceClass.getName().equals(service.service.getClassName())) {
                    return true;
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "❌ Error checking running services", e);
        }
        return false;
    }

    /**
     * Restart the GalleryMonitorService
     */
    private void restartService(Context context) {
        Intent serviceIntent = new Intent(context, GalleryMonitorService.class);
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(serviceIntent);
            } else {
                context.startService(serviceIntent);
            }
            Log.d(TAG, "✅ Service restart initiated (AlarmManager)");
        } catch (Exception e) {
            Log.e(TAG, "❌ Failed to restart service", e);
        }
    }

    /**
     * Schedule the next alarm to fire in 15 minutes
     */
    private void scheduleNextAlarm(Context context) {
        try {
            AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
            if (alarmManager == null) {
                Log.e(TAG, "❌ AlarmManager is null");
                return;
            }

            Intent intent = new Intent(context, ServiceAlarmReceiver.class);
            intent.setAction(ACTION_HEARTBEAT);
            
            PendingIntent pendingIntent = PendingIntent.getBroadcast(
                context,
                REQUEST_CODE,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );

            long triggerAtMillis = SystemClock.elapsedRealtime() + HEARTBEAT_INTERVAL_MS;

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                // Android 12+ - Use exact alarm (requires permission)
                if (alarmManager.canScheduleExactAlarms()) {
                    alarmManager.setExactAndAllowWhileIdle(
                        AlarmManager.ELAPSED_REALTIME_WAKEUP,
                        triggerAtMillis,
                        pendingIntent
                    );
                    Log.d(TAG, "✅ Exact alarm scheduled for 15 minutes (Android 12+)");
                } else {
                    // Fallback to inexact if permission denied
                    alarmManager.setAndAllowWhileIdle(
                        AlarmManager.ELAPSED_REALTIME_WAKEUP,
                        triggerAtMillis,
                        pendingIntent
                    );
                    Log.w(TAG, "⚠️ Inexact alarm scheduled (exact alarm permission denied)");
                }
            } else {
                // Android 11 and below - Exact alarms don't require permission
                alarmManager.setExactAndAllowWhileIdle(
                    AlarmManager.ELAPSED_REALTIME_WAKEUP,
                    triggerAtMillis,
                    pendingIntent
                );
                Log.d(TAG, "✅ Exact alarm scheduled for 15 minutes");
            }
        } catch (Exception e) {
            Log.e(TAG, "❌ Failed to schedule alarm", e);
        }
    }

    /**
     * Start the AlarmManager heartbeat system
     * Call this from MainActivity.onCreate() or BootCompletedReceiver
     */
    public static void scheduleAlarmHeartbeat(Context context) {
        Log.d(TAG, "🚀 Starting AlarmManager heartbeat system...");
        
        try {
            AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
            if (alarmManager == null) {
                Log.e(TAG, "❌ AlarmManager is null, cannot schedule");
                return;
            }

            Intent intent = new Intent(context, ServiceAlarmReceiver.class);
            intent.setAction(ACTION_HEARTBEAT);
            
            PendingIntent pendingIntent = PendingIntent.getBroadcast(
                context,
                REQUEST_CODE,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );

            // First alarm fires in 15 minutes
            long triggerAtMillis = SystemClock.elapsedRealtime() + HEARTBEAT_INTERVAL_MS;

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                // Android 12+ - Check permission
                if (alarmManager.canScheduleExactAlarms()) {
                    alarmManager.setExactAndAllowWhileIdle(
                        AlarmManager.ELAPSED_REALTIME_WAKEUP,
                        triggerAtMillis,
                        pendingIntent
                    );
                    Log.d(TAG, "✅ AlarmManager heartbeat scheduled (15-min interval, exact)");
                } else {
                    alarmManager.setAndAllowWhileIdle(
                        AlarmManager.ELAPSED_REALTIME_WAKEUP,
                        triggerAtMillis,
                        pendingIntent
                    );
                    Log.w(TAG, "⚠️ AlarmManager heartbeat scheduled (inexact - may be delayed)");
                    Log.w(TAG, "   Tip: Grant 'Alarms & reminders' permission in Settings for exact timing");
                }
            } else {
                alarmManager.setExactAndAllowWhileIdle(
                    AlarmManager.ELAPSED_REALTIME_WAKEUP,
                    triggerAtMillis,
                    pendingIntent
                );
                Log.d(TAG, "✅ AlarmManager heartbeat scheduled (15-min interval)");
            }
            
            Log.d(TAG, "   Next check at: " + new java.util.Date(System.currentTimeMillis() + HEARTBEAT_INTERVAL_MS));
        } catch (Exception e) {
            Log.e(TAG, "❌ Failed to schedule AlarmManager heartbeat", e);
        }
    }

    /**
     * Cancel the AlarmManager heartbeat (for cleanup/testing)
     */
    public static void cancelAlarmHeartbeat(Context context) {
        try {
            AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
            if (alarmManager == null) return;

            Intent intent = new Intent(context, ServiceAlarmReceiver.class);
            intent.setAction(ACTION_HEARTBEAT);
            
            PendingIntent pendingIntent = PendingIntent.getBroadcast(
                context,
                REQUEST_CODE,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );

            alarmManager.cancel(pendingIntent);
            Log.d(TAG, "🛑 AlarmManager heartbeat cancelled");
        } catch (Exception e) {
            Log.e(TAG, "❌ Failed to cancel alarm", e);
        }
    }
}
