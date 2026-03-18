package com.wellnessvalley.app.plugins;

import android.app.AppOpsManager;
import android.app.usage.UsageEvents;
import android.app.usage.UsageStatsManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.os.Build;
import android.provider.Settings;
import android.util.Log;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.ArrayList;
import java.util.Calendar;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@CapacitorPlugin(name = "ScreenTime")
public class ScreenTimePlugin extends Plugin {
    private static final String TAG = "ScreenTimePlugin";

    // Popular apps to track with friendly names
    private static final Map<String, String> TRACKED_APPS = new HashMap<>();
    // System/launcher packages to EXCLUDE from total screen time
    private static final Set<String> EXCLUDED_PACKAGES = new HashSet<>();
    static {
        TRACKED_APPS.put("com.instagram.android", "Instagram");
        TRACKED_APPS.put("com.whatsapp", "WhatsApp");
        TRACKED_APPS.put("com.facebook.katana", "Facebook");
        TRACKED_APPS.put("com.facebook.orca", "Messenger");
        TRACKED_APPS.put("com.twitter.android", "X (Twitter)");
        TRACKED_APPS.put("com.snapchat.android", "Snapchat");
        TRACKED_APPS.put("com.zhiliaoapp.musically", "TikTok");
        TRACKED_APPS.put("com.google.android.youtube", "YouTube");
        TRACKED_APPS.put("com.linkedin.android", "LinkedIn");
        TRACKED_APPS.put("org.telegram.messenger", "Telegram");
        TRACKED_APPS.put("com.reddit.frontpage", "Reddit");
        TRACKED_APPS.put("com.pinterest", "Pinterest");
        TRACKED_APPS.put("com.spotify.music", "Spotify");
        TRACKED_APPS.put("com.netflix.mediaclient", "Netflix");
        TRACKED_APPS.put("com.amazon.avod.thirdpartyclient", "Prime Video");
        TRACKED_APPS.put("com.google.android.apps.maps", "Google Maps");
        TRACKED_APPS.put("com.google.android.gm", "Gmail");
        TRACKED_APPS.put("com.microsoft.teams", "Microsoft Teams");
        TRACKED_APPS.put("us.zoom.videomeetings", "Zoom");
        TRACKED_APPS.put("com.discord", "Discord");

        // Exclude launchers, system UI, and background system packages
        EXCLUDED_PACKAGES.add("com.miui.home");
        EXCLUDED_PACKAGES.add("com.mi.android.globallauncher");
        EXCLUDED_PACKAGES.add("com.google.android.apps.nexuslauncher");
        EXCLUDED_PACKAGES.add("com.sec.android.app.launcher");
        EXCLUDED_PACKAGES.add("com.huawei.android.launcher");
        EXCLUDED_PACKAGES.add("com.oppo.launcher");
        EXCLUDED_PACKAGES.add("com.oneplus.launcher");
        EXCLUDED_PACKAGES.add("com.realme.launcher");
        EXCLUDED_PACKAGES.add("com.vivo.launcher");
        EXCLUDED_PACKAGES.add("com.android.launcher");
        EXCLUDED_PACKAGES.add("com.android.launcher2");
        EXCLUDED_PACKAGES.add("com.android.launcher3");
        EXCLUDED_PACKAGES.add("com.teslacoilsw.launcher");
        EXCLUDED_PACKAGES.add("com.actionlauncher.playstore");
        EXCLUDED_PACKAGES.add("com.microsoft.launcher");
        EXCLUDED_PACKAGES.add("com.android.systemui");
        EXCLUDED_PACKAGES.add("com.android.settings");
        EXCLUDED_PACKAGES.add("com.google.android.permissioncontroller");
        EXCLUDED_PACKAGES.add("com.google.android.gms");
        EXCLUDED_PACKAGES.add("com.android.vending");
        EXCLUDED_PACKAGES.add("com.google.android.apps.wellbeing");
        EXCLUDED_PACKAGES.add("com.samsung.android.forest");
    }

    @PluginMethod
    public void hasPermission(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("granted", hasUsageStatsPermission());
        call.resolve(ret);
    }

