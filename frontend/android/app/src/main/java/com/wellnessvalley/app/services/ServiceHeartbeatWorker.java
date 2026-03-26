package com.wellnessvalley.app.services;

import android.app.ActivityManager;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.util.Log;
import androidx.annotation.NonNull;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

/**
 * ServiceHeartbeatWorker
 * 
 * Periodic background worker that checks if GalleryMonitorService is running.
 * If the service is not running, it automatically restarts it.
 * 
 * This ensures the service stays alive even after:
 * - Force-stop by user
 * - System killing due to memory pressure
 * - Battery optimization interventions
 * 
 * Runs every 15 minutes (minimum allowed by WorkManager).
 * Battery impact: ~1-3% per day (minimal compared to the service itself).
 * 
 * @see BootCompletedReceiver#scheduleHeartbeat(Context) for scheduling
 */
public class ServiceHeartbeatWorker extends Worker {
    private static final String TAG = "ServiceHeartbeatWorker";

    public ServiceHeartbeatWorker(@NonNull Context context, @NonNull WorkerParameters params) {
        super(context, params);
    }

    @NonNull
    @Override
    public Result doWork() {
        // ❌ Background service disabled — do NOT restart GalleryMonitorService
        Log.d(TAG, "ℹ️ Heartbeat worker fired but service auto-restart is disabled");
        return Result.success();
    }

    /**
     * Check if a specific service is currently running
     * 
     * @param context Application context
     * @param serviceClass The service class to check
     * @return true if service is running, false otherwise
     */
    private boolean isServiceRunning(Context context, Class<?> serviceClass) {
        ActivityManager manager = (ActivityManager) context.getSystemService(Context.ACTIVITY_SERVICE);
        if (manager == null) {
            Log.e(TAG, "❌ ActivityManager is null");
            return false;
        }
        
        try {
            // Get list of all running services
            for (ActivityManager.RunningServiceInfo service : manager.getRunningServices(Integer.MAX_VALUE)) {
                if (serviceClass.getName().equals(service.service.getClassName())) {
                    Log.d(TAG, "Service found in running services list");
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
     * Uses startForegroundService() for Android 8.0+ compatibility
     */
    private void restartService() {
        Context context = getApplicationContext();
        Intent serviceIntent = new Intent(context, GalleryMonitorService.class);
        
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                // Android 8.0+ requires startForegroundService for foreground services
                context.startForegroundService(serviceIntent);
                Log.d(TAG, "✅ Service restart initiated via startForegroundService()");
            } else {
                // Older Android versions use regular startService
                context.startService(serviceIntent);
                Log.d(TAG, "✅ Service restart initiated via startService()");
            }
        } catch (IllegalStateException e) {
            // This can happen if app is in background on Android 8.0+
            Log.e(TAG, "❌ Cannot start service - app may be in background", e);
        } catch (Exception e) {
            Log.e(TAG, "❌ Failed to restart service", e);
        }
    }
}
