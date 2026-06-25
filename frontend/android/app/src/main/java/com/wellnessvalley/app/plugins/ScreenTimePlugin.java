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
        TRACKED_APPS.put("com.wellnessvalley.app", "Wellness Valley");
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

                boolean isExcluded = isExcludedPackage(packageName);
                boolean isTracked = TRACKED_APPS.containsKey(packageName);

                // Count ALL non-excluded apps in total (including brief sessions < 60s)
                // This matches Digital Wellbeing's calculation
                if (!isExcluded) {
                    totalScreenTimeMs += usageMs;
                }

                // Only show apps with >= 5 seconds in the per-app list (filter noise)
                if (usageSeconds < 5) continue;

                String appName = getAppName(pm, packageName);
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

    /**
     * Returns the app install date and how many days to sync.
     * Used by JS to dynamically calculate history range from install day → today.
     *
     * Output: { installDate: "YYYY-MM-DD", syncDays: number (1-14) }
     * syncDays is capped at 14 because UsageStatsManager reliably holds ~14 days of events.
     */
    @PluginMethod
    public void getInstallDate(PluginCall call) {
        try {
            android.content.pm.PackageInfo info = getContext().getPackageManager()
                    .getPackageInfo(getContext().getPackageName(), 0);
            long firstInstallMs = info.firstInstallTime;

            // Days since install, minimum 1 (today), max 14 (UsageStatsManager limit)
            long daysSinceInstall = (System.currentTimeMillis() - firstInstallMs) / (1000L * 60 * 60 * 24);
            int syncDays = (int) Math.min(Math.max(daysSinceInstall + 1, 1), 14);

            Calendar cal = Calendar.getInstance();
            cal.setTimeInMillis(firstInstallMs);
            String installDate = String.format(java.util.Locale.US, "%04d-%02d-%02d",
                    cal.get(Calendar.YEAR),
                    cal.get(Calendar.MONTH) + 1,
                    cal.get(Calendar.DAY_OF_MONTH));

            JSObject ret = new JSObject();
            ret.put("installDate", installDate);
            ret.put("syncDays", syncDays);
            call.resolve(ret);
        } catch (Exception e) {
            Log.w(TAG, "getInstallDate failed, defaulting to 14 days: " + e.getMessage());
            JSObject ret = new JSObject();
            ret.put("installDate", null);
            ret.put("syncDays", 14);
            call.resolve(ret);
        }
    }

    /**
     * Returns per-day screen time by querying UsageStatsManager directly for each day.
     * This gives ACCURATE OS-level data (same source as Android Digital Wellbeing),
     * not the stale values the background service may have written before being killed.
     *
     * Input:  { days: number }  — how many days back (default 7, max 14). Today is index 0.
     * Output: { history: [ { date: "YYYY-MM-DD", seconds: number } ] }
     */
    @PluginMethod
    public void getAccurateScreenTimeHistory(PluginCall call) {
        if (!hasUsageStatsPermission()) {
            JSObject ret = new JSObject();
            ret.put("history", new JSArray());
            call.resolve(ret);
            return;
        }

        int days = Math.min(call.getInt("days", 7), 14);
        UsageStatsManager usm = (UsageStatsManager)
                getContext().getSystemService(Context.USAGE_STATS_SERVICE);

        JSArray history = new JSArray();
        java.util.Calendar now = java.util.Calendar.getInstance();

        for (int i = days - 1; i >= 0; i--) {
            java.util.Calendar dayStart = (java.util.Calendar) now.clone();
            dayStart.add(java.util.Calendar.DAY_OF_YEAR, -i);
            dayStart.set(java.util.Calendar.HOUR_OF_DAY, 0);
            dayStart.set(java.util.Calendar.MINUTE, 0);
            dayStart.set(java.util.Calendar.SECOND, 0);
            dayStart.set(java.util.Calendar.MILLISECOND, 0);

            java.util.Calendar dayEnd;
            if (i == 0) {
                dayEnd = (java.util.Calendar) now.clone();
            } else {
                dayEnd = (java.util.Calendar) dayStart.clone();
                dayEnd.add(java.util.Calendar.DAY_OF_YEAR, 1);
                dayEnd.add(java.util.Calendar.MILLISECOND, -1);
            }

            String dateKey = String.format(java.util.Locale.US, "%04d-%02d-%02d",
                    dayStart.get(java.util.Calendar.YEAR),
                    dayStart.get(java.util.Calendar.MONTH) + 1,
                    dayStart.get(java.util.Calendar.DAY_OF_MONTH));

            long totalMs = 0;
            try {
                Map<String, Long> packageUsage = calculateUsageFromEvents(
                        usm, dayStart.getTimeInMillis(), dayEnd.getTimeInMillis());
                for (Map.Entry<String, Long> entry : packageUsage.entrySet()) {
                    if (!isExcludedPackage(entry.getKey())) {
                        totalMs += entry.getValue();
                    }
                }
            } catch (Exception e) {
                Log.w(TAG, "getAccurateScreenTimeHistory: error for " + dateKey + ": " + e.getMessage());
            }

            JSObject entry = new JSObject();
            entry.put("date", dateKey);
            entry.put("seconds", totalMs / 1000);
            history.put(entry);
        }

        JSObject ret = new JSObject();
        ret.put("history", history);
        call.resolve(ret);
    }

    /**
     * Returns per-day screen time totals recorded by GalleryMonitorService SharedPreferences.
     * NOTE: May be lower than actual usage if service was killed mid-day.
     * Prefer getAccurateScreenTimeHistory() for accurate values.
     */
    @PluginMethod
    public void getBackgroundScreenTimeHistory(PluginCall call) {
        int days = call.getInt("days", 7);
        android.content.SharedPreferences prefs = getContext()
                .getSharedPreferences("WellnessScreen", android.content.Context.MODE_PRIVATE);

        JSArray history = new JSArray();
        java.util.Calendar cal = java.util.Calendar.getInstance();

        for (int i = days - 1; i >= 0; i--) {
            java.util.Calendar day = (java.util.Calendar) cal.clone();
            day.add(java.util.Calendar.DAY_OF_YEAR, -i);
            String dateKey = String.format(java.util.Locale.US, "%04d-%02d-%02d",
                    day.get(java.util.Calendar.YEAR),
                    day.get(java.util.Calendar.MONTH) + 1,
                    day.get(java.util.Calendar.DAY_OF_MONTH));

            long seconds = prefs.getLong("screen_daily_" + dateKey, 0);
            JSObject entry = new JSObject();
            entry.put("date", dateKey);
            entry.put("seconds", seconds);
            history.put(entry);
        }

        JSObject ret = new JSObject();
        ret.put("history", history);
        call.resolve(ret);
    }
}
