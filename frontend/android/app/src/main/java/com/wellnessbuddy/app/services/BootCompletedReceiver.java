package com.wellnessvalley.app.services;

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
            
            Log.d(TAG, "📱 Device boot detected (action: " + action + ")");
            Log.d(TAG, "Starting GalleryMonitorService...");
            
            // Start the gallery monitor foreground service
            Intent serviceIntent = new Intent(context, GalleryMonitorService.class);
            serviceIntent.setPackage(context.getPackageName());
            
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(serviceIntent);
                } else {
                    context.startService(serviceIntent);
                }
                Log.d(TAG, "✅ GalleryMonitorService started successfully");
            } catch (Exception e) {
                Log.e(TAG, "❌ Failed to start GalleryMonitorService on boot", e);
            }
            
            // Schedule periodic heartbeat to keep service alive
            scheduleHeartbeat(context);
        }
    }
    
    /**
     * Schedule HYBRID heartbeat system (WorkManager + AlarmManager)
     * 
     * Two-layer defense:
     * 1. WorkManager (battery-efficient, may be cleared by force-stop)
     * 2. AlarmManager (aggressive, survives force-stop better)
     * 
     * This ensures the service automatically restarts if killed by the system.
     * 
     * @param context Application context
     */
    public static void scheduleHeartbeat(Context context) {
        Log.d(TAG, "⏰ Scheduling HYBRID heartbeat system...");
        
        // Layer 1: WorkManager (battery-friendly)
        scheduleWorkManagerHeartbeat(context);
        
        // Layer 2: AlarmManager (aggressive fallback)
        ServiceAlarmReceiver.scheduleAlarmHeartbeat(context);
        
        Log.d(TAG, "✅ Hybrid heartbeat system activated");
        Log.d(TAG, "   → WorkManager: 5-15 min (battery-efficient)");
        Log.d(TAG, "   → AlarmManager: 15 min (battery-optimized)");
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
                .addTag("wellness_buddy_background")
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
