# Android In-App Updates Implementation Guide

## 📱 Overview

This guide covers the complete implementation of Google Play In-App Updates for the Wellness Valley Capacitor application. The implementation supports both **Immediate** and **Flexible** update flows.

---

## 🎯 Update Types

### 1. **IMMEDIATE UPDATE** (Critical/Mandatory)
- **Use Case**: Critical bug fixes, security patches, breaking API changes
- **Behavior**: 
  - Blocks the entire app UI
  - User **must** update to continue using the app
  - No cancel option
  - If user backs out, they cannot use the app
- **When triggered**: When update priority ≥ 4 OR app is 30+ days stale

### 2. **FLEXIBLE UPDATE** (Optional)
- **Use Case**: Regular features, improvements, non-critical fixes
- **Behavior**:
  - Downloads in background
  - User can continue using the app
  - Shows snackbar when download completes: "Update downloaded! Restart to install"
  - User chooses when to restart
- **When triggered**: When update priority < 4 and staleness < 30 days

---

## 📂 Files Created/Modified

### **Android Native Files**

1. **`InAppUpdateManager.java`**
   - Location: `android/app/src/main/java/com/wellnessvalley/app/`
   - Handles all update logic
   - Manages AppUpdateManager API
   - Implements listeners for download progress

2. **`InAppUpdatePlugin.java`**
   - Location: `android/app/src/main/java/com/wellnessvalley/app/plugins/`
   - Capacitor plugin bridge
   - Exposes native functionality to JavaScript
   - Sends events to web layer

3. **`MainActivity.java`** (Modified)
   - Registers InAppUpdatePlugin
   - Initiates update check on app launch
   - Handles onResume() for immediate updates
   - Manages activity results

4. **`build.gradle`** (Modified)
   - Added Play Core dependencies:
     ```gradle
     implementation 'com.google.android.play:app-update:2.1.0'
     implementation 'com.google.android.play:app-update-ktx:2.1.0'
     ```

### **Frontend Files**

5. **`inAppUpdatePlugin.js`**
   - Location: `frontend/src/plugins/`
   - JavaScript interface for the plugin
   - Event listeners
   - Usage examples

---

## 🔄 User Flow Diagrams

### **IMMEDIATE UPDATE FLOW** (Mandatory)

```
┌─────────────────────────────────────────────────────────────┐
│                     User Opens App                          │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
        ┌───────────────────────────────┐
        │  MainActivity.onCreate()      │
        │  Checks for updates (2s delay)│
        └───────────────┬───────────────┘
                        │
                        ▼
        ┌───────────────────────────────────┐
        │ AppUpdateManager.getAppUpdateInfo()│
        └───────────────┬───────────────────┘
                        │
                ┌───────┴────────┐
                │                │
        ┌───────▼──────┐  ┌─────▼──────────┐
        │ Update Found │  │  No Update     │
        │ Priority ≥ 4 │  │  Available     │
        └───────┬──────┘  └────────────────┘
                │
                ▼
    ┌───────────────────────────────┐
    │ IMMEDIATE UPDATE UI APPEARS   │
    │ ┌───────────────────────────┐ │
    │ │ Update Required           │ │
    │ │                           │ │
    │ │ A new version is          │ │
    │ │ available. Please update  │ │
    │ │ to continue.              │ │
    │ │                           │ │
    │ │   [ UPDATE ]              │ │
    │ └───────────────────────────┘ │
    └───────────────┬───────────────┘
                    │
            ┌───────┴───────┐
            │               │
    ┌───────▼────────┐ ┌───▼─────────────┐
    │ User Clicks    │ │ User Backs Out  │
    │ UPDATE         │ │ (Presses Back)  │
    └───────┬────────┘ └───┬─────────────┘
            │              │
            ▼              ▼
    ┌───────────────┐ ┌──────────────────┐
    │ Download &    │ │ Update check runs│
    │ Install       │ │ again on Resume  │
    │ (Google Play) │ │ (onResume loop)  │
    └───────┬───────┘ └──────────────────┘
            │
            ▼
    ┌───────────────────┐
    │ App Restarts      │
    │ with New Version  │
    └───────────────────┘
```

