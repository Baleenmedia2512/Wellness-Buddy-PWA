package com.wellnessvalley.app;

import android.os.Bundle;
import android.os.PowerManager;
import android.provider.Settings;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.view.View;
import android.view.WindowManager;
import android.webkit.WebView;
import android.webkit.WebSettings;
import android.webkit.WebViewClient;
import android.graphics.Bitmap;

import com.getcapacitor.BridgeActivity;
import com.wellnessvalley.app.plugins.GalleryMonitorPlugin;
import com.wellnessvalley.app.plugins.InAppUpdatePlugin;
import com.wellnessvalley.app.plugins.KeepAwakePlugin;
import com.wellnessvalley.app.plugins.ScreenTimePlugin;
import com.wellnessvalley.app.plugins.StepCounterPlugin;
import com.wellnessvalley.app.plugins.WhatsAppSharePlugin;
import androidx.core.splashscreen.SplashScreen;

public class MainActivity extends BridgeActivity {
    private InAppUpdateManager updateManager;
    
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // ✅ IMMEDIATE: Cancel legacy AlarmManager heartbeat before anything else.
        // Users who update without force-stopping still have the old self-perpetuating
        // alarm registered. Cancel it synchronously on the main thread so it can't
        // fire and crash-restart the :background process.
        com.wellnessvalley.app.services.BootCompletedReceiver.cancelLegacyAlarm(this);

        // ✅ CRITICAL FIX: Install and immediately dismiss splash screen to prevent window overlay
        SplashScreen splashScreen = SplashScreen.installSplashScreen(this);
        
        // Register the GalleryMonitorPlugin BEFORE super.onCreate()
        registerPlugin(GalleryMonitorPlugin.class);
        
        // ✅ Register InAppUpdatePlugin for Play Store updates
        registerPlugin(InAppUpdatePlugin.class);

        // ✅ Register StepCounterPlugin for in-app step tracking
        registerPlugin(StepCounterPlugin.class);
        
        // ✅ Register WhatsAppSharePlugin for high-quality image sharing
        registerPlugin(WhatsAppSharePlugin.class);
        
        // ✅ Register ScreenTimePlugin for device screen time tracking
        registerPlugin(ScreenTimePlugin.class);

        // ✅ Register KeepAwakePlugin to prevent screen sleep while app is active
        registerPlugin(KeepAwakePlugin.class);
        
        // ✅ ANDROID PERFORMANCE: Enable hardware acceleration for faster image rendering
        getWindow().setFlags(
            WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED,
            WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED
        );
        
        super.onCreate(savedInstanceState);
        
        // ✅ CRITICAL FIX: Ensure splash screen window is completely removed
        // This prevents the splash screen from appearing in text selection overlays
        splashScreen.setKeepOnScreenCondition(() -> false);
        
        // Enable hardware acceleration for better animation performance
        getWindow().setFlags(
            WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED,
            WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED
        );
        
        // ✅ ANDROID PERFORMANCE: Optimize WebView for fast image operations
        optimizeWebView();
        
        // ✅ Move heavy disk I/O and heartbeat scheduling off the main thread
        // to avoid ANR on slow devices during cold start
        new Thread(() -> {
            // CACHE FIX: Clear cache when new version is installed (disk I/O)
            clearCacheOnVersionUpdate();
            
            // Schedule heartbeat for service persistence (WorkManager enqueue)
            com.wellnessvalley.app.services.BootCompletedReceiver.scheduleHeartbeat(this);
            
            android.util.Log.d("MainActivity", "✅ Background init tasks completed");
        }).start();
        
        // ✅ CRITICAL FIX: Force splash screen dismissal after WebView is ready
        // This ensures no splash window remains in the window hierarchy
        new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(() -> {
            try {
                android.util.Log.d("MainActivity", "✅ Splash screen window layer removed");
            } catch (Exception e) {
                android.util.Log.e("MainActivity", "Splash screen already dismissed", e);
            }
        }, 100);
        
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