    @PluginMethod
    public void requestPermission(PluginCall call) {
        if (hasUsageStatsPermission()) {
            JSObject ret = new JSObject();
            ret.put("granted", true);
            call.resolve(ret);
            return;
        }

        try {
            Intent intent = new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);

            JSObject ret = new JSObject();
            ret.put("granted", false);
            ret.put("message", "Usage access settings opened. Please grant permission.");
            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "Failed to open usage access settings", e);
            call.reject("Failed to open usage access settings", e);
        }
    }

    @PluginMethod
    public void getTodayScreenTime(PluginCall call) {
        if (!hasUsageStatsPermission()) {
            call.reject("Usage stats permission not granted");
            return;
        }

        try {
            Calendar calendar = Calendar.getInstance();
            calendar.set(Calendar.HOUR_OF_DAY, 0);
            calendar.set(Calendar.MINUTE, 0);
            calendar.set(Calendar.SECOND, 0);
            calendar.set(Calendar.MILLISECOND, 0);
            long startTime = calendar.getTimeInMillis();
            long endTime = System.currentTimeMillis();

            UsageStatsManager usageStatsManager = (UsageStatsManager)
                    getContext().getSystemService(Context.USAGE_STATS_SERVICE);

            // Use UsageEvents API (same as Digital Wellbeing) for precise per-day times
            Map<String, Long> packageUsage = calculateUsageFromEvents(
                    usageStatsManager, startTime, endTime);

            long totalScreenTimeMs = 0;
            JSArray appUsageArray = new JSArray();
            PackageManager pm = getContext().getPackageManager();

            // Sort by usage time descending
            List<Map.Entry<String, Long>> sortedEntries = new ArrayList<>(packageUsage.entrySet());
            Collections.sort(sortedEntries, (a, b) -> Long.compare(b.getValue(), a.getValue()));

            for (Map.Entry<String, Long> entry : sortedEntries) {
                String packageName = entry.getKey();
                long usageMs = entry.getValue();
                long usageSeconds = usageMs / 1000;

                // Skip apps with less than 1 minute usage
                if (usageSeconds < 60) continue;

                boolean isExcluded = isExcludedPackage(packageName);
                boolean isTracked = TRACKED_APPS.containsKey(packageName);
                String appName = getAppName(pm, packageName);

                // Only count non-excluded apps in the total
                if (!isExcluded) {
                    totalScreenTimeMs += usageMs;
                }

                JSObject appObj = new JSObject();
                appObj.put("packageName", packageName);
                appObj.put("appName", appName);
                appObj.put("usageSeconds", usageSeconds);
                appObj.put("isTrackedApp", isTracked);
                appObj.put("isSystemApp", isExcluded);
                appObj.put("category", isTracked ? "social" : (isExcluded ? "system" : "other"));
                appUsageArray.put(appObj);
            }

            JSObject result = new JSObject();
            result.put("totalScreenTimeSeconds", totalScreenTimeMs / 1000);
            result.put("appUsage", appUsageArray);
            result.put("date", getDateString());
            call.resolve(result);

        } catch (Exception e) {
            Log.e(TAG, "Failed to get screen time", e);
            call.reject("Failed to get screen time data", e);
        }
    }

    /**
     * Calculate exact foreground time per app using UsageEvents.
     * This is the same approach Android Digital Wellbeing uses.
     * It tracks MOVE_TO_FOREGROUND → MOVE_TO_BACKGROUND transitions
     * and calculates precise durations within the given time window.
     */
    private Map<String, Long> calculateUsageFromEvents(
            UsageStatsManager usageStatsManager, long startTime, long endTime) {

        Map<String, Long> packageUsage = new HashMap<>();
        // Track which app is currently in foreground and when it started
        Map<String, Long> foregroundStartTimes = new HashMap<>();

        UsageEvents usageEvents = usageStatsManager.queryEvents(startTime, endTime);
        UsageEvents.Event event = new UsageEvents.Event();

        while (usageEvents.hasNextEvent()) {
            usageEvents.getNextEvent(event);
            String packageName = event.getPackageName();
            int eventType = event.getEventType();
            long eventTime = event.getTimeStamp();

            if (eventType == UsageEvents.Event.MOVE_TO_FOREGROUND
                    || eventType == UsageEvents.Event.ACTIVITY_RESUMED) {
                // App came to foreground — record start time
                foregroundStartTimes.put(packageName, eventTime);
            } else if (eventType == UsageEvents.Event.MOVE_TO_BACKGROUND
                    || eventType == UsageEvents.Event.ACTIVITY_PAUSED) {
                // App went to background — calculate duration
                Long fgStart = foregroundStartTimes.get(packageName);
                if (fgStart != null) {
                    long duration = eventTime - fgStart;
                    if (duration > 0) {
                        long existing = packageUsage.containsKey(packageName)
                                ? packageUsage.get(packageName) : 0;
                        packageUsage.put(packageName, existing + duration);
                    }
                    foregroundStartTimes.remove(packageName);
                }
            }
        }

        // If an app is still in foreground (no background event yet), count up to now
        for (Map.Entry<String, Long> entry : foregroundStartTimes.entrySet()) {
            String packageName = entry.getKey();
            long fgStart = entry.getValue();
            long duration = endTime - fgStart;
            if (duration > 0) {
                long existing = packageUsage.containsKey(packageName)
                        ? packageUsage.get(packageName) : 0;
                packageUsage.put(packageName, existing + duration);
            }
        }

        return packageUsage;
    }

    private boolean hasUsageStatsPermission() {
        try {
            AppOpsManager appOps = (AppOpsManager) getContext().getSystemService(Context.APP_OPS_SERVICE);
            int mode;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                mode = appOps.unsafeCheckOpNoThrow(
                        AppOpsManager.OPSTR_GET_USAGE_STATS,
                        android.os.Process.myUid(),
                        getContext().getPackageName()
                );
            } else {
                mode = appOps.checkOpNoThrow(
                        AppOpsManager.OPSTR_GET_USAGE_STATS,
                        android.os.Process.myUid(),
                        getContext().getPackageName()
                );
            }
            return mode == AppOpsManager.MODE_ALLOWED;
        } catch (Exception e) {
            Log.e(TAG, "Error checking usage stats permission", e);
            return false;
        }
    }

    private String getAppName(PackageManager pm, String packageName) {
        if (TRACKED_APPS.containsKey(packageName)) {
            return TRACKED_APPS.get(packageName);
        }
        try {
            ApplicationInfo appInfo = pm.getApplicationInfo(packageName, 0);
            return pm.getApplicationLabel(appInfo).toString();
        } catch (PackageManager.NameNotFoundException e) {
            return packageName;
        }
    }

    private boolean isExcludedPackage(String packageName) {
        if (EXCLUDED_PACKAGES.contains(packageName)) {
            return true;
        }
        if (packageName.toLowerCase().contains("launcher")) {
            return true;
        }
        return false;
    }

    private String getDateString() {
        Calendar cal = Calendar.getInstance();
        int year = cal.get(Calendar.YEAR);
        int month = cal.get(Calendar.MONTH) + 1;
        int day = cal.get(Calendar.DAY_OF_MONTH);
        return String.format("%04d-%02d-%02d", year, month, day);
    }
}
