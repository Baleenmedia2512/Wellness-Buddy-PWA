package com.wellnessvalley.app.plugins;

import android.app.AppOpsManager;
import android.app.usage.UsageEvents;
import android.app.usage.UsageStats;
import android.app.usage.UsageStatsManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.os.Build;
import android.provider.Settings;
import android.util.Log;

import androidx.annotation.RequiresApi;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.ArrayList;
import java.util.Calendar;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Capacitor plugin that queries Android UsageStatsManager to return device-wide
 * app usage statistics for the last 24 hours, and compares them with usage of
 * the host (Wellness Valley) app.
 *
 * Required permission (declared in AndroidManifest.xml, must be granted by the
 * user via the special "Usage Access" settings screen):
 *   android.permission.PACKAGE_USAGE_STATS
 */
@CapacitorPlugin(name = "DeviceUsageStats")
public class DeviceUsageStatsPlugin extends Plugin {

    private static final String TAG = "DeviceUsageStatsPlugin";

    // ─── Permission helpers ───────────────────────────────────────────────────

    /**
     * Returns true when the app holds the PACKAGE_USAGE_STATS usage-access grant.
     * This is a special permission that cannot be requested at runtime via the
     * standard requestPermissions() flow – the user must navigate to the OS
     * "Usage access" settings screen manually.
     */
    private boolean hasUsageAccessPermission() {
        try {
            Context ctx = getContext();
            AppOpsManager appOps =
                    (AppOpsManager) ctx.getSystemService(Context.APP_OPS_SERVICE);
            if (appOps == null) return false;

            // checkOpNoThrow(String, int, String) is available from API 19+
            int mode = appOps.checkOpNoThrow(
                    AppOpsManager.OPSTR_GET_USAGE_STATS,
                    android.os.Process.myUid(),
                    ctx.getPackageName()
            );
            return mode == AppOpsManager.MODE_ALLOWED;
        } catch (Exception e) {
            Log.e(TAG, "hasUsageAccessPermission: unexpected error", e);
            return false;
        }
    }

    // ─── Plugin methods ───────────────────────────────────────────────────────

    /**
     * JS call: DeviceUsageStats.checkPermission()
     * Returns { granted: boolean }
     */
    @PluginMethod
    public void checkPermission(PluginCall call) {
        JSObject result = new JSObject();
        result.put("granted", hasUsageAccessPermission());
        call.resolve(result);
    }

    /**
     * JS call: DeviceUsageStats.requestPermission()
     * Opens the system "Usage Access" settings screen so the user can grant the
     * special permission.  Returns immediately – the JS caller should poll
     * checkPermission() after the user returns to the app.
     */
    @PluginMethod
    public void requestPermission(PluginCall call) {
        try {
            Intent intent = new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            JSObject result = new JSObject();
            result.put("opened", true);
            call.resolve(result);
        } catch (Exception e) {
            Log.e(TAG, "requestPermission: could not open settings", e);
            call.reject("Could not open Usage Access settings: " + e.getMessage());
        }
    }

    /**
     * JS call: DeviceUsageStats.getUsageStats()
     * Queries usage statistics for the last 24 hours and returns:
     * {
     *   permissionGranted : boolean,
     *   totalScreenTime   : long   (ms),
     *   myAppUsage        : long   (ms),
     *   myAppRank         : int    (1-based, 0 = not in list),
     *   mostUsedApp       : string,
     *   apps              : [{ appName, packageName, usageTime }]
     * }
     */
    @PluginMethod
    @RequiresApi(api = Build.VERSION_CODES.LOLLIPOP_MR1)
    public void getUsageStats(PluginCall call) {
        // Guard: require API 22+
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.LOLLIPOP_MR1) {
            call.reject("UsageStatsManager requires Android 5.1 (API 22) or higher");
            return;
        }

        // Guard: permission check
        if (!hasUsageAccessPermission()) {
            JSObject result = new JSObject();
            result.put("permissionGranted", false);
            call.resolve(result);
            return;
        }

