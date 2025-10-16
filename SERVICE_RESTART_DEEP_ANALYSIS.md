# Deep Technical Analysis: Android Service Restart Failure
**Date:** October 15, 2025  
**Target:** GalleryMonitorService  
**Platform:** Android API 26+ (Oreo and above)

---

## PART 1: ROOT CAUSE ANALYSIS

### 1.1 Why Android Stops/Prevents Service Restarts

#### **Process Lifecycle Issues**
1. **App Process Death** - When the app is force-stopped, the entire process tree is killed, including:
   - The main application process
   - All bound services
   - All background threads
   - **Critical**: WorkManager jobs are NOT guaranteed to survive force-stop

2. **Memory Management**
   - Low Memory Killer (LMK) targets background processes
   - Services in stopped apps are prime candidates for termination
   - No automatic restart after LMK termination on modern Android

#### **Doze Mode & Battery Optimizations (API 23+)**
```
Doze Mode Phases:
├── Screen OFF for 30+ minutes
├── Network access blocked
├── Wakelocks ignored
├── Alarms deferred
└── JobScheduler/WorkManager delayed (except "important" work)
```

**Impact on Services:**
- `START_STICKY` services are NOT restarted during Doze
- WorkManager jobs are batched/delayed
- Only `setExactAndAllowWhileIdle()` alarms fire reliably

#### **Background Execution Limits (API 26+)**

| Restriction | Impact | Workaround |
|------------|--------|------------|
| Background Service Limits | Can't start services when app in background | Foreground Service |
| Broadcast Limits | Most implicit broadcasts disabled | Explicit receivers only |
| Location Updates | Throttled to few per hour | Foreground service |

#### **OEM-Specific Quirks**
- **Xiaomi/MIUI**: Aggressive "autostart" restrictions
- **Huawei/EMUI**: Kills apps not in "protected apps" list
- **Samsung**: One UI optimizations may delay WorkManager
- **OnePlus**: "Battery optimization" overrides Android settings

### 1.2 Current Implementation Analysis

**Your Code Issues:**

```java
// ❌ PROBLEM 1: onTaskRemoved() is NOT guaranteed to execute
@Override
public void onTaskRemoved(Intent rootIntent) {
    super.onTaskRemoved(rootIntent);
    // This may NEVER fire if app is force-stopped
    WorkManager.enqueue(restartWork);
}
```

**Why it fails:**
- `onTaskRemoved()` only fires when:
  - User removes app from Recents
  - System kills app due to memory pressure
- Does NOT fire when:
  - User force-stops app in Settings
  - System kills process due to battery optimization
  - Device reboots

```java
// ❌ PROBLEM 2: START_REDELIVER_INTENT doesn't restart killed services
@Override
public int onStartCommand(Intent intent, int flags, int startId) {
    return START_REDELIVER_INTENT; // ⚠️ Only works if service crashes
}
```

**START_STICKY vs START_REDELIVER_INTENT vs START_NOT_STICKY:**
- All require the service to be running when terminated
- None work after force-stop
- None work reliably in Doze mode

```java
// ❌ PROBLEM 3: BOOT_COMPLETED receiver exists but service not started
<receiver android:name=".services.BootCompletedReceiver" ... />
```

**Missing**: The receiver is declared but likely not starting your service on boot.

---

## PART 2: RECOMMENDED SOLUTION + RATIONALE

### 2.1 The Modern Android Approach (API 26+)

**Solution Stack (Priority Order):**

```
┌─────────────────────────────────────────┐
│ 1. Foreground Service (Current State)  │ ✅ Already Implemented
├─────────────────────────────────────────┤
│ 2. BOOT_COMPLETED + User Action        │ ⚠️ Partially Implemented
├─────────────────────────────────────────┤
│ 3. PeriodicWorkRequest (Heartbeat)     │ ❌ Missing - CRITICAL
├─────────────────────────────────────────┤
│ 4. Battery Optimization Exemption      │ ⚠️ Requested but not enforced
├─────────────────────────────────────────┤
│ 5. JobScheduler Fallback (API 21-25)   │ ❌ Not needed (API 26+)
└─────────────────────────────────────────┘
```

### 2.2 Best Solution: Multi-Layer Defense

**Layer 1: Enhanced Foreground Service** (Already have ✅)
- Keeps service alive while app is in background
- Visible notification prevents easy termination
- Issue: Still killed on force-stop

**Layer 2: PeriodicWorkRequest Heartbeat** ❌ **MISSING - THIS IS YOUR PROBLEM**
```kotlin
// Every 15 minutes, check if service is running and restart if needed
PeriodicWorkRequest(interval = 15 minutes) {
    if (!isServiceRunning()) {
        startForegroundService()
    }
}
```

