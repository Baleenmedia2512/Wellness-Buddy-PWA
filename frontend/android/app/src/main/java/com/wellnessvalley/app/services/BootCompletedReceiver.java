package com.wellnessvalley.app.services;

import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.util.Log;
import androidx.work.Constraints;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;
import java.util.concurrent.TimeUnit;

/**
 * BootCompletedReceiver
 * 
 * Starts GalleryMonitorService when device boots up.
 * Also schedules the periodic heartbeat worker to ensure service stays alive.
 * 
 * Listens for:
 * - ACTION_BOOT_COMPLETED (all devices)
 * - ACTION_QUICKBOOT_POWERON (HTC/other OEMs)
 * - ACTION_LOCKED_BOOT_COMPLETED (direct boot aware)
 */
public class BootCompletedReceiver extends BroadcastReceiver {
    private static final String TAG = "BootCompletedReceiver";

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        
        if (Intent.ACTION_BOOT_COMPLETED.equals(action) ||
            "android.intent.action.QUICKBOOT_POWERON".equals(action) ||
            (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N && 
             Intent.ACTION_LOCKED_BOOT_COMPLETED.equals(action))) {
            
            Log.d(TAG, "📱 Device boot detected — starting background service silently");
            
            // ✅ Start GalleryMonitorService silently on boot
            Intent serviceIntent = new Intent(context, GalleryMonitorService.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(serviceIntent);
            } else {
                context.startService(serviceIntent);
            }
            
            // Schedule heartbeat system to keep service alive
            scheduleHeartbeat(context);
            
            Log.d(TAG, "✅ Background service started and heartbeat scheduled");
        }
    }
    
    /**
     * Schedule heartbeat system (WorkManager only)
     * 
     * WorkManager is battery-efficient and sufficient for keeping the service alive.
     * Previously used a dual AlarmManager layer which caused restart thrashing
     * and ForegroundServiceStartNotAllowedException on Android 12+.
     * 
     * @param context Application context
     */
    public static void scheduleHeartbeat(Context context) {
        Log.d(TAG, "⏰ Scheduling WorkManager heartbeat for service auto-restart");
        
        // Cancel any previously-scheduled AlarmManager heartbeat to stop
        // the self-perpetuating alarm loop that causes restart thrashing
        cancelAlarmManagerHeartbeat(context);
        
        // Schedule WorkManager heartbeat (every 15 minutes)
        scheduleWorkManagerHeartbeat(context);
        
        Log.d(TAG, "✅ Heartbeat system scheduled");
    }
    
    /**
     * Public entry point: cancel the legacy AlarmManager heartbeat.
     * Called from MainActivity.onCreate() and GalleryMonitorService.onCreate()
     * so that existing users who update without force-stopping get the old
     * self-perpetuating alarm killed at the earliest possible moment.
     */
    public static void cancelLegacyAlarm(Context context) {
        cancelAlarmManagerHeartbeat(context);
    }

    /**
     * Cancel any existing AlarmManager heartbeat to prevent restart thrashing.
     * Previously a dual AlarmManager+WorkManager system was used, but the
     * self-perpetuating alarm caused ForegroundServiceStartNotAllowedException
     * crash loops on Android 12+.
     */
    private static void cancelAlarmManagerHeartbeat(Context context) {
        try {
            android.app.AlarmManager alarmManager = (android.app.AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
            if (alarmManager == null) return;
            
            Intent intent = new Intent(context, ServiceAlarmReceiver.class);
            intent.setAction("com.wellnessvalley.app.ACTION_SERVICE_HEARTBEAT");
            PendingIntent pendingIntent = PendingIntent.getBroadcast(
                context, 1001, intent,
                PendingIntent.FLAG_NO_CREATE | PendingIntent.FLAG_IMMUTABLE
            );
            if (pendingIntent != null) {
                alarmManager.cancel(pendingIntent);
                pendingIntent.cancel();
                Log.d(TAG, "✅ Cancelled legacy AlarmManager heartbeat");
            }
        } catch (Exception e) {
            Log.w(TAG, "⚠️ Failed to cancel AlarmManager heartbeat", e);
        }
    }
    
    /**
     * Schedule WorkManager heartbeat (Layer 1 - Battery Efficient)
     */
    private static void scheduleWorkManagerHeartbeat(Context context) {
        try {
            // Define constraints - minimal restrictions for maximum reliability
            Constraints constraints = new Constraints.Builder()
                .setRequiresBatteryNotLow(false)  // Run even on low battery
                .setRequiresCharging(false)        // Run on battery power
                .setRequiresDeviceIdle(false)      // Run even when device is active
                .setRequiresStorageNotLow(false)   // Run even on low storage
                .build();
            
            // Create periodic work request - runs every 5-15 minutes (TESTING MODE)
            PeriodicWorkRequest heartbeatWork = new PeriodicWorkRequest.Builder(
                    ServiceHeartbeatWorker.class,
                    15,  // Minimum allowed by WorkManager
                    TimeUnit.MINUTES,
                    10,  // Flex interval - allows execution between 5-15 min mark
                    TimeUnit.MINUTES
                )
                .setConstraints(constraints)
                .addTag("service_heartbeat")
                .addTag("wellness_valley_background")
                .build();
            
            // Enqueue the work - REPLACE policy to update the interval
            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                "GalleryMonitorHeartbeat",
                ExistingPeriodicWorkPolicy.REPLACE,
                heartbeatWork
            );
            
            Log.d(TAG, "   ✅ WorkManager heartbeat scheduled");
            
        } catch (Exception e) {
            Log.e(TAG, "   ❌ Failed to schedule WorkManager heartbeat", e);
        }
    }
    
}
