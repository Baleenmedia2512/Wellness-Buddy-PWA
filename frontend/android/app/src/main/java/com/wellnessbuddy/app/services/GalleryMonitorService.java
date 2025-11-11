package com.wellnessbuddy.app.services;
import com.wellnessbuddy.app.R;
import com.wellnessbuddy.app.BuildConfig;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.database.ContentObserver;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.provider.MediaStore;
import android.util.Log;
import android.widget.Toast;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

import com.wellnessbuddy.app.MainActivity;
import android.content.SharedPreferences;

import java.io.File;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import java.io.IOException;
import java.io.InputStream;
import java.util.Arrays;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.function.Consumer;
import org.json.JSONObject;
import org.json.JSONArray;

public class GalleryMonitorService extends Service {
    private static final String TAG = "GalleryMonitorService";
    private static final String CHANNEL_ID = "GalleryMonitorChannel";
    private static final int NOTIFICATION_ID = 101;
    
    // 🚨 DEBUG FEATURE: Set to false for live release to disable success notifications
    private static final boolean SHOW_DEBUG_SUCCESS_NOTIFICATIONS = true;

    private ExecutorService executorService;
    private ScheduledExecutorService scheduledExecutor;
    private ContentObserver imageObserver;
    private long lastCheckedTime = 0;
    private FoodImageQueue foodImageQueue;
    private NetworkChangeReceiver networkChangeReceiver;
    private GeminiApiClient geminiApiClient;
    private DatabaseSyncClient databaseSyncClient;
    private RetryQueue retryQueue;
    
    // Database API configuration
    // private static final String API_BASE_URL = "http://10.0.2.2:5000"; // For Android emulator (localhost:5000)
    // private static final String API_BASE_URL = "http://192.168.1.100:5000"; // For physical device (replace with your PC IP)
    private static final String API_BASE_URL = "https://wellness-buddy-pwa-eta.vercel.app/"; // Replace with your actual Vercel URL

    @Override
    public void onCreate() {
        super.onCreate();
        Log.d(TAG, "Service created");

        createNotificationChannel();

        int foregroundServiceType = 0;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            foregroundServiceType = ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC;

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                foregroundServiceType |= ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROCESSING;
            }