**Key Points**:
- User **cannot** use app without updating
- If user backs out, update prompt reappears on next resume
- Update happens through Google Play
- App automatically restarts after installation

---

### **FLEXIBLE UPDATE FLOW** (Optional)

```
┌─────────────────────────────────────────────────────────────┐
│                     User Opens App                          │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
        ┌───────────────────────────────┐
        │  MainActivity.onCreate()      │
        │  Checks for updates (2s delay)│
        └───────────────┬───────────────┘
                        │
                        ▼
        ┌───────────────────────────────────┐
        │ AppUpdateManager.getAppUpdateInfo()│
        └───────────────┬───────────────────┘
                        │
                ┌───────┴────────┐
                │                │
        ┌───────▼──────┐  ┌─────▼──────────┐
        │ Update Found │  │  No Update     │
        │ Priority < 4 │  │  Available     │
        └───────┬──────┘  └────────────────┘
                │
                ▼
    ┌───────────────────────────────────┐
    │ FLEXIBLE UPDATE DIALOG APPEARS    │
    │ ┌───────────────────────────────┐ │
    │ │ Update Available              │ │
    │ │                               │ │
    │ │ A new version is available.   │ │
    │ │                               │ │
    │ │ [ NOT NOW ]    [ DOWNLOAD ]   │ │
    │ └───────────────────────────────┘ │
    └───────────────┬───────────────────┘
                    │
            ┌───────┴───────────┐
            │                   │
    ┌───────▼────────┐  ┌───────▼───────────┐
    │ User Clicks    │  │ User Clicks       │
    │ DOWNLOAD       │  │ NOT NOW           │
    └───────┬────────┘  └───────────────────┘
            │                   │
            ▼                   ▼
    ┌───────────────────────┐  User continues
    │ Download in Background│  using app
    │ (User can use app)    │  (can update later)
    └───────┬───────────────┘
            │
            │ Events sent to JS:
            │ • updateDownloading (with progress %)
            │
            ▼
    ┌───────────────────────────────┐
    │ Download Complete             │
    │ ┌───────────────────────────┐ │
    │ │ Update downloaded!        │ │
    │ │ Restart to install        │ │
    │ │              [ RESTART ]  │ │
    │ └───────────────────────────┘ │
    │ (Snackbar at bottom)          │
    └───────────────┬───────────────┘
                    │
            ┌───────┴────────┐
            │                │
    ┌───────▼─────────┐ ┌────▼──────────────┐
    │ User Clicks     │ │ User Ignores      │
    │ RESTART         │ │ (continues using) │
    └───────┬─────────┘ └────┬──────────────┘
            │                │
            ▼                ▼
    ┌───────────────┐ ┌──────────────────────┐
    │ App Restarts  │ │ Snackbar persists    │
    │ with Update   │ │ Shows on next launch │
    └───────────────┘ └──────────────────────┘
```

**Key Points**:
- User can continue using app during download
- Download happens in background
- User receives progress updates
- Snackbar shows when ready: "Update downloaded! Restart to install"
- User controls when to restart

---

## 🛠️ Implementation Details

### **1. How Update Type is Determined**

```java
// In InAppUpdateManager.java
private int determineUpdateType(int updatePriority, AppUpdateInfo appUpdateInfo) {
    // Critical update (priority 4-5)
    if (updatePriority >= 4) {
        return AppUpdateType.IMMEDIATE;
    }
    
    // If app is 30+ days old
    Integer stalenessDays = appUpdateInfo.clientVersionStalenessDays();
    if (stalenessDays != null && stalenessDays >= 30) {
        return AppUpdateType.IMMEDIATE;
    }
    
    // Regular update (priority 0-3)
    return AppUpdateType.FLEXIBLE;
}
```

### **2. Update Check Flow**

