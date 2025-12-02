package com.wellnessvalley.app;

import android.os.Bundle;
import android.os.PowerManager;
import android.provider.Settings;
import android.content.Intent;
import android.net.Uri;
import android.view.View;
import android.view.WindowManager;
import android.webkit.WebView;
import android.webkit.WebSettings;

import com.getcapacitor.BridgeActivity;
import com.wellnessvalley.app.plugins.GalleryMonitorPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // ✅ ANDROID PERFORMANCE: Enable hardware acceleration for faster image rendering
        getWindow().setFlags(
            WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED,
            WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED
        );
        
        // Register the GalleryMonitorPlugin BEFORE super.onCreate()
        registerPlugin(GalleryMonitorPlugin.class);
        
        super.onCreate(savedInstanceState);
        
        // Enable hardware acceleration for better animation performance
        getWindow().setFlags(
            WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED,
            WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED
        );
        
        android.util.Log.d("MainActivity", "✅ GalleryMonitorPlugin registered in MainActivity");
        
        // ✅ ANDROID PERFORMANCE: Optimize WebView for fast image operations
        optimizeWebView();
        
        // Ensure dark status bar icons on all Android versions
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.R) {
            // Android 11+ (API 30+)
            getWindow().getDecorView().getWindowInsetsController().setSystemBarsAppearance(
                android.view.WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS,
                android.view.WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS
            );
        } else {
            // Android 6.0 - Android 10 (API 23-29)
            int flags = getWindow().getDecorView().getSystemUiVisibility();
            flags |= android.view.View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
            flags |= android.view.View.SYSTEM_UI_FLAG_LAYOUT_STABLE;
            flags |= android.view.View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN;
            getWindow().getDecorView().setSystemUiVisibility(flags);
        }

        // Set status bar background color
        getWindow().setStatusBarColor(android.graphics.Color.WHITE);
        
        // Ensure proper window flags
        getWindow().addFlags(android.view.WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
        getWindow().clearFlags(android.view.WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS);

        // Request runtime permissions
        requestAllPermissions();

        // Request battery optimization exemption
        requestBatteryOptimizationExemption();

        // ✅ Start background gallery monitor service
        Intent serviceIntent = new Intent(this, com.wellnessvalley.app.services.GalleryMonitorService.class);
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            startForegroundService(serviceIntent);
        } else {
            startService(serviceIntent);
        }
        android.util.Log.d("MainActivity", "✅ Gallery monitor service started");
        
        // ✅ Schedule periodic heartbeat to ensure service stays alive
        com.wellnessvalley.app.services.BootCompletedReceiver.scheduleHeartbeat(this);
        android.util.Log.d("MainActivity", "✅ Heartbeat worker scheduled - service will auto-restart if killed");
        
        // Check if app was opened from notification
        handleNotificationIntent(getIntent());
    }
    
    /**
     * ✅ ANDROID PERFORMANCE: Optimize WebView for fast image loading and rendering
     */
    private void optimizeWebView() {
        try {
            WebView webView = getBridge().getWebView();
            if (webView != null) {
                // Enable hardware acceleration at view level
                webView.setLayerType(View.LAYER_TYPE_HARDWARE, null);
                
                WebSettings settings = webView.getSettings();
                
                // Enable caching for faster repeated loads
                settings.setCacheMode(WebSettings.LOAD_DEFAULT);
                settings.setDomStorageEnabled(true);
                
                // Disable unnecessary features for better performance
                settings.setGeolocationEnabled(false);
                
                // Enable modern web features needed for image processing
                settings.setJavaScriptCanOpenWindowsAutomatically(true);
                settings.setLoadsImagesAutomatically(true);
                
                // Optimize for mobile
                settings.setLayoutAlgorithm(WebSettings.LayoutAlgorithm.TEXT_AUTOSIZING);
                settings.setUseWideViewPort(true);
                settings.setLoadWithOverviewMode(true);
                
                // Enable zoom for image viewing
                settings.setSupportZoom(false);
                settings.setBuiltInZoomControls(false);
                
                android.util.Log.d("MainActivity", "✅ WebView optimized for image performance");
            }
        } catch (Exception e) {
            android.util.Log.e("MainActivity", "Failed to optimize WebView", e);
        }
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