**Why WorkManager for Heartbeat:**
- ✅ Survives app force-stop (if enqueued before)
- ✅ Battery-efficient (uses JobScheduler under the hood)
- ✅ Survives device reboot (with proper setup)
- ✅ Respects Doze mode constraints
- ❌ Not guaranteed immediate restart (batching)

**Layer 3: BOOT_COMPLETED Integration**
- Restart service on device boot
- Works reliably across all Android versions

**Layer 4: Battery Optimization Exemption**
- Critical for Doze mode
- Must be user-initiated

### 2.3 Why NOT Other Approaches

| Approach | Why NOT Recommended |
|----------|-------------------|
| `START_STICKY` | Doesn't survive force-stop; unreliable on API 26+ |
| `AlarmManager.setExactAndAllowWhileIdle()` | Battery drain; requires SCHEDULE_EXACT_ALARM permission (API 31+) |
| Persistent Connection/WebSocket | Killed in Doze; battery drain |
| `JobScheduler` directly | WorkManager is wrapper with better compatibility |
| Accessibility Service | Inappropriate use; user privacy concerns |

---

## PART 3: STEP-BY-STEP IMPLEMENTATION & TEST PLAN

### 3.1 Code Changes

#### **Change 1: Create Periodic Heartbeat Worker**

```java
// File: frontend/android/app/src/main/java/com/wellnessbuddy/app/services/ServiceHeartbeatWorker.java
package com.wellnessbuddy.app.services;

import android.app.ActivityManager;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.util.Log;
import androidx.annotation.NonNull;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

public class ServiceHeartbeatWorker extends Worker {
    private static final String TAG = "ServiceHeartbeatWorker";

    public ServiceHeartbeatWorker(@NonNull Context context, @NonNull WorkerParameters params) {
        super(context, params);
    }

    @NonNull
    @Override
    public Result doWork() {
        Log.d(TAG, "🔄 Heartbeat check: Is GalleryMonitorService running?");
        
        if (!isServiceRunning(getApplicationContext(), GalleryMonitorService.class)) {
            Log.w(TAG, "⚠️ Service not running! Restarting...");
            restartService();
            return Result.success();
        }
        
        Log.d(TAG, "✅ Service is running normally");
        return Result.success();
    }

    private boolean isServiceRunning(Context context, Class<?> serviceClass) {
        ActivityManager manager = (ActivityManager) context.getSystemService(Context.ACTIVITY_SERVICE);
        if (manager == null) return false;
        
        for (ActivityManager.RunningServiceInfo service : manager.getRunningServices(Integer.MAX_VALUE)) {
            if (serviceClass.getName().equals(service.service.getClassName())) {
                return true;
            }
        }
        return false;
    }

    private void restartService() {
        Context context = getApplicationContext();
        Intent serviceIntent = new Intent(context, GalleryMonitorService.class);
        
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(serviceIntent);
            } else {
                context.startService(serviceIntent);
            }
            Log.d(TAG, "✅ Service restart initiated");
        } catch (Exception e) {
            Log.e(TAG, "❌ Failed to restart service", e);
        }
    }
}
```

#### **Change 2: Enhanced BootCompletedReceiver**

```java
// File: frontend/android/app/src/main/java/com/wellnessbuddy/app/services/BootCompletedReceiver.java
package com.wellnessbuddy.app.services;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.util.Log;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;
import androidx.work.Constraints;
import androidx.work.NetworkType;
import java.util.concurrent.TimeUnit;

public class BootCompletedReceiver extends BroadcastReceiver {
    private static final String TAG = "BootCompletedReceiver";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) {
            Log.d(TAG, "📱 Device boot completed - starting GalleryMonitorService");
            
            // Start the foreground service
            Intent serviceIntent = new Intent(context, GalleryMonitorService.class);
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(serviceIntent);
                } else {
                    context.startService(serviceIntent);
                }
                Log.d(TAG, "✅ Service started on boot");
            } catch (Exception e) {
                Log.e(TAG, "❌ Failed to start service on boot", e);
            }
            
            // Schedule periodic heartbeat
            scheduleHeartbeat(context);
        }
    }
    
    public static void scheduleHeartbeat(Context context) {
        Log.d(TAG, "⏰ Scheduling heartbeat worker");
        
        Constraints constraints = new Constraints.Builder()
            .setRequiresBatteryNotLow(false) // Run even on low battery
            .setRequiresCharging(false)
            .setRequiresDeviceIdle(false)
            .setRequiresStorageNotLow(false)
            .build();
        
        PeriodicWorkRequest heartbeatWork = new PeriodicWorkRequest.Builder(
                ServiceHeartbeatWorker.class,
                15, // Repeat every 15 minutes (minimum allowed)
                TimeUnit.MINUTES,
                5, // Flex interval
                TimeUnit.MINUTES
            )
            .setConstraints(constraints)
            .addTag("service_heartbeat")
            .build();
        
        WorkManager.getInstance(context).enqueueUniquePeriodicWork(
            "GalleryMonitorHeartbeat",
            ExistingPeriodicWorkPolicy.KEEP, // Don't restart if already scheduled
            heartbeatWork
        );
        
        Log.d(TAG, "✅ Heartbeat worker scheduled (15min interval)");
    }
}
```