```java
// MainActivity.onCreate() - Line ~103
private void checkForAppUpdates() {
    // Wait 2 seconds after app launch
    new Handler(Looper.getMainLooper()).postDelayed(() -> {
        updateManager = new InAppUpdateManager(this);
        updateManager.setUpdateListener(...);
        updateManager.checkForUpdate();
    }, 2000);
}
```

### **3. JavaScript Integration Example**

```javascript
import { 
  checkForUpdate, 
  addUpdateListener, 
  InAppUpdateEvents,
  UpdateType,
  completeUpdate 
} from './plugins/inAppUpdatePlugin';

// In App.js or index.js
useEffect(() => {
  // Add listeners
  const listeners = [
    addUpdateListener(InAppUpdateEvents.UPDATE_AVAILABLE, (data) => {
      console.log('📱 Update available:', data.updateType, data.availableVersionCode);
      
      if (data.updateType === UpdateType.IMMEDIATE) {
        // Google Play will show blocking UI automatically
        console.log('🚨 Critical update - user must update');
      } else {
        // Show notification to user (optional)
        console.log('✨ New update available - downloading in background');
      }
    }),
    
    addUpdateListener(InAppUpdateEvents.UPDATE_DOWNLOADING, (data) => {
      console.log(`⬇️ Downloading: ${data.progress}%`);
      // Optional: Update UI with progress
    }),
    
    addUpdateListener(InAppUpdateEvents.UPDATE_DOWNLOADED, () => {
      console.log('✅ Update downloaded!');
      // Native snackbar already shown by InAppUpdateManager
      // Optionally show your own notification
    }),
    
    addUpdateListener(InAppUpdateEvents.UPDATE_FAILED, (data) => {
      console.error('❌ Update failed:', data.message);
    }),
    
    addUpdateListener(InAppUpdateEvents.UPDATE_CANCELED, () => {
      console.warn('⚠️ User canceled update');
    })
  ];
  
  // Check for updates (auto-triggered by MainActivity, but can also trigger manually)
  // checkForUpdate();
  
  // Cleanup
  return () => {
    listeners.forEach(listener => listener.remove());
  };
}, []);
```

---

## 🧪 Testing Guide

### **Prerequisites**
1. App must be published on Google Play Console (at least Internal Test track)
2. Need at least 2 versions:
   - **Lower version** (installed on device)
   - **Higher version** (uploaded to Play Console)

### **Setup Steps**

#### **Step 1: Prepare Versions**

```bash
# Current version on device
versionCode 14
versionName "1.6.1"

# Upload new version to Play Console
versionCode 15
versionName "1.6.2"
```

#### **Step 2: Update `build.gradle`**

```gradle
defaultConfig {
    applicationId "com.wellnessvalley.app"
    minSdkVersion 24
    targetSdkVersion 34
    versionCode 15      // Increment this
    versionName "1.6.2" // Update version name
}
```

#### **Step 3: Build Release APK/AAB**

```bash
cd android
./gradlew assembleRelease  # For APK
# OR
./gradlew bundleRelease    # For AAB (recommended)
```

#### **Step 4: Upload to Play Console**

