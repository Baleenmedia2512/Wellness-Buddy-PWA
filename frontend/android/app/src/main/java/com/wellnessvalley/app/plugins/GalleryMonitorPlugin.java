package com.wellnessvalley.app.plugins;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
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
            
            // ✅ Background service enabled — start GalleryMonitorService silently
            try {
                Context context = getContext();
                Intent serviceIntent = new Intent(context, GalleryMonitorService.class);
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

    /**
     * Called by React StepCounter backfill when it detects that SharedPreferences
     * holds a value much larger than the DB (stale phantom data from testing).
     * Sends an Intent to the running service so it resets both its on-disk
     * SharedPreferences key AND its in-memory stepStoredBaseline for today.
     */
    @PluginMethod
    public void syncDailySteps(PluginCall call) {
        try {
            String date  = call.getString("date");
            int    steps = call.getInt("steps", 0);
            if (date == null || date.isEmpty()) {
                call.reject("date is required");
                return;
            }
            Context context = getContext();
            Intent intent = new Intent(context, GalleryMonitorService.class);
            intent.putExtra("resetStepsDate", date);
            intent.putExtra("resetStepsValue", steps);
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                context.startForegroundService(intent);
            } else {
                context.startService(intent);
            }
            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "❌ Failed to sync daily steps", e);
            call.reject("Failed to sync daily steps", e);
        }
    }

    /**
     * Request an immediate service-side flush of today's steps to DB.
     * Useful for manual refresh while keeping service as the single writer.
     */
    @PluginMethod
    public void forceSaveTodaySteps(PluginCall call) {
        try {
            Context context = getContext();
            Intent intent = new Intent(context, GalleryMonitorService.class);
            intent.putExtra("forceSaveTodaySteps", true);
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                context.startForegroundService(intent);
            } else {
                context.startService(intent);
            }
            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "❌ Failed to force-save today steps", e);
            call.reject("Failed to force-save today steps", e);
        }
    }
}
