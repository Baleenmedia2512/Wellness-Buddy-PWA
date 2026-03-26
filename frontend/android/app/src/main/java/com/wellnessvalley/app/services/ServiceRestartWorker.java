package com.wellnessvalley.app.services;

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
        // ❌ Background service disabled — do NOT restart GalleryMonitorService
        Log.d(TAG, "ℹ️ ServiceRestartWorker fired but service auto-restart is disabled");
        return Result.success();
    }
}