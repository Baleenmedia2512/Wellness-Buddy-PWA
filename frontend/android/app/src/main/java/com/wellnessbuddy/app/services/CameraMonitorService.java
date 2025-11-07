package com.wellnessbuddy.app.services;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.Environment;
import android.os.FileObserver;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.util.Log;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

import com.wellnessbuddy.app.MainActivity;
import com.wellnessbuddy.app.R;

import java.io.File;
import java.util.HashSet;
import java.util.Set;

/**
 * CameraMonitorService - Monitors DCIM/Camera folder for new photos
 * 
 * This service uses FileObserver to detect when a user takes a photo with their
 * personal camera app (outside the Wellness app). When a new photo is detected,
 * it shows a native notification with two action buttons:
 * - "Admit" → Opens the Wellness app and registers the photo
 * - "No" → Dismisses the notification
 * 
 * Battery Optimization:
 * - Uses FileObserver (inotify-based) instead of periodic polling
 * - Efficient event-driven architecture
 * - Minimal CPU usage when no photos are taken
 * - Foreground service with low-priority notification
 */
public class CameraMonitorService extends Service {
    private static final String TAG = "CameraMonitorService";
    private static final String CHANNEL_ID = "CameraMonitorChannel";
    private static final String FOOD_DETECTION_CHANNEL_ID = "FoodDetectionChannel";
    private static final int NOTIFICATION_ID = 102;
    
    private CameraFolderObserver fileObserver;
    private Handler mainHandler;
    private Set<String> processedFiles; // Track already processed files
    
    // Debounce mechanism to avoid duplicate notifications
    private static final long DEBOUNCE_DELAY_MS = 2000; // 2 seconds
    private String lastDetectedFile = null;
    private long lastDetectionTime = 0;

    @Override
    public void onCreate() {
        super.onCreate();
        Log.d(TAG, "CameraMonitorService created");
        
        createNotificationChannels();
        startForeground();
        
        mainHandler = new Handler(Looper.getMainLooper());
        processedFiles = new HashSet<>();
        
        // Start monitoring the DCIM/Camera folder
        startMonitoring();
    }

    private void startForeground() {
        int foregroundServiceType = 0;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            foregroundServiceType = ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC;
            
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                foregroundServiceType |= ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROCESSING;
            }
            
