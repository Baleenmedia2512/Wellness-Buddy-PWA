package com.wellnessvalley.app.services;
import com.wellnessvalley.app.R;
import com.wellnessvalley.app.BuildConfig;

import android.app.usage.UsageStats;
import android.app.usage.UsageStatsManager;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.IntentFilter;
import java.util.Calendar;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.location.LocationManager;
import android.content.pm.ServiceInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.provider.MediaStore;
import android.provider.Settings;
import android.util.Log;
import android.widget.Toast;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

import com.wellnessvalley.app.MainActivity;
import android.content.SharedPreferences;

import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.util.Arrays;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import org.json.JSONObject;
import org.json.JSONArray;

public class GalleryMonitorService extends Service implements SensorEventListener {
    private static final String TAG = "GalleryMonitorService";
    private static final String CHANNEL_ID = "GalleryMonitorChannel";
    private static final int NOTIFICATION_ID = 101;

    // ── Step Tracking ──────────────────────────────────────────────────────────
    private static final String STEPS_PREFS       = "WellnessSteps";
    // Last successfully persisted step total per day (single-writer dedup guard).
    private static final String STEP_LAST_SAVED_PREFIX = "step_last_saved_";
    // Anti-fake: physiological maximum steps per day (covers ultramarathon athletes).
    private static final int DAILY_STEP_HARD_CAP  = 80_000;
    // Anti-fake: max plausible step increase between two consecutive 30-s DB saves.
    // 300 steps/30 s = 600 steps/min — beyond any human sprinting capability.
    private static final int MAX_STEPS_PER_SAVE_WINDOW = 300;

    // ── Walking Detection Notification ─────────────────────────────────────────
    private static final String WALK_CHANNEL_ID            = "WalkingDetectChannel";
    private static final int    WALK_NOTIFICATION_ID       = 2001;
    // 12-second window: ≥15 steps = user is walking
    private static final long   WALK_DETECT_WINDOW_MS      = 12_000L;
    private static final int    WALK_NOTIFY_STEP_THRESHOLD = 15;
    // Minimum gap between successive walking notifications (10 minutes)
    private static final long   WALK_NOTIFY_COOLDOWN_MS    = 10 * 60 * 1000L;

    // ── Screen Time Tracking ───────────────────────────────────────────────────
    private static final String SCREEN_PREFS      = "WellnessScreen";
    private SensorManager stepSensorManager;
    private Sensor        stepSensor;
    private String        stepCurrentDate     = "";
    private int           stepLastSensorTotal = -1; // -1 = not yet received any reading
    private int           stepStoredBaseline  = -1; // steps already in SharedPrefs at start of this service session
    private BroadcastReceiver dateChangeReceiver;
    private BroadcastReceiver locationChangeReceiver;
    // Prevent overlapping step-save API calls from timer/destroy/intent paths.
    private final AtomicBoolean stepSaveInProgress = new AtomicBoolean(false);

    // ── Walking Detection state ────────────────────────────────────────────────
    private long walkDetectWindowStartMs    = 0L; // 0 = window not yet open
    private int  walkDetectWindowStartSteps = 0;
    private long walkNotifyLastShownMs      = 0L;

    private ExecutorService executorService;
    private ScheduledExecutorService scheduledExecutor;
    private DatabaseSyncClient databaseSyncClient;

    // ── GPS Tracking (writes to WellnessGPS SharedPrefs for map display) ────────
    private com.google.android.gms.location.FusedLocationProviderClient fusedLocationClient;
    private com.google.android.gms.location.LocationCallback gpsLocationCallback;

    // Database API configuration
    private static final String DEFAULT_API_BASE_URL = "https://wellness-buddy-pwa-backend-test.vercel.app";