#### **Change 3: Update MainActivity to Schedule Heartbeat**

```java
// Add to MainActivity.onCreate() - AFTER super.onCreate()

// Schedule periodic heartbeat to ensure service stays alive
com.wellnessbuddy.app.services.BootCompletedReceiver.scheduleHeartbeat(this);
android.util.Log.d("MainActivity", "✅ Heartbeat worker scheduled");
```

#### **Change 4: Remove Unreliable onTaskRemoved Restart**

```java
// In GalleryMonitorService.java - REMOVE or COMMENT OUT:

@Override
public void onTaskRemoved(Intent rootIntent) {
    super.onTaskRemoved(rootIntent);
    // ❌ This is unreliable - WorkManager heartbeat will handle restarts
    // Don't rely on this method
}
```

#### **Change 5: Update AndroidManifest.xml**

```xml
<!-- Add SCHEDULE_EXACT_ALARM permission for Android 12+ (optional but recommended) -->
<uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM" />

<!-- Ensure BOOT_COMPLETED receiver is properly configured -->
<receiver
    android:name=".services.BootCompletedReceiver"
    android:enabled="true"
    android:exported="true"
    android:directBootAware="true">
    <intent-filter>
        <action android:name="android.intent.action.BOOT_COMPLETED" />
        <action android:name="android.intent.action.QUICKBOOT_POWERON" />
        <!-- For Xiaomi devices -->
        <action android:name="android.intent.action.LOCKED_BOOT_COMPLETED" />
    </intent-filter>
</receiver>
```

### 3.2 Test Plan

#### **Test 1: Force Stop Recovery** ⭐ **PRIMARY TEST**

```powershell
# PowerShell script
@"
echo "=== Test 1: Force Stop Recovery ==="
echo "Step 1: Starting app and service..."
adb shell am start -n com.wellnessbuddy.app/.MainActivity
timeout /t 5 /nobreak

echo "Step 2: Verifying service is running..."
adb shell dumpsys activity services | findstr GalleryMonitorService

echo "Step 3: Force stopping app..."
adb shell am force-stop com.wellnessbuddy.app
timeout /t 2 /nobreak

echo "Step 4: Waiting 30 seconds for potential restart..."
timeout /t 30 /nobreak

echo "Step 5: Checking if service restarted..."
adb shell dumpsys activity services | findstr GalleryMonitorService

echo "Step 6: Checking WorkManager jobs..."
adb shell dumpsys jobscheduler | findstr -i "heartbeat\|wellness"

echo "=== Test Complete ==="
"@ | Out-File -FilePath test-force-stop.bat -Encoding ASCII
```

**Expected Behavior:**
- Service should NOT restart immediately
- After 15 minutes (or next heartbeat window), service should restart
- WorkManager job "service_heartbeat" should be scheduled

#### **Test 2: Boot Recovery**

```powershell
# Reboot device
adb reboot

# Wait for boot to complete (30-60 seconds)
Start-Sleep -Seconds 60

# Check if service started
adb shell dumpsys activity services | findstr GalleryMonitorService

# Check logs
adb logcat -d | findstr "BootCompletedReceiver\|GalleryMonitorService"
```

#### **Test 3: Doze Mode Simulation**

```powershell
# Force device into Doze mode
adb shell dumpsys battery unplug
adb shell dumpsys deviceidle force-idle

# Wait a few minutes
timeout /t 180 /nobreak

# Check if service still running
adb shell dumpsys activity services | findstr GalleryMonitorService

# Exit Doze
adb shell dumpsys deviceidle unforce
adb shell dumpsys battery reset
```

### 3.3 Logcat Monitoring

#### **Critical Log Patterns to Watch:**

```bash
# Comprehensive monitoring command
adb logcat -v time | findstr /i "GalleryMonitorService ServiceHeartbeatWorker BootCompletedReceiver WorkManager"
```

