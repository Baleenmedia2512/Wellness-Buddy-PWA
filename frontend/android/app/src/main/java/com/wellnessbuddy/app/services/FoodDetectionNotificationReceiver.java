package com.wellnessbuddy.app.services;

import android.app.NotificationManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

import com.wellnessbuddy.app.MainActivity;

/**
 * FoodDetectionNotificationReceiver - Handles notification action button clicks
 * 
 * This receiver processes user responses to food photo detection notifications:
 * - ACTION_ADMIT_PHOTO: User wants to add the photo to Wellness app
 * - ACTION_DISMISS_PHOTO: User doesn't want to add the photo
 */
public class FoodDetectionNotificationReceiver extends BroadcastReceiver {
    private static final String TAG = "FoodDetectionReceiver";
    
    public static final String ACTION_ADMIT_PHOTO = "ACTION_ADMIT_PHOTO";
    public static final String ACTION_DISMISS_PHOTO = "ACTION_DISMISS_PHOTO";
    
    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        String imagePath = intent.getStringExtra("imagePath");
        
        Log.d(TAG, "Received action: " + action + " for image: " + imagePath);
        
        if (imagePath == null) {
            Log.e(TAG, "Image path is null");
            return;
        }
        
        // Dismiss the notification
        NotificationManager notificationManager = 
                (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (notificationManager != null) {
            notificationManager.cancelAll();
        }
        
        if (ACTION_ADMIT_PHOTO.equals(action)) {
            handleAdmitPhoto(context, imagePath);
        } else if (ACTION_DISMISS_PHOTO.equals(action)) {
            handleDismissPhoto(context, imagePath);
        }
    }
    
    /**
     * Handle "Admit" button click
     * Opens the Wellness app and adds the photo to the food analysis queue
     */
    private void handleAdmitPhoto(Context context, String imagePath) {
        Log.d(TAG, "✅ User admitted photo: " + imagePath);
        
        try {
            // Add the image to the food analysis queue
            FoodImageQueue foodImageQueue = new FoodImageQueue(context);
            foodImageQueue.add(imagePath);
            
            Log.d(TAG, "✅ Image added to analysis queue");
            
            // Start/ensure GalleryMonitorService is running to process the queue
            Intent serviceIntent = new Intent(context, GalleryMonitorService.class);
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                context.startForegroundService(serviceIntent);
            } else {
                context.startService(serviceIntent);
            }
            
            // Open the app with a flag to navigate to the appropriate screen
            Intent appIntent = new Intent(context, MainActivity.class);
            appIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            appIntent.putExtra("photoAdmitted", true);
            appIntent.putExtra("imagePath", imagePath);
            context.startActivity(appIntent);
            
            Log.d(TAG, "✅ Wellness app opened");
            
        } catch (Exception e) {
            Log.e(TAG, "❌ Error handling admit photo", e);
        }
    }
    
    /**
     * Handle "No" button click
     * Simply logs the dismissal
     */
    private void handleDismissPhoto(Context context, String imagePath) {
        Log.d(TAG, "❌ User dismissed photo: " + imagePath);
        // No further action needed - notification is already dismissed
    }
}

