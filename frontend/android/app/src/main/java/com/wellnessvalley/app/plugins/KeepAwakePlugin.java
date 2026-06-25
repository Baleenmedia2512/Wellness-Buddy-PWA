package com.wellnessvalley.app.plugins;

import android.os.PowerManager;
import android.view.WindowManager;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * KeepAwakePlugin — Prevents screen from sleeping while app is active.
 * 
 * Activated when app comes to foreground, released when backgrounded.
 * Uses FLAG_KEEP_SCREEN_ON (no special permission needed, cleaner than WAKE_LOCK).
 */
@CapacitorPlugin(name = "KeepAwake")
public class KeepAwakePlugin extends Plugin {
    
    private boolean isActive = false;

    /**
     * Activate screen keep-awake using FLAG_KEEP_SCREEN_ON.
     * This approach is preferred over PowerManager.WakeLock because:
     * - No WAKE_LOCK permission needed
     * - Automatically released when activity is destroyed
     * - Only keeps screen on when app is visible (better UX)
     */
    @PluginMethod
    public void activate(PluginCall call) {
        try {
            if (!isActive) {
                getActivity().runOnUiThread(() -> {
                    getActivity().getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                });
                isActive = true;
                android.util.Log.d("KeepAwake", "✅ Screen keep-awake activated");
            }
            call.resolve();
        } catch (Exception e) {
            android.util.Log.e("KeepAwake", "Failed to activate keep-awake", e);
            call.reject("Failed to activate keep-awake: " + e.getMessage());
        }
    }

    /**
     * Deactivate screen keep-awake.
     * Called when app goes to background to restore normal auto-lock behavior.
     */
    @PluginMethod
    public void deactivate(PluginCall call) {
        try {
            if (isActive) {
                getActivity().runOnUiThread(() -> {
                    getActivity().getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                });
                isActive = false;
                android.util.Log.d("KeepAwake", "✅ Screen keep-awake deactivated");
            }
            call.resolve();
        } catch (Exception e) {
            android.util.Log.e("KeepAwake", "Failed to deactivate keep-awake", e);
            call.reject("Failed to deactivate keep-awake: " + e.getMessage());
        }
    }

    @Override
    protected void handleOnPause() {
        super.handleOnPause();
        // Auto-release when activity pauses (app backgrounded)
        if (isActive) {
            try {
                getActivity().getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                isActive = false;
                android.util.Log.d("KeepAwake", "✅ Screen keep-awake auto-released on pause");
            } catch (Exception e) {
                android.util.Log.e("KeepAwake", "Failed to auto-release on pause", e);
            }
        }
    }
}