            startForeground(NOTIFICATION_ID, createNotification(), foregroundServiceType);
        } else {
            startForeground(NOTIFICATION_ID, createNotification());
        }

        Toast.makeText(this, "GalleryMonitorService Running", Toast.LENGTH_SHORT).show();

        executorService = Executors.newSingleThreadExecutor();
        scheduledExecutor = Executors.newScheduledThreadPool(2);
        foodImageQueue = new FoodImageQueue(this);
        networkChangeReceiver = new NetworkChangeReceiver(() -> processQueuedImages());
        registerReceiver(networkChangeReceiver, new android.content.IntentFilter(android.net.ConnectivityManager.CONNECTIVITY_ACTION));
        
        // Initialize database sync client
        databaseSyncClient = new DatabaseSyncClient(API_BASE_URL, this);
        
        // Test database connection
        executorService.execute(() -> {
            boolean connected = databaseSyncClient.testConnection();
            Log.d(TAG, connected ? "✅ Database connection successful" : "❌ Database connection failed");
        });
        
        // Initialize Gemini API client with BuildConfig key (injected at build time)
        try {
            String apiKey = BuildConfig.GEMINI_API_KEY;
            if (apiKey == null || apiKey.isEmpty()) {
                Log.e(TAG, "❌ GEMINI_API_KEY not configured! Set it in gradle.properties");
                throw new IllegalStateException("GEMINI_API_KEY is required but not configured");
            }
            
            geminiApiClient = new GeminiApiClient(apiKey);
            Log.d(TAG, "✅ Gemini API client initialized successfully");
            
            // Initialize retry queue
            retryQueue = new RetryQueue(this, databaseSyncClient);
            
            // Schedule retry processing every 30 minutes
            scheduledExecutor.scheduleAtFixedRate(() -> {
                Log.d(TAG, "Processing retry queue: " + retryQueue.getQueueStats());
                retryQueue.processRetries();
            }, 30, 30, TimeUnit.MINUTES);
            
        } catch (Exception e) {
            Log.e(TAG, "❌ Error initializing Gemini API client", e);
            throw new RuntimeException("Failed to initialize Gemini API client", e);
        }

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
                .setContentTitle("Gallery Monitor Active")
                .setContentText("Monitoring camera photos for food analysis")
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentIntent(pendingIntent)
                .setOngoing(true)
                .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                .build();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "Gallery Monitor",
                    NotificationManager.IMPORTANCE_DEFAULT
            );
            channel.setDescription("Monitors camera photos for food analysis");
            channel.enableLights(true);
            channel.enableVibration(true);
            channel.setShowBadge(true);

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
    
    // Get current user ID from SharedPreferences and lookup database UserId
    private String getCurrentUserId() {
        android.content.SharedPreferences prefs = getSharedPreferences("WellnessBuddy", MODE_PRIVATE);
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

        if (imageObserver != null) {
            getContentResolver().unregisterContentObserver(imageObserver);
        }

        if (executorService != null) {
            executorService.shutdown();
        }
        if (scheduledExecutor != null) {
            scheduledExecutor.shutdown();
        }
        if (networkChangeReceiver != null) {
            unregisterReceiver(networkChangeReceiver);
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
        
        // Ensure proper foreground service type for Android 10+
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            try {
                int foregroundServiceType = ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC;
                
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    foregroundServiceType |= ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROCESSING;
                }
                
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

    // Show Gemini analysis result notification
    private void showAnalysisNotification(String imagePath, String result) {
        String foodName = "Food";
        int calories = -1;
        double protein = -1, carbs = -1, fat = -1, fiber = -1;
        boolean hasFood = false;
        
        // Check if result is a valid JSON before parsing
        if (result == null || result.startsWith("Analysis failed") || result.startsWith("Error:") || result.equals("No result")) {
            Log.d(TAG, "Skipping notification for non-JSON result: " + result);
            return;
        }
        
        try {
            JSONObject obj = new JSONObject(result);
            JSONArray foods = obj.optJSONArray("foods");
            if (foods != null && foods.length() > 0) {
                hasFood = true;
                JSONObject firstFood = foods.getJSONObject(0);
                foodName = firstFood.optString("name", foodName);
                JSONObject nutrition = firstFood.optJSONObject("nutrition");
                if (nutrition != null) {
                    calories = nutrition.optInt("calories", -1);
                    protein = nutrition.optDouble("protein", -1);
                    carbs = nutrition.optDouble("carbs", -1);
                    fat = nutrition.optDouble("fat", -1);
                    fiber = nutrition.optDouble("fiber", -1);
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Error parsing Gemini result for notification", e);
            Log.d(TAG, "Result that failed to parse: " + result);
            return;
        }

        if (!hasFood) {
            Log.d(TAG, "No food detected by Gemini. Skipping notification.");
            return;
        }

        StringBuilder contentTextBuilder = new StringBuilder();
        contentTextBuilder.append(foodName);
        if (calories >= 0) contentTextBuilder.append(" • ").append(calories).append(" kcal");
        if (protein >= 0) contentTextBuilder.append(" • Protein: ").append(protein).append("g");
        if (carbs >= 0) contentTextBuilder.append(" • Carbs: ").append(carbs).append("g");
        if (fat >= 0) contentTextBuilder.append(" • Fat: ").append(fat).append("g");
        if (fiber >= 0) contentTextBuilder.append(" • Fiber: ").append(fiber).append("g");
        String contentText = contentTextBuilder.toString();

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle("🍽️ Food Analysis Complete")
                .setContentText(contentText)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setAutoCancel(true);

        // Make notification clickable - opens app with background history flag
        Intent notificationIntent = new Intent(this, MainActivity.class);
        notificationIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        notificationIntent.putExtra("openBackgroundHistory", true);
        
        PendingIntent pendingIntent = PendingIntent.getActivity(
                this, 
                (int) System.currentTimeMillis(), 
                notificationIntent,
                Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
                        ? PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
                        : PendingIntent.FLAG_UPDATE_CURRENT
        );
        
        builder.setContentIntent(pendingIntent);

        // Try to show the image in the notification
        try {
            File imgFile = new File(imagePath);
            if (imgFile.exists()) {
                Bitmap bitmap = BitmapFactory.decodeFile(imgFile.getAbsolutePath());
                if (bitmap != null) {
                    builder.setStyle(new NotificationCompat.BigPictureStyle()
                            .bigPicture(bitmap)
                            .setSummaryText(contentText));
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Error loading image for notification", e);
        }

        NotificationManager notificationManager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        notificationManager.notify((int) System.currentTimeMillis(), builder.build());
    }
    
    // 🚨 DEBUG: Show database save success notification (removable for production)
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
