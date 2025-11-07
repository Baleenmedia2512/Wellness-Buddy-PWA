package com.wellnessbuddy.app.plugins;

import android.content.Context;
import android.content.Intent;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import com.wellnessbuddy.app.services.CameraMonitorService;

/**
 * CameraMonitorPlugin - Capacitor plugin for camera photo detection
 * 
 * Provides JavaScript interface to control the native CameraMonitorService
 * which detects when users take photos with their personal camera app
 * and shows notifications asking if they want to add them to Wellness app.
 */
@CapacitorPlugin(name = "CameraMonitor")
public class CameraMonitorPlugin extends Plugin {
    private static final String TAG = "CameraMonitorPlugin";
    private static CameraMonitorPlugin instance = null;
    
    @Override
    public void load() {
        super.load();
        instance = this;
        Log.d(TAG, "✅ CameraMonitor plugin loaded");
    }
    
    /**
     * Start the camera monitoring service
     */
    @PluginMethod
    public void startMonitoring(PluginCall call) {
        try {
            Context context = getContext();
            Intent serviceIntent = new Intent(context, CameraMonitorService.class);
            
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                context.startForegroundService(serviceIntent);
            } else {
                context.startService(serviceIntent);
            }
            
            Log.d(TAG, "✅ Camera monitor service started");
            
            JSObject result = new JSObject();
            result.put("success", true);
            result.put("message", "Camera monitoring started");
            call.resolve(result);
            
        } catch (Exception e) {
            Log.e(TAG, "❌ Failed to start camera monitoring", e);
            call.reject("Failed to start camera monitoring", e);
        }
    }
    
    /**
     * Stop the camera monitoring service
     */
    @PluginMethod
    public void stopMonitoring(PluginCall call) {
        try {
            Context context = getContext();
            Intent serviceIntent = new Intent(context, CameraMonitorService.class);
            context.stopService(serviceIntent);
            
            Log.d(TAG, "✅ Camera monitor service stopped");
            
            JSObject result = new JSObject();
            result.put("success", true);
            result.put("message", "Camera monitoring stopped");
            call.resolve(result);
            
        } catch (Exception e) {
            Log.e(TAG, "❌ Failed to stop camera monitoring", e);
            call.reject("Failed to stop camera monitoring", e);
        }
    }
    
    /**
     * Check if the camera monitoring service is running
     */
    @PluginMethod
    public void isMonitoring(PluginCall call) {
        try {
            // Check if service is running
            android.app.ActivityManager manager = 
                    (android.app.ActivityManager) getContext().getSystemService(Context.ACTIVITY_SERVICE);
            
            boolean isRunning = false;
            if (manager != null) {
                for (android.app.ActivityManager.RunningServiceInfo service : 
                        manager.getRunningServices(Integer.MAX_VALUE)) {
                    if (CameraMonitorService.class.getName().equals(service.service.getClassName())) {
                        isRunning = true;
                        break;
                    }
                }
            }
            
            JSObject result = new JSObject();
            result.put("isRunning", isRunning);
            call.resolve(result);
            
        } catch (Exception e) {
            Log.e(TAG, "❌ Failed to check monitoring status", e);
            call.reject("Failed to check monitoring status", e);
        }
    }
    
    /**
     * Static method to trigger events from receivers or services
     */
    public static void triggerEvent(String eventName, JSObject data) {
        if (instance != null) {
            instance.notifyListeners(eventName, data);
        }
    }
}
