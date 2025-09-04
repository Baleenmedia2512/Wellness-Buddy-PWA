package com.wellnessbuddy.app;

import android.os.Bundle;
import android.os.PowerManager;
import android.provider.Settings;
import android.content.Intent;
import android.net.Uri;
import android.view.View;
import android.view.WindowManager;

import com.getcapacitor.BridgeActivity;
import com.wellnessbuddy.app.plugins.GalleryMonitorPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
    
        // Register the GalleryMonitorPlugin
        registerPlugin(GalleryMonitorPlugin.class);
        android.util.Log.d("MainActivity", "✅ GalleryMonitorPlugin registered in MainActivity");
        
        super.onCreate(savedInstanceState);

        // Configure status bar with native look
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.LOLLIPOP) {
            // Set status bar color
            getWindow().setStatusBarColor(android.graphics.Color.parseColor("#e6f4ea"));
            
            // Ensure status bar is opaque (not translucent)
            getWindow().clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS);
            getWindow().addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
            
            // Set dark content for light status bar background  
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M) {
                getWindow().getDecorView().setSystemUiVisibility(
                    View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR
                );
            }
        }

        // Request runtime permissions
        requestAllPermissions();

        // Request battery optimization exemption
        requestBatteryOptimizationExemption();

        // ✅ Start background gallery monitor service
        Intent serviceIntent = new Intent(this, com.wellnessbuddy.app.services.GalleryMonitorService.class);
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            startForegroundService(serviceIntent);
        } else {
            startService(serviceIntent);
        }
        
        // Check if app was opened from notification
        handleNotificationIntent(getIntent());
    }
    
    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        handleNotificationIntent(intent);
    }
    
    private void handleNotificationIntent(Intent intent) {
        if (intent != null && intent.getBooleanExtra("openBackgroundHistory", false)) {
            // Send event to JavaScript side after a short delay to ensure the app is ready
            new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(() -> {
                try {
                    GalleryMonitorPlugin.triggerNotificationEvent("openBackgroundHistory");
                } catch (Exception e) {
                    android.util.Log.e("MainActivity", "Failed to trigger notification event", e);
                }
            }, 1000);
        }
    }
    
    private void requestBatteryOptimizationExemption() {
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M) {
            PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
            if (!pm.isIgnoringBatteryOptimizations(getPackageName())) {
                Intent intent = new Intent();
                intent.setAction(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                intent.setData(Uri.parse("package:" + getPackageName()));
                startActivity(intent);
            }
        }
    }

    // Request Media, Notification, and Camera permissions
    private void requestAllPermissions() {
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M) {
            String[] permissions;
            if (android.os.Build.VERSION.SDK_INT >= 33) { // Android 13+
                permissions = new String[] {
                    android.Manifest.permission.READ_MEDIA_IMAGES,
                    android.Manifest.permission.CAMERA,
                    android.Manifest.permission.POST_NOTIFICATIONS
                };
            } else {
                permissions = new String[] {
                    android.Manifest.permission.READ_EXTERNAL_STORAGE,
                    android.Manifest.permission.CAMERA
                };
            }
            requestPermissions(permissions, 1001);
        }
    }

}