        try {
            Context ctx = getContext();
            String myPackage = ctx.getPackageName();
            PackageManager pm = ctx.getPackageManager();
            UsageStatsManager usm =
                    (UsageStatsManager) ctx.getSystemService(Context.USAGE_STATS_SERVICE);

            if (usm == null) {
                call.reject("UsageStatsManager is not available on this device");
                return;
            }

            // Query the last 24 hours
            long endTime = System.currentTimeMillis();
            long startTime = endTime - (24L * 60 * 60 * 1000);

            Map<String, UsageStats> statsMap =
                    usm.queryAndAggregateUsageStats(startTime, endTime);

            // Build a sorted list, filtering out zero-usage entries
            List<JSObject> apps = new ArrayList<>();
            long totalScreenTime = 0L;
            long myAppUsage = 0L;

            for (Map.Entry<String, UsageStats> entry : statsMap.entrySet()) {
                String pkg = entry.getKey();
                long usageTime = entry.getValue().getTotalTimeInForeground();

                if (usageTime <= 0) continue;

                // Resolve app label; skip entries where no human-readable name exists
                // (pure OS services show their package name as label – not useful to users)
                String appName = getAppName(pm, pkg);
                if (appName.equals(pkg)) continue;

                // Skip apps that have no launcher intent (background services, system daemons)
                // but always include our own app regardless
                if (!pkg.equals(myPackage)) {
                    Intent launchIntent = pm.getLaunchIntentForPackage(pkg);
                    if (launchIntent == null) continue;
                }

                totalScreenTime += usageTime;

                JSObject appObj = new JSObject();
                appObj.put("appName", appName);
                appObj.put("packageName", pkg);
                appObj.put("usageTime", usageTime);
                apps.add(appObj);

                if (pkg.equals(myPackage)) {
                    myAppUsage = usageTime;
                }
            }

            // Sort descending by usageTime
            apps.sort((a, b) -> {
                try {
                    long ta = a.getLong("usageTime");
                    long tb = b.getLong("usageTime");
                    return Long.compare(tb, ta);
                } catch (Exception e) {
                    return 0;
                }
            });

            // Determine my app rank (1-based) and most used app
            int myAppRank = 0;
            String mostUsedApp = "";

            for (int i = 0; i < apps.size(); i++) {
                JSObject app = apps.get(i);
                if (i == 0) {
                    mostUsedApp = app.getString("appName", "");
                }
                if (myPackage.equals(app.getString("packageName", ""))) {
                    myAppRank = i + 1;
                }
            }

            // Strip packageName from the response array (keep appName + usageTime)
            JSArray appsArray = new JSArray();
            for (JSObject app : apps) {
                JSObject out = new JSObject();
                out.put("appName", app.getString("appName", ""));
                out.put("packageName", app.getString("packageName", ""));
                out.put("usageTime", app.getLong("usageTime"));
                appsArray.put(out);
            }

            JSObject result = new JSObject();
            result.put("permissionGranted", true);
            result.put("totalScreenTime", totalScreenTime);
            result.put("myAppUsage", myAppUsage);
            result.put("myAppRank", myAppRank);
            result.put("mostUsedApp", mostUsedApp);
            result.put("apps", appsArray);

            Log.d(TAG, "getUsageStats: returned " + apps.size() + " apps, total=" + totalScreenTime + "ms");
            call.resolve(result);

        } catch (Exception e) {
            Log.e(TAG, "getUsageStats: error querying usage stats", e);
            call.reject("Failed to query usage stats: " + e.getMessage());
        }
    }

    /**
     * JS call: DeviceUsageStats.getDailyUsage({ days })
     * Returns per-day total device screen time for the requested number of days.
     * {
     *   permissionGranted : boolean,
     *   trend             : [{ date: "YYYY-MM-DD", totalScreenTime: long }]
     * }
     */
    @PluginMethod
    @RequiresApi(api = Build.VERSION_CODES.LOLLIPOP_MR1)
    public void getDailyUsage(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.LOLLIPOP_MR1) {
            call.reject("UsageStatsManager requires Android 5.1 (API 22) or higher");
            return;
        }

        if (!hasUsageAccessPermission()) {
            JSObject result = new JSObject();
            result.put("permissionGranted", false);
            result.put("trend", new JSArray());
            call.resolve(result);
            return;
        }

        try {
            int requestedDays = call.getInt("days", 30);
            int days = Math.max(1, Math.min(requestedDays, 30));

            Context ctx = getContext();
            String myPackage = ctx.getPackageName();
            PackageManager pm = ctx.getPackageManager();
            UsageStatsManager usm =
                    (UsageStatsManager) ctx.getSystemService(Context.USAGE_STATS_SERVICE);

            if (usm == null) {
                call.reject("UsageStatsManager is not available on this device");
                return;
            }

            Calendar todayStart = Calendar.getInstance();
            todayStart.set(Calendar.HOUR_OF_DAY, 0);
            todayStart.set(Calendar.MINUTE, 0);
            todayStart.set(Calendar.SECOND, 0);
            todayStart.set(Calendar.MILLISECOND, 0);

            JSArray trendArray = new JSArray();

            for (int offset = days - 1; offset >= 0; offset--) {
                Calendar dayStart = (Calendar) todayStart.clone();
                dayStart.add(Calendar.DATE, -offset);

                Calendar dayEnd = (Calendar) dayStart.clone();
                dayEnd.add(Calendar.DATE, 1);

                long totalScreenTime = aggregateTotalScreenTime(
                        usm,
                        pm,
                        myPackage,
                        dayStart.getTimeInMillis(),
                        dayEnd.getTimeInMillis()
                );

                JSObject day = new JSObject();
                day.put("date", formatDateKey(dayStart));
                day.put("totalScreenTime", totalScreenTime);
                trendArray.put(day);
            }

            JSObject result = new JSObject();
            result.put("permissionGranted", true);
            result.put("trend", trendArray);

            Log.d(TAG, "getDailyUsage: returned " + days + " daily totals");
            call.resolve(result);
        } catch (Exception e) {
            Log.e(TAG, "getDailyUsage: error querying usage stats", e);
            call.reject("Failed to query daily usage stats: " + e.getMessage());
        }
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private long aggregateTotalScreenTime(
            UsageStatsManager usm,
            PackageManager pm,
            String myPackage,
            long startTime,
            long endTime
    ) {
        UsageEvents events = usm.queryEvents(startTime, endTime);
        if (events == null) return 0L;

        UsageEvents.Event event = new UsageEvents.Event();
        String activePackage = null;
        long activeStart = -1L;
        long totalScreenTime = 0L;

        while (events.hasNextEvent()) {
            events.getNextEvent(event);

            String pkg = event.getPackageName();
            if (!isTrackedPackage(pm, myPackage, pkg)) {
                continue;
            }

            int eventType = event.getEventType();
            long eventTime = event.getTimeStamp();

            if (isForegroundEvent(eventType)) {
                if (activePackage != null && activeStart >= 0 && eventTime > activeStart) {
                    totalScreenTime += (eventTime - activeStart);
                }
                activePackage = pkg;
                activeStart = Math.max(eventTime, startTime);
                continue;
            }

            if (isBackgroundEvent(eventType)
                    && activePackage != null
                    && activePackage.equals(pkg)
                    && activeStart >= 0
                    && eventTime > activeStart) {
                totalScreenTime += (eventTime - activeStart);
                activePackage = null;
                activeStart = -1L;
            }
        }

        if (activePackage != null && activeStart >= 0 && endTime > activeStart) {
            totalScreenTime += (endTime - activeStart);
        }

        long maxPossibleDailyUsage = 24L * 60 * 60 * 1000;
        return Math.min(totalScreenTime, maxPossibleDailyUsage);
    }

    private boolean isTrackedPackage(PackageManager pm, String myPackage, String packageName) {
        if (packageName == null || packageName.isEmpty()) return false;

        String appName = getAppName(pm, packageName);
        if (appName.equals(packageName)) return false;

        if (packageName.equals(myPackage)) return true;

        Intent launchIntent = pm.getLaunchIntentForPackage(packageName);
        return launchIntent != null;
    }

    private boolean isForegroundEvent(int eventType) {
        return eventType == UsageEvents.Event.MOVE_TO_FOREGROUND
                || (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
                && eventType == UsageEvents.Event.ACTIVITY_RESUMED);
    }

    private boolean isBackgroundEvent(int eventType) {
        return eventType == UsageEvents.Event.MOVE_TO_BACKGROUND
                || (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
                && eventType == UsageEvents.Event.ACTIVITY_PAUSED);
    }

    private String formatDateKey(Calendar calendar) {
        return String.format(
                Locale.US,
                "%04d-%02d-%02d",
                calendar.get(Calendar.YEAR),
                calendar.get(Calendar.MONTH) + 1,
                calendar.get(Calendar.DAY_OF_MONTH)
        );
    }

    /**
     * Resolve a human-readable application label from a package name.
     * Falls back to the package name itself when the label cannot be retrieved
     * (e.g. system apps without a label, or packages that were uninstalled).
     */
    private String getAppName(PackageManager pm, String packageName) {
        try {
            ApplicationInfo info = pm.getApplicationInfo(packageName, 0);
            CharSequence label = pm.getApplicationLabel(info);
            return label != null ? label.toString() : packageName;
        } catch (PackageManager.NameNotFoundException e) {
            // Package uninstalled or unavailable – use the package name as fallback
            return packageName;
        } catch (Exception e) {
            return packageName;
        }
    }
}
