package com.wellnessvalley.app.plugins;

import android.content.Intent;
import android.util.Log;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.JSObject;
import com.wellnessvalley.app.InAppUpdateManager;
import com.google.android.play.core.install.model.AppUpdateType;

/**
 * Capacitor Plugin for Android In-App Updates
 * Provides JavaScript interface to native update functionality
 */
@CapacitorPlugin(name = "InAppUpdate")
public class InAppUpdatePlugin extends Plugin {
    private static final String TAG = "InAppUpdatePlugin";
    private InAppUpdateManager updateManager;
    
    @Override
    public void load() {
        super.load();
        Log.d(TAG, "InAppUpdatePlugin loaded");
    }
    
    /**
     * Initialize the update manager
     */
    private void initializeUpdateManager() {
        if (updateManager == null) {
            updateManager = new InAppUpdateManager(getActivity());
            setupUpdateListener();
        }
    }
    
    /**
     * Setup listener to send events to JavaScript
     */
    private void setupUpdateListener() {
        updateManager.setUpdateListener(new InAppUpdateManager.UpdateListener() {
            @Override
            public void onUpdateAvailable(int updateType, int availableVersionCode) {
                try {
                    JSObject data = new JSObject();
                    data.put("updateType", updateType == AppUpdateType.IMMEDIATE ? "immediate" : "flexible");
                    data.put("availableVersionCode", availableVersionCode);
                    notifyListeners("updateAvailable", data);
                } catch (Exception e) {
                    Log.e(TAG, "Error notifying update available", e);
                }
            }
            
            @Override
            public void onUpdateNotAvailable() {
                notifyListeners("updateNotAvailable", new JSObject());
            }
            
            @Override
            public void onUpdateDownloading(long bytesDownloaded, long totalBytes) {
                try {
                    JSObject data = new JSObject();
                    data.put("bytesDownloaded", bytesDownloaded);
                    data.put("totalBytes", totalBytes);
                    if (totalBytes > 0) {
                        data.put("progress", (int) ((bytesDownloaded * 100) / totalBytes));
                    }
                    notifyListeners("updateDownloading", data);
                } catch (Exception e) {
                    Log.e(TAG, "Error notifying download progress", e);
                }
            }
            
            @Override
            public void onUpdateDownloaded() {
                notifyListeners("updateDownloaded", new JSObject());
            }
            
            @Override
            public void onUpdateInstalling() {
                notifyListeners("updateInstalling", new JSObject());
            }
            
            @Override
            public void onUpdateInstalled() {
                notifyListeners("updateInstalled", new JSObject());
            }
            
            @Override
            public void onUpdateFailed(int errorCode, String message) {
                try {
                    JSObject data = new JSObject();
                    data.put("errorCode", errorCode);
                    data.put("message", message);
                    notifyListeners("updateFailed", data);
                } catch (Exception e) {
                    Log.e(TAG, "Error notifying update failed", e);
                }
            }
            
            @Override
            public void onUpdateCanceled() {
                notifyListeners("updateCanceled", new JSObject());
            }
        });
    }
    
    /**
     * Check for available updates
     * Called from JavaScript: InAppUpdate.checkForUpdate()
     */
    @PluginMethod
    public void checkForUpdate(PluginCall call) {
        try {
            Log.d(TAG, "checkForUpdate() called from JavaScript");
            initializeUpdateManager();
            updateManager.checkForUpdate();
            call.resolve();
        } catch (Exception e) {
            Log.e(TAG, "Error checking for update", e);
            call.reject("Failed to check for update: " + e.getMessage());
        }
    }
    
    /**
     * Complete flexible update (restart app)
     * Called from JavaScript: InAppUpdate.completeUpdate()
     */
    @PluginMethod
    public void completeUpdate(PluginCall call) {
        try {
            Log.d(TAG, "completeUpdate() called from JavaScript");
            if (updateManager != null) {
                updateManager.completeUpdate();
                call.resolve();
            } else {
                call.reject("Update manager not initialized");
            }
        } catch (Exception e) {
            Log.e(TAG, "Error completing update", e);
            call.reject("Failed to complete update: " + e.getMessage());
        }
    }
    
    /**
     * Check if flexible update is downloaded and ready
     * Called from JavaScript: InAppUpdate.checkDownloadedUpdate()
     */
    @PluginMethod
    public void checkDownloadedUpdate(PluginCall call) {
        try {
            Log.d(TAG, "checkDownloadedUpdate() called from JavaScript");
            initializeUpdateManager();
            updateManager.checkDownloadedUpdate();
            call.resolve();
        } catch (Exception e) {
            Log.e(TAG, "Error checking downloaded update", e);
            call.reject("Failed to check downloaded update: " + e.getMessage());
        }
    }
    
    /**
     * Handle activity result from update flow
     */
    @Override
    protected void handleOnActivityResult(int requestCode, int resultCode, Intent data) {
        super.handleOnActivityResult(requestCode, resultCode, data);
        if (updateManager != null) {
            updateManager.handleActivityResult(requestCode, resultCode);
        }
    }
    
    /**
     * Handle app resume (important for immediate updates)
     */
    @Override
    protected void handleOnResume() {
        super.handleOnResume();
        if (updateManager != null) {
            updateManager.onResume();
        }
    }
    
    /**
     * Cleanup when plugin is destroyed
     */
    @Override
    protected void handleOnDestroy() {
        super.handleOnDestroy();
        if (updateManager != null) {
            updateManager.unregisterListener();
        }
    }
}
