package com.wellnessvalley.app.plugins;

import android.Manifest;
import android.content.Context;
import android.content.pm.PackageManager;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.os.Build;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;

@CapacitorPlugin(
    name = "StepCounter",
    permissions = {
        @Permission(alias = "activityRecognition", strings = { Manifest.permission.ACTIVITY_RECOGNITION })
    }
)
public class StepCounterPlugin extends Plugin implements SensorEventListener {
    private SensorManager sensorManager;
    private Sensor stepCounterSensor;
    private boolean isTracking = false;
    private float currentTotalSteps = -1f;

    @Override
    public void load() {
        super.load();
        sensorManager = (SensorManager) getContext().getSystemService(Context.SENSOR_SERVICE);
        if (sensorManager != null) {
            stepCounterSensor = sensorManager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER);
        }
    }

    @PluginMethod
    public void isAvailable(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("available", stepCounterSensor != null);
        call.resolve(ret);
    }

    @PluginMethod
    public void getPermissionStatus(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("granted", hasActivityRecognitionPermission());
        ret.put("status", hasActivityRecognitionPermission() ? "granted" : "denied");
        call.resolve(ret);
    }

    @PluginMethod
    public void requestPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            JSObject ret = new JSObject();
            ret.put("granted", true);
            ret.put("status", "granted");
            call.resolve(ret);
            return;
        }

        if (hasActivityRecognitionPermission()) {
            JSObject ret = new JSObject();
            ret.put("granted", true);
            ret.put("status", "granted");
            call.resolve(ret);
            return;
        }

        requestPermissionForAlias("activityRecognition", call, "permissionCallback");
    }

    @com.getcapacitor.annotation.PermissionCallback
    private void permissionCallback(PluginCall call) {
        boolean granted = getPermissionState("activityRecognition") == PermissionState.GRANTED;
        JSObject ret = new JSObject();
        ret.put("granted", granted);
        ret.put("status", granted ? "granted" : "denied");
        if (granted) {
            call.resolve(ret);
        } else {
            call.reject("ACTIVITY_RECOGNITION permission denied", "PERMISSION_DENIED");
        }
    }

    @PluginMethod
    public void startTracking(PluginCall call) {
        if (stepCounterSensor == null) {
            call.reject("Step counter sensor not available on this device");
            return;
        }

        if (!hasActivityRecognitionPermission()) {
            call.reject("ACTIVITY_RECOGNITION permission required");
            return;
        }

        if (sensorManager == null) {
            call.reject("Sensor manager unavailable");
            return;
        }

        sensorManager.registerListener(this, stepCounterSensor, SensorManager.SENSOR_DELAY_NORMAL);
        isTracking = true;

        JSObject ret = new JSObject();
        ret.put("started", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void stopTracking(PluginCall call) {
        if (sensorManager != null) {
            sensorManager.unregisterListener(this);
        }
        isTracking = false;

        JSObject ret = new JSObject();
        ret.put("stopped", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void getCurrentStepCount(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("totalSteps", currentTotalSteps >= 0 ? (int) currentTotalSteps : null);
        ret.put("isTracking", isTracking);
        call.resolve(ret);
    }

    /**
     * Returns per-day step totals tracked by the background service (GalleryMonitorService).
     * Reads the "WellnessSteps" SharedPreferences that the service writes every sensor update.
     *
     * Called by StepCounter.js on app open to backfill missing DB days.
     *
     * Input: { days: number }  — how many days back to look (default 7)
     * Output: { history: [ { date: "YYYY-MM-DD", steps: number } ] }
     */
    @PluginMethod
    public void getBackgroundStepHistory(PluginCall call) {
        int days = call.getInt("days", 7);
        android.content.SharedPreferences prefs = getContext()
                .getSharedPreferences("WellnessSteps", android.content.Context.MODE_PRIVATE);

        com.getcapacitor.JSArray history = new com.getcapacitor.JSArray();
        java.util.Calendar cal = java.util.Calendar.getInstance();

        for (int i = days - 1; i >= 0; i--) {
            java.util.Calendar day = (java.util.Calendar) cal.clone();
            day.add(java.util.Calendar.DAY_OF_YEAR, -i);
            String dateKey = String.format(java.util.Locale.US, "%04d-%02d-%02d",
                    day.get(java.util.Calendar.YEAR),
                    day.get(java.util.Calendar.MONTH) + 1,
                    day.get(java.util.Calendar.DAY_OF_MONTH));

            int steps = prefs.getInt("step_daily_" + dateKey, 0);
            JSObject entry = new JSObject();
            entry.put("date", dateKey);
            entry.put("steps", steps);
            history.put(entry);
        }

        JSObject ret = new JSObject();
        ret.put("history", history);
        call.resolve(ret);
    }

    /**
     * Returns the last GPS location stored by GalleryMonitorService in WellnessGPS SharedPrefs.
     * Used by StepCounter.js to update the outdoor map polyline.
     */
    @PluginMethod
    public void getLastGpsLocation(PluginCall call) {
        android.content.SharedPreferences prefs = getContext()
                .getSharedPreferences("WellnessGPS", android.content.Context.MODE_PRIVATE);
        long timestamp = prefs.getLong("gps_timestamp", 0L);
        JSObject ret = new JSObject();
        ret.put("lat", (double) prefs.getFloat("gps_lat", 0f));
        ret.put("lng", (double) prefs.getFloat("gps_lng", 0f));
        ret.put("accuracy", (double) prefs.getFloat("gps_accuracy", 999f));
        ret.put("isOutdoor", prefs.getBoolean("gps_is_outdoor", false));
        ret.put("timestamp", timestamp);
        ret.put("hasLocation", timestamp > 0);
        call.resolve(ret);
    }

    /**
     * Returns the background-recorded GPS route points for a given date.
     * The JSON array is accumulated by GalleryMonitorService while the app runs
     * in the background.
     *
     * @param call Optional "date" string ("YYYY-MM-DD"). Defaults to today.
     */
    @PluginMethod
    public void getBackgroundRoutePoints(PluginCall call) {
        android.content.SharedPreferences prefs = getContext()
                .getSharedPreferences("WellnessGPS", android.content.Context.MODE_PRIVATE);

        String storedDate = prefs.getString("route_date", "");
        String today = new java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US)
                .format(new java.util.Date());

        JSObject ret = new JSObject();
        // If the stored date doesn't match today the array belongs to yesterday — return empty
        if (!storedDate.equals(today)) {
            ret.put("points", "[]");
            ret.put("date", today);
        } else {
            String json = prefs.getString("route_points", "[]");
            ret.put("points", json);
            ret.put("date", storedDate);
        }
        call.resolve(ret);
    }

    @Override
    public void onSensorChanged(SensorEvent event) {
        if (event == null || event.sensor == null || event.sensor.getType() != Sensor.TYPE_STEP_COUNTER) {
            return;
        }

        currentTotalSteps = event.values[0];

        JSObject payload = new JSObject();
        payload.put("totalSteps", (int) currentTotalSteps);
        payload.put("timestamp", System.currentTimeMillis());
        notifyListeners("stepUpdate", payload);
    }

    @Override
    public void onAccuracyChanged(Sensor sensor, int accuracy) {
        // No action required for step counter accuracy changes.
    }

    @Override
    protected void handleOnPause() {
        super.handleOnPause();
        if (sensorManager != null && isTracking) {
            sensorManager.unregisterListener(this);
        }
    }

    @Override
    protected void handleOnResume() {
        super.handleOnResume();
        if (sensorManager != null && isTracking && stepCounterSensor != null && hasActivityRecognitionPermission()) {
            sensorManager.registerListener(this, stepCounterSensor, SensorManager.SENSOR_DELAY_NORMAL);
        }
    }

    private boolean hasActivityRecognitionPermission() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            return true;
        }

        return ContextCompat.checkSelfPermission(getContext(), Manifest.permission.ACTIVITY_RECOGNITION)
            == PackageManager.PERMISSION_GRANTED;
    }
}
