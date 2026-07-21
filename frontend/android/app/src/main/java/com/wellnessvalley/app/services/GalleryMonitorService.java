package com.wellnessvalley.app.services;
import com.wellnessvalley.app.R;
import com.wellnessvalley.app.BuildConfig;

import android.content.Context;
import java.util.Calendar;
import java.util.List;
import java.util.Locale;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
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
import java.util.function.Consumer;
import android.database.ContentObserver;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import org.json.JSONObject;
import org.json.JSONArray;

public class GalleryMonitorService extends Service {
    private static final String TAG = "GalleryMonitorService";
    private static final String CHANNEL_ID = "GalleryMonitorChannel";
    private static final int NOTIFICATION_ID = 101;


    private ExecutorService executorService;
    private ScheduledExecutorService scheduledExecutor;
    private DatabaseSyncClient databaseSyncClient;

    // ── Gallery / Food Image Analysis ──────────────────────────────────────────
    private ContentObserver imageObserver;
    private long lastCheckedTime = 0;
    private long lastContentObserverScanTime = 0;
    private static final long CONTENT_OBSERVER_DEBOUNCE_MS = 5000;
    private FoodImageQueue foodImageQueue;
    private GeminiApiClient geminiApiClient;
    private RetryQueue retryQueue;
    private static final boolean SHOW_DEBUG_SUCCESS_NOTIFICATIONS = false;

    // ── GPS Tracking (writes to WellnessGPS SharedPrefs for map display) ────────
    private com.google.android.gms.location.FusedLocationProviderClient fusedLocationClient;
    private com.google.android.gms.location.LocationCallback gpsLocationCallback;

    // Database API configuration
    private static final String DEFAULT_API_BASE_URL = "https://wellness-buddy-pwa-backend-test.vercel.app";

