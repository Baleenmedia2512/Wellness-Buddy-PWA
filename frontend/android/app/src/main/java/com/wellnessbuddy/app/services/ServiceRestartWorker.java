package com.wellnessbuddy.app.services;

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
        Log.d(TAG, "Restarting GalleryMonitorService via WorkManager...");
        
        try {
            Intent intent = new Intent(getApplicationContext(), GalleryMonitorService.class);
            intent.setPackage(getApplicationContext().getPackageName());
            
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                getApplicationContext().startForegroundService(intent);
            } else {
                getApplicationContext().startService(intent);
            }
            
            return Result.success();
        } catch (Exception e) {
            Log.e(TAG, "Failed to restart service", e);
            return Result.retry();
        }
    }
}