1. Go to [Google Play Console](https://play.google.com/console)
2. Select your app
3. Navigate to **Testing → Internal testing**
4. Click **Create new release**
5. Upload APK/AAB (versionCode 15)
6. Set **Update Priority**:
   - **Priority 4-5**: Will trigger IMMEDIATE update
   - **Priority 0-3**: Will trigger FLEXIBLE update
7. Click **Save** → **Review release** → **Start rollout**

#### **Step 5: Install Lower Version**

```bash
# Install lower version (versionCode 14) on device
adb install -r app-release-v14.apk
```

#### **Step 6: Join Internal Test Track**

1. Get Internal Test link from Play Console
2. Open link on test device
3. Accept invitation
4. Install/update app from Play Store

### **Testing Scenarios**

#### **Test 1: IMMEDIATE UPDATE (Critical)**

```
1. Upload version 15 with Priority = 5
2. Install version 14 on device
3. Open app
4. ✅ Should see blocking update dialog immediately
5. User cannot dismiss it
6. Click UPDATE → Google Play opens
7. App installs and restarts
```

**Expected Logs**:
```
MainActivity: ✅ Update available: 15
MainActivity: Update type: IMMEDIATE
InAppUpdateManager: Critical update - using IMMEDIATE flow
```

#### **Test 2: FLEXIBLE UPDATE (Optional)**

```
1. Upload version 15 with Priority = 2
2. Install version 14 on device
3. Open app
4. ✅ Should see update dialog with DOWNLOAD and NOT NOW options
5. Click DOWNLOAD
6. App continues working normally
7. Check logs for progress: 10%, 20%, ..., 100%
8. ✅ Snackbar appears: "Update downloaded! Restart to install"
9. Click RESTART → App restarts with new version
```

**Expected Logs**:
```
MainActivity: ✅ Update available: 15
MainActivity: Update type: FLEXIBLE
InAppUpdateManager: Regular update - using FLEXIBLE flow
InAppUpdateManager: Downloading: 45%
InAppUpdateManager: Download complete! Ready to install.
```

#### **Test 3: Staleness (30+ Days)**

```
1. Upload version 15 with Priority = 2 (flexible)
2. Wait 30 days (or use Play Console API to simulate)
3. Open app
4. ✅ Should automatically switch to IMMEDIATE update (even though priority is low)
```

#### **Test 4: No Update Available**

```
1. Install latest version (15)
2. No newer version in Play Console
3. Open app
4. ✅ Should log: "App is up to date"
```

**Expected Logs**:
```
MainActivity: ✅ App is up to date
InAppUpdateManager: No update available
```

#### **Test 5: User Cancels Immediate Update**

```
1. Trigger IMMEDIATE update
2. Press Back button (Android back gesture)
3. ✅ App should go to background
4. Resume app
5. ✅ Update dialog should appear again (onResume loop)
```

---

## 📊 Play Console Configuration

### **Setting Update Priority**

1. Go to Play Console → Your App
2. Navigate to release (Internal/Alpha/Beta/Production)
3. When creating/editing release:
   ```
   Release details
   ├── Release name: v1.6.2
   ├── Release notes: Bug fixes and improvements
   └── Update priority: ⭐⭐⭐⭐⭐ (5 = Critical)
   ```

### **Priority Mapping**

| Priority | Stars | Update Type | Use Case |
|----------|-------|-------------|----------|
| 5 | ⭐⭐⭐⭐⭐ | IMMEDIATE | Critical security fix |
| 4 | ⭐⭐⭐⭐ | IMMEDIATE | Breaking changes |
| 3 | ⭐⭐⭐ | FLEXIBLE | Major features |
| 2 | ⭐⭐ | FLEXIBLE | Minor improvements |
| 1 | ⭐ | FLEXIBLE | Small fixes |
| 0 | (none) | FLEXIBLE | Cosmetic changes |

### **Staged Rollout**

For safer deployments:
```
1. Upload version 15
2. Set rollout percentage: 10%
3. Monitor crashes/ANRs
4. Gradually increase: 25% → 50% → 100%
```

---

## 🚀 Production Checklist

Before releasing to production:

- [ ] Test IMMEDIATE update flow
- [ ] Test FLEXIBLE update flow
- [ ] Test user cancellation handling
- [ ] Test onResume() behavior
- [ ] Test snackbar appearance
- [ ] Verify logs are clean (no errors)
- [ ] Test on multiple Android versions (6.0 - 14)
- [ ] Test with slow network (download progress)
- [ ] Test with no internet (graceful failure)
- [ ] Verify Play Store listing is live
- [ ] Set appropriate update priority
- [ ] Enable staged rollout (recommended)

---

## 🐛 Troubleshooting

### **Issue: Update not detected**
**Solution:**
- Ensure app is downloaded from Play Store (not sideloaded)
- Check versionCode is incremented
- Wait 5-10 minutes after uploading to Play Console
- Clear Google Play Store cache

### **Issue: "Update not available" even with higher version**
**Solution:**
```bash
# Clear Play Store cache
adb shell pm clear com.android.vending

# Reopen Play Store and try again
```

### **Issue: Immediate update doesn't block UI**
**Solution:**
- Verify update priority ≥ 4
- Check logs for actual priority received
- Ensure app is not in debug mode

### **Issue: Flexible update doesn't show snackbar**
**Solution:**
- Check that `android.R.id.content` exists
- Verify Material Snackbar dependency
- Check logs for snackbar creation errors

### **Issue: App crashes on update check**
**Solution:**
```bash
# Check if Play Core is properly added
./gradlew :app:dependencies | grep play-core

# Should show:
# +--- com.google.android.play:app-update:2.1.0
```

---

## 📝 Event Reference

### **JavaScript Events**

| Event Name | Trigger | Data |
|-----------|---------|------|
| `updateAvailable` | Update found | `{ updateType, availableVersionCode }` |
| `updateNotAvailable` | No update | `{}` |
| `updateDownloading` | Download progress | `{ bytesDownloaded, totalBytes, progress }` |
| `updateDownloaded` | Download complete | `{}` |
| `updateInstalling` | Installing | `{}` |
| `updateInstalled` | Install complete | `{}` |
| `updateFailed` | Error occurred | `{ errorCode, message }` |
| `updateCanceled` | User canceled | `{}` |

### **Native Callbacks**

```java
updateManager.setUpdateListener(new InAppUpdateManager.UpdateListener() {
    void onUpdateAvailable(int updateType, int availableVersionCode);
    void onUpdateNotAvailable();
    void onUpdateDownloading(long bytesDownloaded, long totalBytes);
    void onUpdateDownloaded();
    void onUpdateInstalling();
    void onUpdateInstalled();
    void onUpdateFailed(int errorCode, String message);
    void onUpdateCanceled();
});
```

---

## 🎨 Customization Options

### **Change Update Delay**
```java
// MainActivity.java - Line ~115
new Handler(Looper.getMainLooper()).postDelayed(() -> {
    updateManager.checkForUpdate();
}, 5000); // Change from 2000ms to 5000ms
```

### **Customize Snackbar**
```java
// InAppUpdateManager.java - Line ~212
Snackbar snackbar = Snackbar.make(
    rootView,
    "New version ready! Tap to restart.", // Custom message
    Snackbar.LENGTH_INDEFINITE
);
snackbar.setAction("INSTALL NOW", view -> completeUpdate()); // Custom button
snackbar.setBackgroundTint(Color.parseColor("#4CAF50")); // Custom color
```

### **Manual Update Check**
```javascript
// Trigger update check manually from JavaScript
import { checkForUpdate } from './plugins/inAppUpdatePlugin';

// In a button click or specific page
const handleCheckUpdate = async () => {
  try {
    await checkForUpdate();
    console.log('Update check initiated');
  } catch (error) {
    console.error('Update check failed:', error);
  }
};
```

---

## 📚 Additional Resources

- [Google Play In-App Updates Documentation](https://developer.android.com/guide/playcore/in-app-updates)
- [AppUpdateManager API Reference](https://developer.android.com/reference/com/google/android/play/core/appupdate/AppUpdateManager)
- [Testing In-App Updates](https://developer.android.com/guide/playcore/in-app-updates/test)
- [Capacitor Plugin Guide](https://capacitorjs.com/docs/plugins/creating-plugins)

---

## ✅ Implementation Complete

All files have been created and integrated. The app will now:
- ✅ Check for updates on launch (2 second delay)
- ✅ Automatically show IMMEDIATE update for critical releases (priority ≥ 4)
- ✅ Show FLEXIBLE update dialog for regular releases (priority < 4)
- ✅ Download updates in background for flexible updates
- ✅ Show native snackbar when flexible update is ready
- ✅ Handle onResume() to re-prompt immediate updates
- ✅ Send events to JavaScript for custom UI
- ✅ Support manual update checks via plugin

**Next Steps:**
1. Build and test with internal track
2. Set appropriate update priorities
3. Monitor user adoption rates
4. Roll out gradually to production

🎉 **Ready to deploy!**