    @Override
    public void onCreate() {
        super.onCreate();
        Log.d(TAG, "Service created");

        createNotificationChannel();

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            int fgType = ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) { // API 34+
                fgType |= ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION;
            }
            startForeground(NOTIFICATION_ID, createNotification(), fgType);
        } else {
            startForeground(NOTIFICATION_ID, createNotification());
        }

        Toast.makeText(this, "Wellness Valley Service Running", Toast.LENGTH_SHORT).show();

        executorService = Executors.newSingleThreadExecutor();
        scheduledExecutor = Executors.newScheduledThreadPool(2);
        
        // Initialize database sync client
        String apiBaseUrl = resolveApiBaseUrl();
        databaseSyncClient = new DatabaseSyncClient(apiBaseUrl, this);
        Log.d(TAG, "Using API_BASE_URL for background sync: " + apiBaseUrl);
        
        // Test database connection
        executorService.execute(() -> {
            boolean connected = databaseSyncClient.testConnection();
            Log.d(TAG, connected ? "✅ Database connection successful" : "❌ Database connection failed");
        });

        // ✅ Step tracking — start sensor + schedule 30-sec DB saves
        initStepTracking();
        scheduledExecutor.scheduleAtFixedRate(this::saveStepsToDB, 30, 30, TimeUnit.SECONDS);

        // ✅ GPS tracking — writes lat/lng/isOutdoor to WellnessGPS SharedPrefs for map display
        initGpsTracking();

        // ✅ Auto-cancel walking notification when user enables location
        locationChangeReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                try {
                    LocationManager lm = (LocationManager) getSystemService(Context.LOCATION_SERVICE);
                    if (lm == null) return;
                    boolean gps = false;
                    boolean net = false;
                    try { gps = lm.isProviderEnabled(LocationManager.GPS_PROVIDER); } catch (Exception ignored) {}
                    try { net = lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER); } catch (Exception ignored) {}
                    if (gps || net) {
                        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
                        if (nm != null) {
                            nm.cancel(WALK_NOTIFICATION_ID);
                            Log.d(TAG, "✅ Location enabled — walking notification dismissed");
                        }
                    }
                } catch (Exception e) {
                    Log.w(TAG, "⚠️ locationChangeReceiver error: " + e.getMessage());
                }
            }
        };
        registerReceiver(locationChangeReceiver,
                new android.content.IntentFilter(LocationManager.PROVIDERS_CHANGED_ACTION));

        // ✅ Screen time tracking — query UsageStats + schedule 60-sec DB saves
        scheduledExecutor.scheduleAtFixedRate(this::saveScreenTimeToDB, 60, 60, TimeUnit.SECONDS);

        // ✅ Register ContentObserver to detect image changes
        imageObserver = new ContentObserver(new Handler(Looper.getMainLooper())) {
            @Override
            public void onChange(boolean selfChange, @Nullable Uri uri) {
                super.onChange(selfChange, uri);
                Log.d(TAG, "📸 MediaStore content change detected: " + uri);
                executorService.execute(() -> checkGalleryForNewImages());
            }
        };

        getContentResolver().registerContentObserver(
                MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
                true,
                imageObserver
        );
    }

    private Notification createNotification() {
        Intent notificationIntent = new Intent(this, MainActivity.class);

        PendingIntent pendingIntent = PendingIntent.getActivity(
                this, 0, notificationIntent,
                Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
                        ? PendingIntent.FLAG_IMMUTABLE
                        : 0
        );

        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("Wellness Valley")
                .setContentText("Running in background")
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentIntent(pendingIntent)
                .setOngoing(true)
                .setPriority(NotificationCompat.PRIORITY_MIN)
                .setVisibility(NotificationCompat.VISIBILITY_SECRET)
                .setSilent(true)
                .build();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "Background Service",
                    NotificationManager.IMPORTANCE_MIN
            );
            channel.setDescription("Keeps wellness tracking running in background");
            channel.enableLights(false);
            channel.enableVibration(false);
            channel.setShowBadge(false);
            channel.setSound(null, null);

            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
                Log.d(TAG, "✅ Notification channel created: " + CHANNEL_ID);

                // ── High-priority channel for walking detection ──────────────
                NotificationChannel walkChannel = new NotificationChannel(
                        WALK_CHANNEL_ID,
                        "Walking Activity",
                        NotificationManager.IMPORTANCE_HIGH
                );
                walkChannel.setDescription("Notifies when background walking is detected");
                walkChannel.enableVibration(true);
                walkChannel.setVibrationPattern(new long[]{0, 250, 100, 250});
                walkChannel.enableLights(true);
                walkChannel.setShowBadge(true);
                manager.createNotificationChannel(walkChannel);
                Log.d(TAG, "✅ Walking notification channel created: " + WALK_CHANNEL_ID);
            }
        }
    }

    private void scanDirectoryForNewImages(File dir, Consumer<File> callback) {
        File[] files = dir.listFiles();
        if (files == null) return;

        for (File file : files) {
            if (file.isDirectory()) {
                scanDirectoryForNewImages(file, callback); // recurse
            } else if (file.getName().toLowerCase().matches(".*\\.(jpg|jpeg|png)$")) {
                if (file.lastModified() > lastCheckedTime) {
                    callback.accept(file);
                }
            }
        }
    }

    private void checkGalleryForNewImages() {
        Log.d(TAG, "Checking for new images in DCIM/Camera only...");

        // Only monitor DCIM/Camera folder - removed Screenshots and Downloads
        File dcimDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DCIM);
        File cameraDir = new File(dcimDir, "Camera");

        try {
            final File[] latestImage = {null};
            final long[] latestModified = {lastCheckedTime};

            // Check DCIM/Camera folder only
            if (cameraDir.exists() && cameraDir.isDirectory()) {
                Log.d(TAG, "📂 Scanning: " + cameraDir.getAbsolutePath());
                scanDirectoryForNewImages(cameraDir, imageFile -> {
                    if (imageFile != null && imageFile.lastModified() > latestModified[0]) {
                        latestImage[0] = imageFile;
                        latestModified[0] = imageFile.lastModified();
                    }
                });
            } else {
                Log.d(TAG, "⚠️ Camera folder not found: " + cameraDir.getAbsolutePath());
            }

            if (latestImage[0] != null) {
                Log.d(TAG, "🆕 New image detected: " + latestImage[0].getAbsolutePath());
                if (isFoodImage(latestImage[0])) {
                    handleFoodImage(latestImage[0].getAbsolutePath());
                }
                lastCheckedTime = latestModified[0];
            }

        } catch (Exception e) {
            Log.e(TAG, "Error checking gallery", e);
        }
    }

    // Always send images to Gemini API for food detection
    private boolean isFoodImage(File imageFile) {
        return true;
    }

    private void handleFoodImage(String imagePath) {
        foodImageQueue.add(imagePath);
        Log.d(TAG, "Image queued for analysis: " + imagePath);
        // Try to process immediately if network is available
        if (isNetworkAvailable()) {
            executorService.execute(this::processQueuedImages);
        }
    }

    private boolean isNetworkAvailable() {
        android.net.ConnectivityManager cm = (android.net.ConnectivityManager) getSystemService(CONNECTIVITY_SERVICE);
        android.net.NetworkInfo activeNetwork = cm.getActiveNetworkInfo();
        return activeNetwork != null && activeNetwork.isConnected();
    }

    // No longer needed: JS will poll for queued images
    private void processQueuedImages() {
        Log.d(TAG, "Processing queued images for Gemini analysis...");
        if (geminiApiClient == null) {
            Log.d(TAG, "Gemini API not available, skipping image analysis.");
            return;
        }
        if (!isNetworkAvailable()) {
            Log.d(TAG, "Network unavailable, skipping analysis.");
            return;
        }
        
        java.util.Set<String> queueSet = foodImageQueue.getQueue();
        java.util.List<String> queue = new java.util.ArrayList<>(queueSet);
        
        for (String imagePath : queue) {
            Log.d(TAG, "Analyzing image: " + imagePath);
            String result = geminiApiClient.analyzeImage(imagePath);

            // 🆕 Save to MariaDB database in background thread, with imageBase64
            final String currentUserId = getCurrentUserId();
            final String imageBase64 = DatabaseSyncClient.encodeImageToBase64(imagePath);
            executorService.execute(() -> {
                boolean saved = databaseSyncClient.saveAnalysis(
                    currentUserId,                    // User ID from SharedPreferences
                    imagePath,                        // Full image path
                    result,                           // Gemini JSON response
                    System.currentTimeMillis(),       // Timestamp
                    "Android Background Service",    // Device info
                    imageBase64                       // Image as base64
                );

                if (saved) {
                    Log.d(TAG, "✅ Analysis saved to MariaDB successfully for user: " + currentUserId);

                    // 🚨 DEBUG: Show success notification (removable for production)
                    if (SHOW_DEBUG_SUCCESS_NOTIFICATIONS) {
                        // Post notification on main thread to ensure it's shown
                        new Handler(Looper.getMainLooper()).post(() -> {
                            showDatabaseSuccessNotification(imagePath, currentUserId);
                        });
                    }
                } else {
                    Log.w(TAG, "❌ Failed to save to MariaDB, adding to retry queue");
                    retryQueue.add(currentUserId, imagePath, result, System.currentTimeMillis());
                }
            });

            showAnalysisNotification(imagePath, result);
            foodImageQueue.remove(imagePath);
        }
    }
    
    // ── STEP TRACKING IMPLEMENTATION ────────────────────────────────────────────────

    /** Register the hardware TYPE_STEP_COUNTER sensor. */
    private void initStepTracking() {
        stepSensorManager = (SensorManager) getSystemService(Context.SENSOR_SERVICE);
        if (stepSensorManager == null) {
            Log.w(TAG, "⚠️ SensorManager unavailable - step tracking disabled");
            return;
        }
        stepSensor = stepSensorManager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER);
        if (stepSensor == null) {
            Log.w(TAG, "⚠️ No TYPE_STEP_COUNTER sensor - step tracking disabled");
            return;
        }
        boolean ok = stepSensorManager.registerListener(this, stepSensor, SensorManager.SENSOR_DELAY_NORMAL);
        Log.d(TAG, ok ? "✅ Step sensor registered" : "❌ Step sensor registration failed");
        stepCurrentDate = getTodayDateKey();

        // Register for system date/time changes so day rollover works even when no
        // step fires (e.g. manual date change, midnight crossing without walking).
        dateChangeReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                String newDay = getTodayDateKey();
                if (!newDay.equals(stepCurrentDate)) {
                    Log.d(TAG, "🌙 [Steps] Date-change broadcast → rolling over " + stepCurrentDate + " → " + newDay);
                    final String oldDate = stepCurrentDate;
                    // Save the old day's steps to DB on a background thread (network call)
                    executorService.execute(() -> saveStepsToDBForDate(oldDate));
                    // Preserve existing value if user manually jumps back to an old date.
                    // Resetting to 0 here would erase valid history for that day.
                    SharedPreferences prefs = getSharedPreferences(STEPS_PREFS, MODE_PRIVATE);
                    int existing = prefs.getInt("step_daily_" + newDay, 0);
                    stepStoredBaseline  = existing;
                    stepLastSensorTotal = -1; // re-anchors on the first step of the new day
                    stepCurrentDate     = newDay;
                }
            }
        };
        android.content.IntentFilter dateFilter = new android.content.IntentFilter();        dateFilter.addAction(Intent.ACTION_DATE_CHANGED);
        dateFilter.addAction(Intent.ACTION_TIME_CHANGED);
        dateFilter.addAction(Intent.ACTION_TIMEZONE_CHANGED);
        registerReceiver(dateChangeReceiver, dateFilter);
        Log.d(TAG, "✅ Date-change receiver registered");
    }

    /**
     * Called by the hardware sensor on every step.
     * Persists a per-day step count in SharedPreferences under
     * key "step_daily_YYYY-MM-DD" so the front-end can read it via
     * StepCounterPlugin.getBackgroundStepHistory().
     */
    @Override
    public void onSensorChanged(SensorEvent event) {
        if (event.sensor.getType() != Sensor.TYPE_STEP_COUNTER) return;

        int sensorTotal = (int) event.values[0];
        String today    = getTodayDateKey();

        // Day rollover: reset baseline at midnight
        if (!today.equals(stepCurrentDate)) {
            Log.d(TAG, "🌙 [Steps] Day rollover " + stepCurrentDate + " → " + today);
            // Save the OLD day's final value explicitly before switching day.
            final String oldDate = stepCurrentDate;
            if (executorService != null) {
                executorService.execute(() -> saveStepsToDBForDate(oldDate));
            } else {
                saveStepsToDBForDate(oldDate);
            }
            stepLastSensorTotal = sensorTotal; // new day baseline = current total
            SharedPreferences prefs = getSharedPreferences(STEPS_PREFS, MODE_PRIVATE);
            stepStoredBaseline  = prefs.getInt("step_daily_" + today, 0);
            stepCurrentDate = today;
            return;
        }

        // Sensor reset (device reboot): cumulative sensor total decreased.
        // Re-anchor both baselines so new steps accumulate correctly.
        if (stepLastSensorTotal > 0 && sensorTotal < stepLastSensorTotal) {
            Log.d(TAG, "🔄 [Steps] Sensor reset detected (" + stepLastSensorTotal + " → " + sensorTotal + ")");
            SharedPreferences resetPrefs = getSharedPreferences(STEPS_PREFS, MODE_PRIVATE);
            stepStoredBaseline  = resetPrefs.getInt("step_daily_" + today, 0);
            stepLastSensorTotal = sensorTotal;
        }

        // First reading of this service session — capture what is already recorded in
        // SharedPrefs (from a previous session today) so new steps are added on top,
        // not compared with Math.max (which dropped steps when service restarted).
        if (stepLastSensorTotal < 0) {
            SharedPreferences initPrefs = getSharedPreferences(STEPS_PREFS, MODE_PRIVATE);
            stepStoredBaseline  = initPrefs.getInt("step_daily_" + today, 0);
            stepLastSensorTotal = sensorTotal;
            Log.d(TAG, "📍 [Steps] Session start — stored baseline: " + stepStoredBaseline + " sensorTotal: " + sensorTotal);
        }

        // Steps walked since THIS service session started
        int stepsThisSession = Math.max(0, sensorTotal - stepLastSensorTotal);

        // Total today = steps already recorded before this session + steps this session.
        // This correctly handles service restarts: prior sessions' steps are in
        // stepStoredBaseline, so we never lose them and never double-count.
        int newTotal = stepStoredBaseline + stepsThisSession;

        SharedPreferences prefs = getSharedPreferences(STEPS_PREFS, MODE_PRIVATE);
        prefs.edit().putInt("step_daily_" + today, newTotal).apply();

        // Walking detection: piggyback on every sensor event (no extra polling)
        checkWalkingDetection(sensorTotal);
    }

    @Override
    public void onAccuracyChanged(Sensor sensor, int accuracy) { /* not used */ }

    /**
     * POST today's step count to the backend DB.
     * Called every 60 seconds by scheduledExecutor, and on service destroy.
     */
    /**
     * Called via intent from GalleryMonitorPlugin.syncDailySteps() when React
     * detects that SharedPreferences holds stale/phantom data for a day.
     * Resets both the on-disk (SharedPrefs) value and the in-memory baseline so
     * the service stops broadcasting the wrong step count to the backend.
     */
    private synchronized void resetStepsBaseline(String date, int steps) {
        Log.w(TAG, "🔧 [Steps] Baseline reset for " + date + ": " + steps + " (React correction)");
        getSharedPreferences(STEPS_PREFS, MODE_PRIVATE)
                .edit().putInt("step_daily_" + date, steps).apply();
        // If this is today's date, also fix the in-memory tracking state so the
        // next scheduled save uses the corrected baseline instead of the stale one.
        if (date.equals(stepCurrentDate)) {
            stepStoredBaseline = steps;
            // stepLastSensorTotal stays unchanged: sessions steps accumulated since
            // service start are still valid, they just now add on top of `steps`.
        }
    }

    private void saveStepsToDB() {
        saveStepsToDBForDate(getTodayDateKey(), false);
    }

    private void saveStepsToDBForDate(String date) {
        saveStepsToDBForDate(date, false);
    }

    /**
     * @param forceWrite true for correction saves (React syncDailySteps) so the API
     *                   allows writing a lower value to fix inflated DB data.
     *                   false for normal 60-second scheduled saves.
     */
    private void saveStepsToDBForDate(String date, boolean forceWrite) {
        String userId = getCurrentUserId();
        if (userId == null) {
            Log.w(TAG, "⏭️ [Steps] Skip DB save (no valid userId)");
            return;
        }

        SharedPreferences prefs = getSharedPreferences(STEPS_PREFS, MODE_PRIVATE);
        int steps = prefs.getInt("step_daily_" + date, 0);
        if (steps <= 0) {
            Log.d(TAG, "⏭️ [Steps] Skip DB save (steps<=0): date=" + date + " steps=" + steps);
            return;
        }

        // ── Anti-fake: hard daily cap (physiological maximum) ─────────────────
        if (steps > DAILY_STEP_HARD_CAP) {
            Log.w(TAG, "⚠️ [AntiCheat] Daily cap enforced: " + steps + " → " + DAILY_STEP_HARD_CAP);
            steps = DAILY_STEP_HARD_CAP;
            prefs.edit().putInt("step_daily_" + date, steps).apply();
        }

        // ── Anti-fake: step rate anomaly detection (30-s window) ─────────────
        // If steps increased by more than MAX_STEPS_PER_SAVE_WINDOW since last save,
        // it is physically impossible — log a warning but still save (hardware sensor
        // may batch Doze-delayed steps; we trust the Android hardware pedometer).
        int lastSaved = prefs.getInt(STEP_LAST_SAVED_PREFIX + date, -1);
        if (!forceWrite && lastSaved >= 0) {
            int delta = steps - lastSaved;
            if (delta > MAX_STEPS_PER_SAVE_WINDOW) {
                Log.w(TAG, "⚠️ [AntiCheat] Anomalous step burst: +" + delta
                        + " in ~30s for date=" + date + " (may be Doze batch)");
            }
        }

        // Single-writer dedup: skip unchanged values to avoid redundant 60s posts.
        // Always proceed for forceWrite (correction) even if value looks the same.
        if (!forceWrite && lastSaved == steps) {
            Log.d(TAG, "⏭️ [Steps] Skip DB save (unchanged): date=" + date + " steps=" + steps);
            return;
        }

        // Parallel protection: if one save is already running, skip this tick.
        if (!stepSaveInProgress.compareAndSet(false, true)) {
            Log.d(TAG, "⏭️ [Steps] Skip DB save (save already in progress)");
            return;
        }

        try {
            double calories = Math.round(steps * 0.04 * 100.0) / 100.0;
            Log.d(TAG, "💾 [Steps] Saving to DB: userId=" + userId + " date=" + date + " steps=" + steps + (forceWrite ? " [forceWrite]" : ""));
            boolean ok = databaseSyncClient.saveDailySteps(userId, date, steps, calories, forceWrite);
            if (ok) {
                prefs.edit().putInt(STEP_LAST_SAVED_PREFIX + date, steps).apply();
            }
            Log.d(TAG, ok ? "✅ [Steps] DB save OK" : "❌ [Steps] DB save failed");
        } finally {
            stepSaveInProgress.set(false);
        }
    }

    /** Returns today's date as YYYY-MM-DD in the device's local timezone. */
    private String getTodayDateKey() {
        Calendar cal = Calendar.getInstance();
        return String.format(Locale.US, "%04d-%02d-%02d",
                cal.get(Calendar.YEAR),
                cal.get(Calendar.MONTH) + 1,
                cal.get(Calendar.DAY_OF_MONTH));
    }

    // ── END STEP TRACKING ─────────────────────────────────────────────────────

    // ── SCREEN TIME TRACKING IMPLEMENTATION ──────────────────────────────────

    /**
     * Queries UsageStatsManager for total screen time today across all apps.
     * Returns total seconds, or -1 if permission not granted.
     */
    private long queryTodayScreenTimeSeconds() {
        UsageStatsManager usm = (UsageStatsManager) getSystemService(Context.USAGE_STATS_SERVICE);
        if (usm == null) return -1;

        // Window: start of today (midnight) to now
        Calendar startOfDay = Calendar.getInstance();
        startOfDay.set(Calendar.HOUR_OF_DAY, 0);
        startOfDay.set(Calendar.MINUTE, 0);
        startOfDay.set(Calendar.SECOND, 0);
        startOfDay.set(Calendar.MILLISECOND, 0);

        long startMs = startOfDay.getTimeInMillis();
        long endMs   = System.currentTimeMillis();

        Map<String, UsageStats> statsMap = usm.queryAndAggregateUsageStats(startMs, endMs);
        if (statsMap == null || statsMap.isEmpty()) {
            Log.w(TAG, "⚠️ [ScreenTime] UsageStats empty — permission may not be granted");
            return -1;
        }

        long totalMs = 0;
        for (UsageStats stats : statsMap.values()) {
            totalMs += stats.getTotalTimeInForeground();
        }
        return totalMs / 1000; // convert ms → seconds
    }

    /**
     * POST today's screen time to the backend DB.
     * Called every 60 seconds by scheduledExecutor.
     */
    private void saveScreenTimeToDB() {
        String userId = getCurrentUserId();
        if (userId == null) return;

        long totalSeconds = queryTodayScreenTimeSeconds();
        if (totalSeconds < 0) {
            Log.w(TAG, "⚠️ [ScreenTime] Permission not granted — skipping save");
            return;
        }
        if (totalSeconds == 0) return;

        String today = getTodayDateKey();
        // Cache in SharedPreferences so UI can read without network
        getSharedPreferences(SCREEN_PREFS, MODE_PRIVATE)
            .edit().putLong("screen_daily_" + today, totalSeconds).apply();

        Log.d(TAG, "💾 [ScreenTime] Saving to DB: userId=" + userId + " date=" + today + " seconds=" + totalSeconds);
        boolean ok = databaseSyncClient.saveScreenTime(userId, today, totalSeconds);
        Log.d(TAG, ok ? "✅ [ScreenTime] DB save OK" : "❌ [ScreenTime] DB save failed");
    }

    // ── END SCREEN TIME TRACKING ──────────────────────────────────────────────

    // Get current user ID from SharedPreferences and lookup database UserId
    private String resolveApiBaseUrl() {
        SharedPreferences prefs = getSharedPreferences("WellnessValley", MODE_PRIVATE);
        String configured = prefs.getString("api_base_url", null);
        if (configured != null && !configured.trim().isEmpty()) {
            return configured.trim();
        }
        return DEFAULT_API_BASE_URL;
    }

    // Get current user ID from SharedPreferences and lookup database UserId
    private String getCurrentUserId() {
        // MODE_MULTI_PROCESS forces a re-read from disk each call so the :background
        // process always sees the latest value written by the main process.
        @SuppressWarnings("deprecation")
        android.content.SharedPreferences prefs = getSharedPreferences("WellnessValley", MODE_MULTI_PROCESS);
        String userEmail = prefs.getString("current_user_email", null);
        // Log all stored preferences for debugging
        Log.d(TAG, "🔍 SharedPreferences Debug:");
        Log.d(TAG, "  - current_user_email: " + userEmail);
        String cachedDbUserId = prefs.getString("cached_db_user_id", null);
        Log.d(TAG, "  - cached_db_user_id: " + cachedDbUserId);

        // Only allow DB userId (from cache or lookup)
        if (cachedDbUserId != null && !cachedDbUserId.isEmpty()) {
            Log.d(TAG, "✅ Using cached database UserId: " + cachedDbUserId);
            return cachedDbUserId;
        }

        // Try to get database UserId using email lookup (this will cache the result)
        if (userEmail != null && !userEmail.isEmpty()) {
            Log.d(TAG, "🔍 Attempting database lookup for email: " + userEmail);
            String dbUserId = databaseSyncClient.lookupDatabaseUserId(userEmail, null);
            if (dbUserId != null) {
                Log.d(TAG, "✅ Using database UserId from lookup: " + dbUserId + " for email: " + userEmail);
                return dbUserId;
            } else {
                Log.w(TAG, "❌ Database UserId lookup failed for email: " + userEmail);
            }
        }

        // If no DB userId, return null and log error
        Log.e(TAG, "❌ No valid database userId found. Aborting analysis save.");
        return null;
    }

    // Removed: JS will poll for queued images

    @Override
    public void onDestroy() {
        super.onDestroy();
        Log.d(TAG, "Service destroyed");

        // Stop GPS updates
        if (fusedLocationClient != null && gpsLocationCallback != null) {
            try {
                fusedLocationClient.removeLocationUpdates(gpsLocationCallback);
            } catch (Exception e) {
                Log.w(TAG, "Error removing GPS updates: " + e.getMessage());
            }
        }

        // Unregister step sensor
        if (stepSensorManager != null) {
            stepSensorManager.unregisterListener(this);
        }
        // Save final step count before dying
        saveStepsToDB();
        // Save final screen time before dying
        saveScreenTimeToDB();

        if (executorService != null) {
            executorService.shutdown();
        }
        if (scheduledExecutor != null) {
            scheduledExecutor.shutdown();
        }
        if (dateChangeReceiver != null) {
            unregisterReceiver(dateChangeReceiver);
        }
        if (locationChangeReceiver != null) {
            unregisterReceiver(locationChangeReceiver);
        }
        
        // Log final retry queue stats
        if (retryQueue != null) {
            Log.d(TAG, "Service destroyed. Final retry queue stats: " + retryQueue.getQueueStats());
        }
    }
    
    // ❌ DEPRECATED: onTaskRemoved restart mechanism is unreliable
    // This method does NOT fire on force-stop, only when app is removed from Recents
    // Service restart is now handled by ServiceHeartbeatWorker (15-minute periodic check)
    @Override
    public void onTaskRemoved(Intent rootIntent) {
        super.onTaskRemoved(rootIntent);
        Log.d(TAG, "⚠️ onTaskRemoved called - Note: This does NOT fire on force-stop");
        Log.d(TAG, "Service restart now handled by ServiceHeartbeatWorker (15-min periodic check)");
        
        // ❌ DO NOT use WorkManager here - this method is unreliable
        // The ServiceHeartbeatWorker will detect service death and restart it
        
        /* REMOVED - Unreliable restart logic:
        // Schedule restart using WorkManager with exponential backoff
        androidx.work.WorkManager workManager = androidx.work.WorkManager.getInstance(getApplicationContext());
        
        // Cancel any existing restart work
        workManager.cancelAllWorkByTag("gallery_service_restart");
        
        // Create constraints
        androidx.work.Constraints constraints = new androidx.work.Constraints.Builder()
                .setRequiresCharging(false)
                .setRequiresBatteryNotLow(true)
                .build();
        
        // Create work request with exponential backoff
        androidx.work.OneTimeWorkRequest restartWork = 
            new androidx.work.OneTimeWorkRequest.Builder(ServiceRestartWorker.class)
                .setConstraints(constraints)
                .addTag("gallery_service_restart")
                .setBackoffCriteria(
                    androidx.work.BackoffPolicy.EXPONENTIAL,
                    androidx.work.OneTimeWorkRequest.MIN_BACKOFF_MILLIS,
                    java.util.concurrent.TimeUnit.MILLISECONDS)
                .build();
        
        // Enqueue work
        workManager.enqueue(restartWork);
        */
    }
    
    // Enhanced start command handling
    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Log.d(TAG, "onStartCommand called");

        // React-side correction: when backfill detects stale SharedPrefs data
        // (e.g. after manual date testing), it sends an intent to reset the
        // per-day baseline so the service stops saving the wrong high value.
        if (intent != null && intent.hasExtra("resetStepsDate")) {
            String date  = intent.getStringExtra("resetStepsDate");
            int    steps = intent.getIntExtra("resetStepsValue", -1);
            if (date != null && steps >= 0) {
                resetStepsBaseline(date, steps);
                // Correction: use forceWrite=true so the API allows writing a lower
                // value to fix phantom/inflated DB data from previous sessions.
                if (executorService != null) {
                    executorService.execute(() -> saveStepsToDBForDate(date, true));
                } else {
                    saveStepsToDBForDate(date, true);
                }
            }
        }

        // Explicit flush request from React "Refresh" button.
        // Still single-writer: the service performs the save itself.
        if (intent != null && intent.getBooleanExtra("forceSaveTodaySteps", false)) {
            if (executorService != null) {
                executorService.execute(this::saveStepsToDB);
            } else {
                saveStepsToDB();
            }
        }

        // Ensure proper foreground service type for Android 10+
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            try {
                int foregroundServiceType = ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC;
                // NOTE: FOREGROUND_SERVICE_TYPE_MEDIA_PROCESSING requires its own manifest permission
                // and was causing crashes — removed intentionally.
                stopForeground(true);
                startForeground(NOTIFICATION_ID, createNotification(), foregroundServiceType);
            } catch (Exception e) {
                Log.e(TAG, "Error setting foreground service type", e);
            }
        }
        
        // Use START_REDELIVER_INTENT to ensure the service gets the last intent when restarted
        return START_REDELIVER_INTENT;
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    // ── GPS helpers ───────────────────────────────────────────────────────────

    private void initGpsTracking() {
        try {
            fusedLocationClient = com.google.android.gms.location.LocationServices
                    .getFusedLocationProviderClient(this);

            com.google.android.gms.location.LocationRequest locationRequest =
                    new com.google.android.gms.location.LocationRequest.Builder(
                            com.google.android.gms.location.Priority.PRIORITY_HIGH_ACCURACY, 5000L)
                            .setMinUpdateIntervalMillis(3000L)
                            .build();

            gpsLocationCallback = new com.google.android.gms.location.LocationCallback() {
                @Override
                public void onLocationResult(com.google.android.gms.location.LocationResult result) {
                    if (result == null) return;
                    for (android.location.Location loc : result.getLocations()) {
                        processGpsLocation(loc);
                    }
                }
            };

            fusedLocationClient.requestLocationUpdates(locationRequest, gpsLocationCallback,
                    Looper.getMainLooper());
            Log.d(TAG, "✅ GPS tracking initialised");
        } catch (SecurityException e) {
            Log.w(TAG, "⚠️ GPS: location permission not granted — skipping GPS tracking");
        } catch (Exception e) {
            Log.w(TAG, "⚠️ GPS init failed: " + e.getMessage());
        }
    }

    private void processGpsLocation(android.location.Location location) {
        if (location == null) return;
        float accuracy = location.getAccuracy();
        boolean isOutdoor = accuracy < 50f;  // single-point flag (kept at 50 m for display)
        double lat = location.getLatitude();
        double lng = location.getLongitude();
        long now = System.currentTimeMillis();

        // ── Always write single "last fix" fields (used by getLastGpsLocation) ────
        SharedPreferences prefs = getSharedPreferences("WellnessGPS", MODE_PRIVATE);
        SharedPreferences.Editor editor = prefs.edit();
        editor.putFloat("gps_lat", (float) lat);
        editor.putFloat("gps_lng", (float) lng);
        editor.putFloat("gps_accuracy", accuracy);
        editor.putBoolean("gps_is_outdoor", isOutdoor);
        editor.putLong("gps_timestamp", now);

        // ── Accumulate outdoor route points (background route array) ────────────
        // Only record fixes with accuracy < 30 m to prevent off-road/building-cross lines.
        // Points are stored as a JSON array and capped at 1000 entries per day.
        // Cleared on day rollover so yesterday's route never bleeds into today.
        if (accuracy < 30f) {
            String today = new java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US)
                    .format(new java.util.Date(now));
            String storedDate = prefs.getString("route_date", "");

            // Day rollover — clear stale route
            if (!today.equals(storedDate)) {
                editor.putString("route_date", today);
                editor.putString("route_points", "[]");
            }

            // Load existing array
            String existingJson = prefs.getString("route_points", "[]");
            try {
                JSONArray arr = new JSONArray(existingJson);

                // Minimum distance filter: skip if < 10 m from last recorded point
                boolean tooClose = false;
                if (arr.length() > 0) {
                    JSONObject last = arr.getJSONObject(arr.length() - 1);
                    double lastLat = last.getDouble("lat");
                    double lastLng = last.getDouble("lng");
                    double dist = haversineMeters(lastLat, lastLng, lat, lng);
                    tooClose = dist < 10.0;
                }

                if (!tooClose) {
                    // Cap at 1000 points — remove oldest when exceeded
                    if (arr.length() >= 1000) {
                        JSONArray trimmed = new JSONArray();
                        for (int i = arr.length() - 999; i < arr.length(); i++) {
                            trimmed.put(arr.get(i));
                        }
                        arr = trimmed;
                    }
                    JSONObject point = new JSONObject();
                    point.put("lat", lat);
                    point.put("lng", lng);
                    point.put("accuracy", (double) accuracy);
                    point.put("timestamp", now);
                    arr.put(point);
                    editor.putString("route_points", arr.toString());
                    Log.d(TAG, "📍 BG route point added — total=" + arr.length()
                            + " lat=" + lat + " lng=" + lng + " acc=" + accuracy);
                }
            } catch (Exception e) {
                Log.w(TAG, "⚠️ BG route JSON error: " + e.getMessage());
                // Reset corrupted array
                editor.putString("route_points", "[]");
            }
        }

        editor.apply();
    }

    // ── Walking Detection ─────────────────────────────────────────────────────

    /**
     * Called on every step sensor event.
     * Opens a 12-second sliding window; if ≥15 steps are counted inside it
     * we consider the user to be walking and fire a heads-up notification
     * (subject to a 10-minute cooldown so we never spam).
     * No threads, no polling — piggybacks on the existing sensor callback.
     */
    private void checkWalkingDetection(int sensorTotal) {
        long now = System.currentTimeMillis();

        // Open a new window on the very first sensor event after init / reset
        if (walkDetectWindowStartMs == 0L) {
            walkDetectWindowStartMs    = now;
            walkDetectWindowStartSteps = sensorTotal;
            return;
        }

        long elapsed = now - walkDetectWindowStartMs;
        if (elapsed < WALK_DETECT_WINDOW_MS) {
            // Window still open — keep accumulating
            return;
        }

        // Window expired — evaluate and always reset for next measurement
        int stepDelta = sensorTotal - walkDetectWindowStartSteps;
        walkDetectWindowStartMs    = now;
        walkDetectWindowStartSteps = sensorTotal;

        if (stepDelta >= WALK_NOTIFY_STEP_THRESHOLD) {
            if (now - walkNotifyLastShownMs >= WALK_NOTIFY_COOLDOWN_MS) {
                walkNotifyLastShownMs = now;
                Log.d(TAG, "🚶 Walking detected: " + stepDelta + " steps in " + elapsed + " ms — sending notification");
                showWalkingNotification();
            } else {
                Log.d(TAG, "🚶 Walking detected but cooldown active — skipping notification");
            }
        }
    }

    /**
     * Shows a high-priority heads-up notification when walking is detected.
     * Checks GPS / network provider state to decide indoor vs outdoor message.
     * Tapping the notification opens the app directly.
     */
    private void showWalkingNotification() {
        // Determine indoor / outdoor without needing location permission for a reading —
        // we only need to know whether the user has location services turned ON.
        boolean locationEnabled = false;
        try {
            LocationManager lm = (LocationManager) getSystemService(Context.LOCATION_SERVICE);
            if (lm != null) {
                boolean gps = false;
                boolean net = false;
                try { gps = lm.isProviderEnabled(LocationManager.GPS_PROVIDER); } catch (Exception ignored) {}
                try { net = lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER); } catch (Exception ignored) {}
                locationEnabled = gps || net;
            }
        } catch (Exception e) {
            Log.w(TAG, "⚠️ Could not check location state: " + e.getMessage());
        }

        String message = locationEnabled
                ? "Outdoor activity detected"
                : "Indoor activity detected";

        // PendingIntent: open app when notification body is tapped
        Intent openIntent = new Intent(this, MainActivity.class);
        openIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        openIntent.putExtra("openStepCounter", true);
        PendingIntent pendingIntent = PendingIntent.getActivity(
                this,
                WALK_NOTIFICATION_ID,
                openIntent,
                Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
                        ? PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
                        : PendingIntent.FLAG_UPDATE_CURRENT
        );

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, WALK_CHANNEL_ID)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle("Walking Detected")
                .setContentText(message)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(message))
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setCategory(NotificationCompat.CATEGORY_STATUS)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setVibrate(new long[]{0, 250, 100, 250})
                .setContentIntent(pendingIntent);

        if (locationEnabled) {
            // GPS ON → swipeable, auto-dismisses on tap
            builder.setAutoCancel(true)
                   .setOngoing(false);
        } else {
            // GPS OFF → persistent (not swipeable), shows "Turn On GPS" action button
            builder.setAutoCancel(false)
                   .setOngoing(true);

            Intent settingsIntent = new Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS);
            settingsIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            PendingIntent settingsPendingIntent = PendingIntent.getActivity(
                    this,
                    WALK_NOTIFICATION_ID + 1,
                    settingsIntent,
                    Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
                            ? PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
                            : PendingIntent.FLAG_UPDATE_CURRENT
            );
            builder.addAction(R.mipmap.ic_launcher, "Turn On GPS", settingsPendingIntent);
        }

        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (nm != null) {
            nm.notify(WALK_NOTIFICATION_ID, builder.build());
            Log.d(TAG, "🔔 Walking notification posted: " + message + " | locationEnabled=" + locationEnabled);
        }
    }

    // ── END Walking Detection ─────────────────────────────────────────────────

    /** Haversine distance in metres between two lat/lng pairs. */
    private static double haversineMeters(double lat1, double lng1, double lat2, double lng2) {
        final double R = 6371000.0;
        double dLat = Math.toRadians(lat2 - lat1);
        double dLng = Math.toRadians(lng2 - lng1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLng / 2) * Math.sin(dLng / 2);
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    private void showDatabaseSuccessNotification(String imagePath, String userId) {
        if (!SHOW_DEBUG_SUCCESS_NOTIFICATIONS) {
            Log.d(TAG, "Debug notifications disabled, skipping success notification");
            return;
        }
        
        Log.d(TAG, "🔔 Creating database success notification for user: " + userId);
        
        String fileName = new File(imagePath).getName();
        String shortText = "✅ Database save successful - " + fileName;
        String longText = "Food analysis saved to database successfully\n" +
                         "User ID: " + userId + "\n" +
                         "File: " + fileName + "\n" +
                         "Time: " + new java.text.SimpleDateFormat("HH:mm:ss", java.util.Locale.getDefault()).format(new java.util.Date());
        
        try {
            NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
                    .setSmallIcon(R.mipmap.ic_launcher)
                    .setContentTitle("🗄️ Database Save Complete")
                    .setContentText(shortText)
                    .setStyle(new NotificationCompat.BigTextStyle().bigText(longText))
                    .setPriority(NotificationCompat.PRIORITY_DEFAULT) // Changed from LOW to DEFAULT for better visibility
                    .setAutoCancel(true)
                    .setShowWhen(true)
                    .setWhen(System.currentTimeMillis());

            // Remove setTimeoutAfter as it's not available on all API levels
            
            NotificationManager notificationManager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
            if (notificationManager != null) {
                int notificationId = (int) (System.currentTimeMillis() % Integer.MAX_VALUE);
                notificationManager.notify(notificationId, builder.build());
                Log.d(TAG, "✅ Database success notification posted with ID: " + notificationId);
            } else {
                Log.e(TAG, "❌ NotificationManager is null, cannot show notification");
            }
        } catch (Exception e) {
            Log.e(TAG, "❌ Error creating database success notification", e);
        }
    }
}