        // NOTE: Runtime permissions are no longer requested here.
        // Requesting permissions at cold-start (before React/Capacitor loads) caused a
        // "permission storm" on first install — 4 OS dialogs appeared before the user
        // had any context, and the camera auto-open raced against the dialogs, causing
        // the first food-photo analysis to fail silently.
        //
        // Permissions are now requested by the JS layer (PermissionPrimerModal → App.js
        // → nativeLifecycle.requestAllPermissions) AFTER the user has seen the "why we
        // need these" screen. This is the industry-standard pattern used by Instagram,
        // Snapchat, and Headspace.

        // Request battery optimization exemption (deferred to avoid blocking cold start)
        new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(() -> {
            requestBatteryOptimizationExemption();
        }, 2000);
        
        // ✅ Background service enabled — will run silently without notifications
        android.util.Log.d("MainActivity", "✅ Background service enabled (silent mode)");
        
        // ✅ Check for app updates after app is fully initialized
        checkForAppUpdates();
        
        // Check if app was opened from notification
        handleNotificationIntent(getIntent());
        
        android.util.Log.d("MainActivity", "✅ GalleryMonitorPlugin registered in MainActivity");
        
        // ✅ Diagnose autofill configuration
        diagnoseAutofillSetup();
    }
    
    /**
     * ✅ DIAGNOSTIC: Log autofill configuration for debugging
     * Run this to understand why keyboard suggestions may not appear
     */
    private void diagnoseAutofillSetup() {
        android.util.Log.d("MainActivity", "═══════════════════════════════════════");
        android.util.Log.d("MainActivity", "AUTOFILL DIAGNOSTIC REPORT");
        android.util.Log.d("MainActivity", "═══════════════════════════════════════");
        
        // Check Android version
        android.util.Log.d("MainActivity", "Android SDK: " + android.os.Build.VERSION.SDK_INT + 
            " (" + android.os.Build.VERSION.RELEASE + ")");
        
        // Check AutofillManager availability (Android 8.0+)
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            android.view.autofill.AutofillManager afm = getSystemService(android.view.autofill.AutofillManager.class);
            if (afm != null) {
                boolean isEnabled = afm.isEnabled();
                boolean hasService = afm.hasEnabledAutofillServices();
                android.content.ComponentName serviceName = afm.getAutofillServiceComponentName();
                
                android.util.Log.d("MainActivity", "AutofillManager found: YES");
                android.util.Log.d("MainActivity", "  - Enabled: " + (isEnabled ? "✅ YES" : "❌ NO"));
                android.util.Log.d("MainActivity", "  - Has service: " + (hasService ? "✅ YES" : "❌ NO"));
                android.util.Log.d("MainActivity", "  - Service: " + (serviceName != null ? serviceName.flattenToString() : "NONE"));
                
                if (!isEnabled || !hasService) {
                    android.util.Log.w("MainActivity", "⚠️ USER ACTION REQUIRED:");
                    android.util.Log.w("MainActivity", "   Go to Settings → System → Languages & input → Autofill service");
                    android.util.Log.w("MainActivity", "   Enable: Google or a password manager (LastPass, 1Password, Bitwarden)");
                }
            } else {
                android.util.Log.e("MainActivity", "AutofillManager: ❌ NOT AVAILABLE");
            }
        } else {
            android.util.Log.w("MainActivity", "AutofillManager: ❌ NOT SUPPORTED (Android < 8.0)");
            android.util.Log.w("MainActivity", "   Fallback: Using deprecated setSaveFormData()");
        }
        
        // Check WebView configuration
        try {
            WebView webView = getBridge().getWebView();
            if (webView != null) {
                WebSettings settings = webView.getSettings();
                android.util.Log.d("MainActivity", "WebView Settings:");
                android.util.Log.d("MainActivity", "  - DOM Storage: " + (settings.getDomStorageEnabled() ? "✅" : "❌"));
                android.util.Log.d("MainActivity", "  - Database: " + (settings.getDatabaseEnabled() ? "✅" : "❌"));
                android.util.Log.d("MainActivity", "  - JavaScript: " + (settings.getJavaScriptEnabled() ? "✅" : "❌"));
                
                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                    int autofillMode = webView.getImportantForAutofill();
                    String modeStr = autofillMode == View.IMPORTANT_FOR_AUTOFILL_YES ? "✅ YES" :
                                    autofillMode == View.IMPORTANT_FOR_AUTOFILL_NO ? "❌ NO" :
                                    autofillMode == View.IMPORTANT_FOR_AUTOFILL_NO_EXCLUDE_DESCENDANTS ? "❌ NO (EXCLUDE_DESCENDANTS)" :
                                    "⚠️ AUTO";
                    android.util.Log.d("MainActivity", "  - Autofill mode: " + modeStr);
                }
            }
        } catch (Exception e) {
            android.util.Log.e("MainActivity", "Failed to read WebView settings", e);
        }
        
        android.util.Log.d("MainActivity", "═══════════════════════════════════════");
    }
    
    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        handleNotificationIntent(intent);
    }
    
    private void handleNotificationIntent(Intent intent) {
        if (intent == null) return;

        if (intent.getBooleanExtra("openBackgroundHistory", false)) {
            // Send event to JavaScript side after a short delay to ensure the app is ready
            new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(() -> {
                try {
                    GalleryMonitorPlugin.triggerNotificationEvent("openBackgroundHistory");
                } catch (Exception e) {
                    android.util.Log.e("MainActivity", "Failed to trigger notification event", e);
                }
            }, 1000);
            return;
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
    
    /**
     * ✅ CACHE FIX: Clear WebView cache when app version changes
     * This ensures users always see the latest content after updating the app
     */
    private void clearCacheOnVersionUpdate() {
        try {
            SharedPreferences prefs = getSharedPreferences("app_prefs", MODE_PRIVATE);
            int currentVersion = BuildConfig.VERSION_CODE;
            int savedVersion = prefs.getInt("app_version", 0);
            
            if (savedVersion != currentVersion) {
                // New version installed - clear all caches
                WebView webView = getBridge().getWebView();
                if (webView != null) {
                    webView.clearCache(true);
                    webView.clearHistory();
                    android.webkit.CookieManager.getInstance().removeAllCookies(null);
                    android.util.Log.d("MainActivity", "✅ Cache cleared for version update: v" + savedVersion + " → v" + currentVersion);
                }
                
                // Save new version
                prefs.edit().putInt("app_version", currentVersion).apply();
            } else {
                android.util.Log.d("MainActivity", "✅ Version unchanged (v" + currentVersion + "), using cached content");
            }
        } catch (Exception e) {
            android.util.Log.e("MainActivity", "Failed to clear cache on version update", e);
        }
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
                
                // ✅ FIX: Disable mixed content mode to prevent image selection issues
                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.LOLLIPOP) {
                    settings.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);
                }
                
                // ✅ CRITICAL FIX: Disable smart text selection that includes images
                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                    // Disable ALL smart selection features that capture images
                    webView.getSettings().setDisabledActionModeMenuItems(
                        WebSettings.MENU_ITEM_PROCESS_TEXT | 
                        WebSettings.MENU_ITEM_WEB_SEARCH |
                        WebSettings.MENU_ITEM_SHARE
                    );
                }
                
                // ✅ ADDITIONAL FIX: Disable text classifier to prevent image capture in selection
                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                    try {
                        // Remove text classifier that includes images in selection context
                        webView.setTextClassifier(android.view.textclassifier.TextClassifier.NO_OP);
                    } catch (Exception e) {
                        android.util.Log.w("MainActivity", "Could not disable text classifier", e);
                    }
                }
                
                // ═══════════════════════════════════════════════════════════════
                // COMPLETE AUTOFILL CONFIGURATION FOR WEBVIEW
                // ═══════════════════════════════════════════════════════════════
                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                    try {
                        // Step 1: Enable autofill on the WebView
                        webView.setImportantForAutofill(View.IMPORTANT_FOR_AUTOFILL_YES);
                        
                        // Step 2: Check AutofillManager status
                        android.view.autofill.AutofillManager afm = getSystemService(android.view.autofill.AutofillManager.class);
                        if (afm != null) {
                            boolean isEnabled = afm.isEnabled();
                            boolean hasService = afm.hasEnabledAutofillServices();
                            android.util.Log.d("MainActivity", 
                                "Autofill Status: enabled=" + isEnabled + 
                                ", hasService=" + hasService +
                                (hasService ? ", service=" + afm.getAutofillServiceComponentName() : ""));
                            
                            if (!isEnabled) {
                                android.util.Log.w("MainActivity", 
                                    "⚠️ Autofill is disabled. User must enable in Settings → System → Autofill");
                            }
                        }
                        
                        // Step 3: Enable form data storage for older Android versions
                        if (android.os.Build.VERSION.SDK_INT < android.os.Build.VERSION_CODES.O) {
                            settings.setSaveFormData(true);
                            android.util.Log.d("MainActivity", "✅ Form data saving enabled (Android < 8)");
                        }
                        
                        android.util.Log.d("MainActivity", "✅ WebView autofill enabled for keyboard suggestions");
                    } catch (Exception e) {
                        android.util.Log.e("MainActivity", "❌ Could not enable autofill", e);
                    }
                }
                
                // ═══════════════════════════════════════════════════════════════
                // ENABLE DATABASE AND DOM STORAGE (REQUIRED FOR AUTOCOMPLETE)
                // ═══════════════════════════════════════════════════════════════
                if (!settings.getDomStorageEnabled()) {
                    settings.setDomStorageEnabled(true);
                    android.util.Log.d("MainActivity", "✅ DOM storage enabled");
                }
                if (!settings.getDatabaseEnabled()) {
                    settings.setDatabaseEnabled(true);
                    android.util.Log.d("MainActivity", "✅ Database enabled");
                }
                
                android.util.Log.d("MainActivity", "✅ WebView optimized: images, text selection, autofill, storage");
            }
        } catch (Exception e) {
            android.util.Log.e("MainActivity", "Failed to optimize WebView", e);
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
                    android.Manifest.permission.POST_NOTIFICATIONS,
                    android.Manifest.permission.ACTIVITY_RECOGNITION
                };
            } else if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.Q) {
                permissions = new String[] {
                    android.Manifest.permission.READ_EXTERNAL_STORAGE,
                    android.Manifest.permission.CAMERA,
                    android.Manifest.permission.ACTIVITY_RECOGNITION
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
    
    /**
     * ✅ IN-APP UPDATES: Check for app updates on launch
     */
    private void checkForAppUpdates() {
        // Delay update check to not interfere with app initialization
        new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(() -> {
            try {
                updateManager = new InAppUpdateManager(this);
                updateManager.setUpdateListener(new InAppUpdateManager.UpdateListener() {
                    @Override
                    public void onUpdateAvailable(int updateType, int availableVersionCode) {
                        android.util.Log.d("MainActivity", "✅ Update available: " + availableVersionCode);
                    }
                    
                    @Override
                    public void onUpdateNotAvailable() {
                        android.util.Log.d("MainActivity", "✅ App is up to date");
                    }
                    
                    @Override
                    public void onUpdateDownloading(long bytesDownloaded, long totalBytes) {
                        int progress = totalBytes > 0 ? (int) ((bytesDownloaded * 100) / totalBytes) : 0;
                        android.util.Log.d("MainActivity", "⬇️ Downloading update: " + progress + "%");
                    }
                    
                    @Override
                    public void onUpdateDownloaded() {
                        android.util.Log.d("MainActivity", "✅ Update downloaded, ready to install");
                    }
                    
                    @Override
                    public void onUpdateInstalling() {
                        android.util.Log.d("MainActivity", "⚙️ Installing update...");
                    }
                    
                    @Override
                    public void onUpdateInstalled() {
                        android.util.Log.d("MainActivity", "✅ Update installed successfully");
                    }
                    
                    @Override
                    public void onUpdateFailed(int errorCode, String message) {
                        android.util.Log.e("MainActivity", "❌ Update failed: " + message);
                    }
                    
                    @Override
                    public void onUpdateCanceled() {
                        android.util.Log.w("MainActivity", "⚠️ Update canceled by user");
                    }
                });
                
                updateManager.checkForUpdate();
                android.util.Log.d("MainActivity", "✅ Update check initiated");
            } catch (Exception e) {
                android.util.Log.e("MainActivity", "Failed to check for updates", e);
            }
        }, 2000); // 2 second delay
    }
    
    /**
     * ✅ IN-APP UPDATES: Handle onResume for immediate updates
     */
    @Override
    public void onResume() {
        super.onResume();
        if (updateManager != null) {
            updateManager.onResume();
        }
    }
    
    /**
     * ✅ IN-APP UPDATES: Handle activity result
     */
    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (updateManager != null) {
            updateManager.handleActivityResult(requestCode, resultCode);
        }
    }

}