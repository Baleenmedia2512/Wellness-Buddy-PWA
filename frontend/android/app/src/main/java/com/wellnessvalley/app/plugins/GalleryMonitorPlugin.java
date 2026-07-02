package com.wellnessvalley.app.plugins;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.location.LocationManager;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import com.wellnessvalley.app.services.GalleryMonitorService;

import org.json.JSONArray;

@CapacitorPlugin(name = "GalleryMonitor")
public class GalleryMonitorPlugin extends Plugin {
    private static final String TAG = "GalleryMonitorPlugin";
    private static GalleryMonitorPlugin instance = null;
    
    @Override
    public void load() {
        super.load();
        instance = this;
        Log.d(TAG, "✅ GalleryMonitor plugin loaded");
    }
    
    @PluginMethod
    public void echo(PluginCall call) {
        try {
            String value = call.getString("value");
            if (value == null) {
                call.reject("Must provide a value");
                return;
            }

            JSObject ret = new JSObject();
            ret.put("value", value);
            Log.d(TAG, "Echo called with value: " + value);
            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "Failed to echo value", e);
            call.reject("Failed to echo value", e);
        }
    }

    @PluginMethod
    public void requestPermissions(PluginCall call) {
        try {
            // We'll implement actual permission requests later
            JSObject result = new JSObject();
            result.put("granted", true);
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Failed to request permissions", e);
        }
    }

    @PluginMethod
    public void setCurrentUser(PluginCall call) {
        try {
            String userId = call.getString("userId");
            if (userId == null) {
                Integer userIdNum = call.getInt("userId");
                if (userIdNum != null) {
                    userId = String.valueOf(userIdNum);
                } else {
                    call.reject("userId is required");
                    return;
                }
            }

            String userEmail = call.getString("userEmail");
            String cachedDbUserId = call.getString("cachedDbUserId");
            String apiBaseUrl = call.getString("apiBaseUrl");

            if (cachedDbUserId == null) {
                Integer cachedDbUserIdNum = call.getInt("cachedDbUserId");
                if (cachedDbUserIdNum != null) cachedDbUserId = String.valueOf(cachedDbUserIdNum);
            }

            Log.d(TAG, "setCurrentUser called with: userId=" + userId +
                      ", userEmail=" + userEmail + ", cachedDbUserId=" + cachedDbUserId);

            if (userId == null || userId.isEmpty()) {
                call.reject("User ID is required");
                return;
            }

            // Save user info in preferences
            SharedPreferences prefs = getContext().getSharedPreferences("WellnessValley", Context.MODE_PRIVATE);
            SharedPreferences.Editor editor = prefs.edit();
            editor.putString("current_user_id", userId);

            if (userEmail != null && !userEmail.isEmpty()) {
                editor.putString("current_user_email", userEmail);
            }

            if (cachedDbUserId != null && !cachedDbUserId.isEmpty()) {
                editor.putString("cached_db_user_id", cachedDbUserId);
                Log.d(TAG, "✅ Current user set - ID: " + userId + ", Email: " + userEmail +
                          ", cached_db_user_id: " + cachedDbUserId);
            } else {
                editor.remove("cached_db_user_id");
                Log.d(TAG, "✅ Current user set - ID: " + userId + ", Email: " + userEmail + " (DB cache cleared)");
            }

            if (apiBaseUrl != null && !apiBaseUrl.isEmpty()) {
                editor.putString("api_base_url", apiBaseUrl);
                Log.d(TAG, "✅ API base URL cached for service: " + apiBaseUrl);
            }

            editor.apply();
            
            // ✅ Background service enabled — start GalleryMonitorService silently.
            // Pass user credentials as Intent extras so the :background process
            // receives them reliably without depending on cross-process SharedPrefs
            // (MODE_MULTI_PROCESS is deprecated and unreliable on Android 8+).
            try {
                Context context = getContext();
                Intent serviceIntent = new Intent(context, GalleryMonitorService.class);
                serviceIntent.putExtra("userId", userId);
                if (userEmail != null && !userEmail.isEmpty()) {
                    serviceIntent.putExtra("userEmail", userEmail);
                }
                // Re-read the final cachedDbUserId value in case it was updated in prefs
                String finalCachedId = prefs.getString("cached_db_user_id", null);
                if (finalCachedId != null && !finalCachedId.isEmpty()) {
                    serviceIntent.putExtra("cachedDbUserId", finalCachedId);
                }
                String finalApiUrl = prefs.getString("api_base_url", null);
                if (finalApiUrl != null && !finalApiUrl.isEmpty()) {
                    serviceIntent.putExtra("apiBaseUrl", finalApiUrl);
                }
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(serviceIntent);
                } else {
                    context.startService(serviceIntent);
                }
                Log.d(TAG, "✅ Background service started silently for user: " + userEmail);
            } catch (Exception e) {
                Log.e(TAG, "❌ Failed to start background service", e);
            }
            
            JSObject result = new JSObject();
            result.put("success", true);
            call.resolve();
        } catch (Exception e) {
            Log.e(TAG, "❌ Failed to set current user", e);
            call.reject("Failed to set current user", e);
        }
    }
    
    // Static method to trigger notification events from MainActivity
    public static void triggerNotificationEvent(String action) {
        if (instance != null) {
            JSObject ret = new JSObject();
            ret.put("action", action);
            instance.notifyListeners("notificationClicked", ret);
        }
    }
    
    @PluginMethod
    public void startService(PluginCall call) {
        // ✅ Background service enabled
        try {
            Context context = getContext();
            Intent serviceIntent = new Intent(context, GalleryMonitorService.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(serviceIntent);
            } else {
                context.startService(serviceIntent);
            }
            Log.d(TAG, "✅ Background service started silently");
            call.resolve();
        } catch (Exception e) {
            Log.e(TAG, "❌ Failed to start service", e);
            call.reject("Failed to start service", e);
        }
    }
    
    @PluginMethod
    public void stopService(PluginCall call) {
        try {
            Context context = getContext();
            Intent serviceIntent = new Intent(context, GalleryMonitorService.class);
            context.stopService(serviceIntent);
            Log.d(TAG, "✅ Gallery monitor service stopped");
            call.resolve();
        } catch (Exception e) {
            Log.e(TAG, "❌ Failed to stop service", e);
            call.reject("Failed to stop service", e);
        }
    }
    
    @PluginMethod
    public void checkGallery(PluginCall call) {
        // ✅ Background service enabled
        Log.d(TAG, "✅ Manual gallery check triggered");
        JSObject ret = new JSObject();
        ret.put("success", true);
        call.resolve(ret);
    }



    /**
     * Opens the Android Location Settings screen so the user can toggle GPS on.
     * Mapped from JS: nativeLifecycle.openLocationSettings() → GalleryMonitorPlugin.openLocationSettings()
     */
    @PluginMethod
    public void openLocationSettings(PluginCall call) {
        try {
            Intent intent = new Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            Log.d(TAG, "✅ Location settings opened");
            call.resolve();
        } catch (Exception e) {
            Log.e(TAG, "❌ Failed to open location settings", e);
            call.reject("Failed to open location settings", e);
        }
    }

    /**
     * Returns { enabled: boolean } indicating whether Location Services (GPS) are
     * currently active on the device — instant, no timeout required.
     * API 28+ uses LocationManager.isLocationEnabled();
     * older APIs check GPS_PROVIDER or NETWORK_PROVIDER individually.
     */
    @PluginMethod
    public void isLocationEnabled(PluginCall call) {
        try {
            LocationManager locationManager =
                (LocationManager) getContext().getSystemService(Context.LOCATION_SERVICE);
            boolean isEnabled;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                isEnabled = locationManager.isLocationEnabled();
            } else {
                isEnabled = locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER)
                         || locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER);
            }
            JSObject result = new JSObject();
            result.put("enabled", isEnabled);
            Log.d(TAG, "✅ isLocationEnabled: " + isEnabled);
            call.resolve(result);
        } catch (Exception e) {
            Log.e(TAG, "❌ Failed to check location enabled", e);
            call.reject("Failed to check location enabled", e);
        }
    }

    @PluginMethod
    public void getCurrentUser(PluginCall call) {
        try {
            SharedPreferences prefs = getContext().getSharedPreferences("WellnessValley", Context.MODE_PRIVATE);
            String userId = prefs.getString("current_user_id", null);
            String userEmail = prefs.getString("current_user_email", null);
            
            JSObject ret = new JSObject();
            ret.put("userId", userId);
            ret.put("userEmail", userEmail);
            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "❌ Failed to get current user", e);
            call.reject("Failed to get current user", e);
        }
    }
    
    @PluginMethod
    public void clearCurrentUser(PluginCall call) {
        try {
            SharedPreferences prefs = getContext().getSharedPreferences("WellnessValley", Context.MODE_PRIVATE);
            prefs.edit()
                .remove("current_user_id")
                .remove("current_user_email")
                .remove("cached_db_user_id")  // Clear cached database UserId
                .remove("api_base_url")
                .apply();
            
            Log.d(TAG, "✅ Current user, email, and cached DB UserId cleared");
            call.resolve();
        } catch (Exception e) {
            Log.e(TAG, "❌ Failed to clear current user", e);
            call.reject("Failed to clear current user", e);
        }
    }
}