            startForeground(NOTIFICATION_ID, createServiceNotification(), foregroundServiceType);
        } else {
            startForeground(NOTIFICATION_ID, createServiceNotification());
        }
    }

    private void createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                // Channel for service notification (low priority)
                NotificationChannel serviceChannel = new NotificationChannel(
                        CHANNEL_ID,
                        "Camera Monitor Service",
                        NotificationManager.IMPORTANCE_LOW
                );
                serviceChannel.setDescription("Monitors camera for food photos");
                serviceChannel.setShowBadge(false);
                manager.createNotificationChannel(serviceChannel);
                
                // Channel for food detection notifications (high priority)
                NotificationChannel detectionChannel = new NotificationChannel(
                        FOOD_DETECTION_CHANNEL_ID,
                        "Food Photo Detected",
                        NotificationManager.IMPORTANCE_HIGH
                );
                detectionChannel.setDescription("Notifications when camera photos are detected");
                detectionChannel.enableLights(true);
                detectionChannel.enableVibration(true);
                detectionChannel.setShowBadge(true);
                manager.createNotificationChannel(detectionChannel);
                
                Log.d(TAG, "✅ Notification channels created");
            }
        }
    }

    private Notification createServiceNotification() {
        Intent notificationIntent = new Intent(this, MainActivity.class);
        PendingIntent pendingIntent = PendingIntent.getActivity(
                this, 0, notificationIntent,
                Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
                        ? PendingIntent.FLAG_IMMUTABLE
                        : 0
        );

        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("Camera Monitor Active")
                .setContentText("Watching for new food photos")
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentIntent(pendingIntent)
                .setOngoing(true)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .build();
    }

    private void startMonitoring() {
        try {
            // Monitor DCIM/Camera folder
            File dcimDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DCIM);
            File cameraDir = new File(dcimDir, "Camera");
            
            if (!cameraDir.exists()) {
                Log.w(TAG, "Camera folder does not exist: " + cameraDir.getAbsolutePath());
                // Try to create it
                if (!cameraDir.mkdirs()) {
                    Log.e(TAG, "Failed to create Camera folder");
                    return;
                }
            }
            
            // Create and start FileObserver
            fileObserver = new CameraFolderObserver(cameraDir.getAbsolutePath());
            fileObserver.startWatching();
            
            Log.d(TAG, "✅ Started monitoring: " + cameraDir.getAbsolutePath());
        } catch (Exception e) {
            Log.e(TAG, "❌ Error starting monitoring", e);
        }
    }

    /**
     * FileObserver implementation to watch for new photos
     * Uses inotify under the hood - very battery efficient
     */
    private class CameraFolderObserver extends FileObserver {
        private final String path;

        public CameraFolderObserver(String path) {
            super(path, FileObserver.CLOSE_WRITE | FileObserver.MOVED_TO);
            this.path = path;
            Log.d(TAG, "FileObserver created for: " + path);
        }

        @Override
        public void onEvent(int event, @Nullable String fileName) {
            if (fileName == null) return;
            
            // Only process image files
            String lowerName = fileName.toLowerCase();
            if (!lowerName.endsWith(".jpg") && 
                !lowerName.endsWith(".jpeg") && 
                !lowerName.endsWith(".png")) {
                return;
            }
            
            File imageFile = new File(path, fileName);
            String filePath = imageFile.getAbsolutePath();
            
            // Debounce: Avoid duplicate notifications for the same file
            long currentTime = System.currentTimeMillis();
            if (filePath.equals(lastDetectedFile) && 
                (currentTime - lastDetectionTime) < DEBOUNCE_DELAY_MS) {
                Log.d(TAG, "Debounced duplicate detection: " + fileName);
                return;
            }
            
            // Check if already processed
            if (processedFiles.contains(filePath)) {
                Log.d(TAG, "Already processed: " + fileName);
                return;
            }
            
            lastDetectedFile = filePath;
            lastDetectionTime = currentTime;
            
            Log.d(TAG, "📸 New photo detected: " + fileName);
            Log.d(TAG, "Event type: " + event + " (CLOSE_WRITE=" + FileObserver.CLOSE_WRITE + 
                      ", MOVED_TO=" + FileObserver.MOVED_TO + ")");
            
            // Verify file exists and has size
            if (imageFile.exists() && imageFile.length() > 0) {
                // Add small delay to ensure file is fully written
                mainHandler.postDelayed(() -> {
                    if (imageFile.exists() && imageFile.length() > 0) {
                        processedFiles.add(filePath);
                        showFoodDetectionNotification(filePath);
                    }
                }, 500);
            }
        }
    }

    /**
     * Show notification asking user if they want to add the photo to Wellness app
     */
    private void showFoodDetectionNotification(String imagePath) {
        try {
            File imageFile = new File(imagePath);
            String fileName = imageFile.getName();
            
            Log.d(TAG, "Showing notification for: " + fileName);
            
            // Create intent for "Admit" action
            Intent admitIntent = new Intent(this, FoodDetectionNotificationReceiver.class);
            admitIntent.setAction("ACTION_ADMIT_PHOTO");
            admitIntent.putExtra("imagePath", imagePath);
            
            PendingIntent admitPendingIntent = PendingIntent.getBroadcast(
                    this,
                    (int) System.currentTimeMillis(),
                    admitIntent,
                    Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
                            ? PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
                            : PendingIntent.FLAG_UPDATE_CURRENT
            );
            
            // Create intent for "No" action
            Intent dismissIntent = new Intent(this, FoodDetectionNotificationReceiver.class);
            dismissIntent.setAction("ACTION_DISMISS_PHOTO");
            dismissIntent.putExtra("imagePath", imagePath);
            
            PendingIntent dismissPendingIntent = PendingIntent.getBroadcast(
                    this,
                    (int) System.currentTimeMillis() + 1,
                    dismissIntent,
                    Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
                            ? PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
                            : PendingIntent.FLAG_UPDATE_CURRENT
            );
            
            // Build the notification
            NotificationCompat.Builder builder = new NotificationCompat.Builder(this, FOOD_DETECTION_CHANNEL_ID)
                    .setSmallIcon(R.mipmap.ic_launcher)
                    .setContentTitle("📷 New Photo Detected")
                    .setContentText("This particular food is taken from your personal camera.\nDo you want me to take this in the Wellness app?")
                    .setStyle(new NotificationCompat.BigTextStyle()
                            .bigText("This particular food is taken from your personal camera.\nDo you want me to take this in the Wellness app?"))
                    .setPriority(NotificationCompat.PRIORITY_HIGH)
                    .setCategory(NotificationCompat.CATEGORY_MESSAGE)
                    .setAutoCancel(true)
                    .setVibrate(new long[]{0, 500, 250, 500})
                    .addAction(R.mipmap.ic_launcher, "Admit", admitPendingIntent)
                    .addAction(R.mipmap.ic_launcher, "No", dismissPendingIntent);
            
            // Try to add image preview
            try {
                Bitmap bitmap = BitmapFactory.decodeFile(imagePath);
                if (bitmap != null) {
                    builder.setLargeIcon(bitmap);
                    builder.setStyle(new NotificationCompat.BigPictureStyle()
                            .bigPicture(bitmap)
                            .bigLargeIcon((Bitmap) null)
                            .setSummaryText("Do you want to add this to Wellness app?"));
                }
            } catch (Exception e) {
                Log.e(TAG, "Error loading image for notification", e);
            }
            
            // Show the notification
            NotificationManager notificationManager = getSystemService(NotificationManager.class);
            if (notificationManager != null) {
                int notificationId = (int) (System.currentTimeMillis() % Integer.MAX_VALUE);
                notificationManager.notify(notificationId, builder.build());
                Log.d(TAG, "✅ Notification shown with ID: " + notificationId);
            }
            
        } catch (Exception e) {
            Log.e(TAG, "❌ Error showing notification", e);
        }
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        Log.d(TAG, "CameraMonitorService destroyed");
        
        if (fileObserver != null) {
            fileObserver.stopWatching();
        }
        
        if (mainHandler != null) {
            mainHandler.removeCallbacksAndMessages(null);
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Log.d(TAG, "onStartCommand called");
        
        // Ensure foreground service
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            try {
                stopForeground(true);
                startForeground();
            } catch (Exception e) {
                Log.e(TAG, "Error restarting foreground service", e);
            }
        }
        
        return START_STICKY; // Service will be restarted if killed
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