**Success Indicators:**
```
✅ BootCompletedReceiver: Device boot completed - starting GalleryMonitorService
✅ BootCompletedReceiver: Heartbeat worker scheduled (15min interval)
✅ ServiceHeartbeatWorker: 🔄 Heartbeat check: Is GalleryMonitorService running?
✅ ServiceHeartbeatWorker: ✅ Service is running normally
✅ GalleryMonitorService: Service created
✅ GalleryMonitorService: onStartCommand called
```

**Failure Indicators:**
```
❌ ServiceHeartbeatWorker: ⚠️ Service not running! Restarting...
❌ ServiceHeartbeatWorker: ❌ Failed to restart service
❌ No heartbeat logs for > 20 minutes
```

#### **Detailed Diagnostic Commands:**

```powershell
# Check WorkManager status
adb shell dumpsys jobscheduler | findstr -A 20 "com.wellnessbuddy.app"

# Check battery optimization status
adb shell dumpsys deviceidle whitelist | findstr wellnessbuddy

# Check running services
adb shell dumpsys activity services com.wellnessbuddy.app

# Check scheduled jobs
adb shell dumpsys jobscheduler | findstr -i "heartbeat"

# Check app standby bucket (affects WorkManager timing)
adb shell am get-standby-bucket com.wellnessbuddy.app

# Set to active bucket for testing
adb shell am set-standby-bucket com.wellnessbuddy.app active
```

### 3.4 Battery Optimization Setup

#### **Programmatic Request (Already in code):**
```java
// In MainActivity.requestBatteryOptimizationExemption()
// This opens Settings for user to manually exempt the app
```

#### **Testing Command:**
```powershell
# Add to battery optimization whitelist (for testing only - not allowed in production)
adb shell dumpsys deviceidle whitelist +com.wellnessbuddy.app

# Verify
adb shell dumpsys deviceidle whitelist | findstr wellnessbuddy

# Remove (reset)
adb shell dumpsys deviceidle whitelist -com.wellnessbuddy.app
```

---

## PART 4: IMPLEMENTATION CHECKLIST

### Immediate Actions (Priority 1):

- [ ] Create `ServiceHeartbeatWorker.java`
- [ ] Update `BootCompletedReceiver.java` with heartbeat scheduling
- [ ] Add heartbeat scheduling call to `MainActivity.onCreate()`
- [ ] Update `AndroidManifest.xml` with boot intents
- [ ] Remove/disable unreliable `onTaskRemoved()` restart logic

### Testing Phase (Priority 2):

- [ ] Test force-stop recovery (wait 15-20 minutes)
- [ ] Test device reboot recovery
- [ ] Test Doze mode behavior
- [ ] Test battery optimization scenarios
- [ ] Monitor logcat for 24 hours to ensure heartbeat fires

### Optional Enhancements (Priority 3):

- [ ] Add user notification when service auto-restarts
- [ ] Implement service health metrics dashboard
- [ ] Add OEM-specific workarounds for Xiaomi/Huawei
- [ ] Create user guide for manual battery optimization exemption

---

## PART 5: WHY THIS WILL WORK

### The Three-Tier Defense:

```
┌─ Layer 1: Foreground Service ─────────────────────┐
│  Keeps service alive during normal operation      │
│  Visible to user (notification)                   │
│  Hard to kill accidentally                        │
└───────────────────────────────────────────────────┘
         ↓ (Force stop or system kill)
┌─ Layer 2: Periodic Heartbeat (15min) ─────────────┐
│  WorkManager checks service status                │
│  Restarts if not running                          │
│  Survives force-stop (if scheduled before kill)   │
└───────────────────────────────────────────────────┘
         ↓ (Device reboot)
┌─ Layer 3: BOOT_COMPLETED Receiver ────────────────┐
│  Starts service on device boot                    │
│  Re-schedules heartbeat worker                    │
│  Ensures service always running after reboot      │
└───────────────────────────────────────────────────┘
```

### Expected Behavior Timeline:

```
T=0:    User force-stops app
T=0:    Service killed
T=0-15min: Service remains offline
T=15min: WorkManager heartbeat fires
T=15min: Heartbeat detects service not running
T=15min: Service restarted
T=16min: Service fully operational
```

**Note:** The 15-minute delay is by design (Android's minimum PeriodicWorkRequest interval). For truly critical services, consider using `AlarmManager.setExactAndAllowWhileIdle()` but be aware of battery impact.

---

## CONCLUSION

Your current implementation fails because:
1. `onTaskRemoved()` doesn't fire on force-stop
2. No periodic check to restart service
3. BOOT_COMPLETED receiver not starting service

The solution adds a **PeriodicWorkRequest heartbeat** that:
- Checks every 15 minutes if service is running
- Restarts if needed
- Survives force-stop and reboot
- Battery-efficient

This is the **modern, Google-recommended approach** for persistent background services on Android 8.0+.