    @Override
    public void onCreate() {
        super.onCreate();
        Log.d(TAG, "Service created");

        // ✅ Cancel legacy AlarmManager heartbeat immediately.
        // If this service was started by an old alarm, stop the chain here.
        BootCompletedReceiver.cancelLegacyAlarm(this);

        createNotificationChannel();

        // Start as foreground service.
        // On API 34+ (Android 14), including FOREGROUND_SERVICE_TYPE_LOCATION
        // without the location permission already granted throws SecurityException
        // — which crashes the :background process on first install before the user
        // has had a chance to grant permissions.
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                int fgType = ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) { // API 34+
                    // Only include LOCATION type if permission is already granted
                    if (androidx.core.content.ContextCompat.checkSelfPermission(this,
                            android.Manifest.permission.ACCESS_FINE_LOCATION)
                            == android.content.pm.PackageManager.PERMISSION_GRANTED) {
                        fgType |= ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION;
                        Log.d(TAG, "✅ Location permission granted — including LOCATION foreground type");
                    } else {
                        Log.d(TAG, "⚠️ Location permission not yet granted — starting without LOCATION type");
                    }
                }
                startForeground(NOTIFICATION_ID, createNotification(), fgType);
            } else {
                startForeground(NOTIFICATION_ID, createNotification());
            }
        } catch (Exception e) {
            Log.e(TAG, "❌ startForeground failed — falling back to basic type", e);
            try {
                startForeground(NOTIFICATION_ID, createNotification());
            } catch (Exception e2) {
                Log.e(TAG, "❌ Fallback startForeground also failed — stopping service", e2);
                stopSelf();
                return;
            }
        }

        // [BUG 3 FIX] Removed debug Toast — production users should never
        // see a 'Service Running' popup on every app launch.
        // Toast.makeText(this, "Wellness Valley Service Running", Toast.LENGTH_SHORT).show();

        try {
            initServiceComponents();
        } catch (Exception e) {
            Log.e(TAG, "❌ Service initialization failed — stopping to avoid crash loop", e);
            stopSelf();
            return;
        }
    }

    /**
     * All heavy service initialization extracted here so a single
     * try-catch in onCreate can prevent a crash from killing the
     * :background process and triggering "App keeps stopping".
     */
    private void initServiceComponents() {
        executorService = Executors.newSingleThreadExecutor();
        scheduledExecutor = Executors.newScheduledThreadPool(2);
        
        // Initialize database sync client
        String apiBaseUrl = resolveApiBaseUrl();
        databaseSyncClient = new DatabaseSyncClient(apiBaseUrl, this);
        
        // Initialize gallery/food image analysis components
        foodImageQueue = new FoodImageQueue(this);
        geminiApiClient = new GeminiApiClient(BuildConfig.GEMINI_API_KEY);
        retryQueue = new RetryQueue(this, databaseSyncClient);
        lastCheckedTime = System.currentTimeMillis();
        Log.d(TAG, "Using API_BASE_URL for background sync: " + apiBaseUrl);
        
        // Test database connection
        executorService.execute(() -> {
            boolean connected = databaseSyncClient.testConnection();
            Log.d(TAG, connected ? "✅ Database connection successful" : "❌ Database connection failed");
        });

        // ✅ GPS tracking — writes lat/lng/isOutdoor to WellnessGPS SharedPrefs for map display
        initGpsTracking();

        // ✅ Register ContentObserver to detect image changes (with debounce to prevent flooding)
        imageObserver = new ContentObserver(new Handler(Looper.getMainLooper())) {
            @Override
            public void onChange(boolean selfChange, @Nullable Uri uri) {
                super.onChange(selfChange, uri);
                long now = System.currentTimeMillis();
                if (now - lastContentObserverScanTime < CONTENT_OBSERVER_DEBOUNCE_MS) {
                    Log.d(TAG, "📸 MediaStore change debounced (within " + CONTENT_OBSERVER_DEBOUNCE_MS + "ms)");
                    return;
                }
                lastContentObserverScanTime = now;
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

            showFoodAnalysisNotification(imagePath, result);
            foodImageQueue.remove(imagePath);
        }
    }

    private void showFoodAnalysisNotification(String imagePath, String result) {
        try {
            String fileName = new File(imagePath).getName();
            NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
                    .setSmallIcon(R.mipmap.ic_launcher)
                    .setContentTitle("Food Analysis Complete")
                    .setContentText(fileName + " analyzed")
                    .setStyle(new NotificationCompat.BigTextStyle().bigText(result))
                    .setPriority(NotificationCompat.PRIORITY_HIGH)
                    .setAutoCancel(true);
            NotificationManager manager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
            if (manager != null) {
                manager.notify((int) System.currentTimeMillis(), builder.build());
            }
        } catch (Exception e) {
            Log.e(TAG, "Error showing food analysis notification", e);
        }
    }
    

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

        if (executorService != null) {
            executorService.shutdown();
        }
        if (scheduledExecutor != null) {
            scheduledExecutor.shutdown();
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

        // ── User credentials delivered via Intent extras ──────────────────────
        // GalleryMonitorPlugin.setCurrentUser() passes userId/email/cachedDbUserId
        // as extras so the :background process always has a reliable userId.
        // MODE_MULTI_PROCESS (used in getCurrentUserId) is deprecated and does NOT
        // guarantee cross-process visibility on Android 8+ — this is the safe path.
        if (intent != null) {
            String intentCachedId = intent.getStringExtra("cachedDbUserId");
            String intentEmail    = intent.getStringExtra("userEmail");
            String intentUserId   = intent.getStringExtra("userId");
            String intentApiUrl   = intent.getStringExtra("apiBaseUrl");
            if (intentCachedId != null || intentEmail != null || intentUserId != null) {
                SharedPreferences.Editor editor =
                        getSharedPreferences("WellnessValley", MODE_PRIVATE).edit();
                if (intentCachedId != null && !intentCachedId.isEmpty()) {
                    editor.putString("cached_db_user_id", intentCachedId);
                    Log.d(TAG, "✅ [onStartCommand] cached_db_user_id synced from Intent: " + intentCachedId);
                }
                if (intentEmail != null && !intentEmail.isEmpty()) {
                    editor.putString("current_user_email", intentEmail);
                }
                if (intentUserId != null && !intentUserId.isEmpty()) {
                    editor.putString("current_user_id", intentUserId);
                }
                if (intentApiUrl != null && !intentApiUrl.isEmpty()) {
                    editor.putString("api_base_url", intentApiUrl);
                }
                // commit() instead of apply() — synchronous write so getCurrentUserId()
                // reads the correct value on the very next scheduled save tick.
                editor.commit();
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
