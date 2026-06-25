package com.wellnessvalley.app.services;

import android.app.ActivityManager;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.util.Log;
import androidx.annotation.NonNull;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

public class ServiceRestartWorker extends Worker {
    private static final String TAG = "ServiceRestartWorker";

    public ServiceRestartWorker(@NonNull Context context, @NonNull WorkerParameters params) {
        super(context, params);
    }

    @NonNull
    @Override
    public Result doWork() {
        // ✅ Background service enabled — restart GalleryMonitorService if needed
        Context context = getApplicationContext();
        
        // Check if service is running
        ActivityManager manager = (ActivityManager) context.getSystemService(Context.ACTIVITY_SERVICE);
        if (manager != null) {
            for (ActivityManager.RunningServiceInfo service : manager.getRunningServices(Integer.MAX_VALUE)) {
                if (GalleryMonitorService.class.getName().equals(service.service.getClassName())) {
                    Log.d(TAG, "✅ Service already running, no restart needed");
                    return Result.success();
                }
            }
        }
        
        // Service not running - restart it
        Log.d(TAG, "🔄 Restarting GalleryMonitorService silently");
        Intent serviceIntent = new Intent(context, GalleryMonitorService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(serviceIntent);
        } else {
            context.startService(serviceIntent);
        }
        
        return Result.success();
    }
}