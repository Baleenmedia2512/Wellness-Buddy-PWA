# 📱 Testing Cache in Debug APK

## ✅ YES - Cache WILL Work in Debug APK!

When you build using `npm run build`, React creates a **production build** with `NODE_ENV=production`, which means the service worker and cache system **will work** in your debug APK.

The "debug" vs "release" distinction is only at the **Android signing level**, not the React build level.

---

## 🚀 Quick Start - Testing Cache in Debug APK

### **Option 1: Quick Test (Recommended)**
```powershell
cd frontend

# Build with cache versioning and sync to Android
npm run android:test-cache

# Then open Android Studio and run the app OR
cd android
.\gradlew.bat assembleDebug
```

### **Option 2: Full Build**
```powershell
cd frontend

# Complete build including cleaning
npm run android:fullbuild
```

---

## 📋 Step-by-Step Testing Process

### **1. Build the App**
```powershell
cd C:\xampp\htdocs\Wellness-Buddy-PWA-1\frontend
npm run build
```

**What happens:**
- ✅ React creates production build
- ✅ `postbuild` script runs automatically
- ✅ Service worker version updated with unique timestamp
- ✅ You'll see: `✅ Service Worker version updated: Version: 2.0.XXXXXXXXXX`

### **2. Sync to Android**
```powershell
npx cap sync android
```

**What happens:**
- ✅ Copies `build/` folder to `android/app/src/main/assets/public/`
- ✅ Includes updated service worker with unique cache version
- ✅ All production optimizations included

### **3. Build Debug APK**
```powershell
cd android
.\gradlew.bat assembleDebug
```

**APK Location:**
```
android\app\build\outputs\apk\debug\app-debug.apk
```

### **4. Install and Test**
```powershell
# Install on connected device/emulator
adb install -r android\app\build\outputs\apk\debug\app-debug.apk
```

---

## 🧪 How to Verify Cache is Working

### **Method 1: Chrome DevTools (Best for detailed inspection)**

1. Connect your Android device via USB
2. Enable USB Debugging on device
3. Open Chrome → `chrome://inspect`
4. Find your app and click "inspect"
5. In DevTools Console, you should see:

```
🔧 [PWA] Environment: {isNative: true, platform: "android", nodeEnv: "production"}
✅ [PWA] Service Worker registered successfully
   Scope: https://localhost/
   Platform: Android APK
[Service Worker] Installing new version...
[Service Worker] Caching app shell
[Service Worker] Activating new version...
```

### **Method 2: Check Application Tab**

1. In Chrome DevTools → **Application** tab
2. **Service Workers** section:
   - Should show: `https://localhost/service-worker.js` (activated and running)
   - Status: 🟢 Activated and running
3. **Cache Storage** section:
   - Should show: `wellness-valley-2.0.XXXXXXXXX` (with your unique timestamp)
   - Click to see cached files

### **Method 3: Test Offline Mode**

1. Open app in flight mode / disconnect internet
2. App should still load from cache
3. Console should show: `[Service Worker] Serving from cache`

### **Method 4: Test Cache Update**

**First Installation:**
```powershell
npm run build  # Version: 2.0.1709040123456
npx cap sync android
.\gradlew.bat assembleDebug
adb install android\app\build\outputs\apk\debug\app-debug.apk
```

**Make a visible change:**
- Edit `src/App.js` - change a button color or text
- Or edit `src/components/Header.js`

**Build version 2:**
```powershell
npm run build  # Version: 2.0.1709040999999 (new timestamp!)
npx cap sync android
.\gradlew.bat assembleDebug
adb install -r android\app\build\outputs\apk\debug\app-debug.apk
```

**Open app - you should see:**
```
🔄 [PWA] Update found, installing new version...
📝 [PWA] Service Worker state: installing
📝 [PWA] Service Worker state: installed
✅ [PWA] New version installed and ready!
[Show popup: "🎉 New version available! Click OK to update..."]
```

Click OK → App reloads with new version!

---

## 🔍 Common Scenarios

### **Scenario 1: First Install**
```
User installs app
   ↓
Service worker registers
   ↓
App shell cached (wellness-valley-2.0.XXX)
   ↓
App runs normally
```

### **Scenario 2: Update Available**
```
User opens app (has old version)
   ↓
App detects new service worker
   ↓
New version installs in background
   ↓
Old cache deleted automatically
   ↓
User sees "New version available" prompt
   ↓
User clicks OK → Reload → Latest version!
```

### **Scenario 3: Offline Use**
```
User opens app (no internet)
   ↓
Service worker serves from cache
   ↓
App shell loads normally
   ↓
API calls fail gracefully
   ↓
User sees "offline" message where needed
```

---

## 📊 Cache Statistics (Debug Commands)

Open Chrome DevTools Console and run:

```javascript
// View cache statistics
cacheStats()

// Output:
// 📊 [CACHE-STATS] {
//   Cache Entries: 15,
//   Pending Requests: 0,
//   Memory (KB): 45,
//   Entries: [...]
// }

// Clear cache manually (for testing)
window.__cacheManager.clearAll()

// Check service worker status
navigator.serviceWorker.getRegistrations().then(regs => {
  regs.forEach(reg => {
    console.log('SW Scope:', reg.scope);
    console.log('SW Active:', reg.active?.state);
  });
});
```

---

## ⚠️ Troubleshooting

### **Issue: Service Worker not registering**

**Check:**
```javascript
// In Chrome DevTools Console:
console.log('NODE_ENV:', process.env.NODE_ENV);
// Should output: "production"

console.log('SW Support:', 'serviceWorker' in navigator);
// Should output: true

console.log('Platform:', Capacitor.getPlatform());
// Should output: "android"
```

**Solution:**
- Ensure you ran `npm run build` (not `npm start`)
- Check console for registration errors
- Verify `android/app/src/main/assets/public/service-worker.js` exists

### **Issue: Cache not updating**

**Check:**
1. Build logs show: `✅ Service Worker version updated`
2. Open `android/app/src/main/assets/public/service-worker.js`
3. Verify `VERSION` has unique timestamp (not `BUILD_TIMESTAMP`)

**Solution:**
```powershell
# Delete old build
rm -rf build

# Fresh build
npm run build

# Verify version updated
cat android\app\src\main\assets\public\service-worker.js | Select-String "VERSION"

# Should show: const VERSION = '2.0.XXXXXXXXX';
```

### **Issue: Old cache still loading**

**Solution:**
```javascript
// In Chrome DevTools → Application → Service Workers
// Click "Unregister"

// Then in Cache Storage
// Right-click each cache → Delete

// Reload app - fresh install
```

---

## 🎯 Expected Console Output (Debug APK)

When everything works correctly:

```
[App Startup]
🔧 [PWA] Environment: {isNative: true, platform: "android", nodeEnv: "production"}
✅ [PWA] Service Worker registered successfully
   Scope: https://localhost/
   Platform: Android APK

[Service Worker]
[Service Worker] Installing new version...
[Service Worker] Caching app shell
[Service Worker] Activating new version...
[Service Worker] Taking control of all pages
[Service Worker] Deleting old cache: wellness-valley-2.0.1709039999999

[Update Check - Every 5 minutes]
🔍 [PWA] Checking for updates...
🔄 [PWA] Update found, installing new version...
📝 [PWA] Service Worker state: installing
📝 [PWA] Service Worker state: installed
✅ [PWA] New version installed and ready!
```

---

## ✅ Confirmation Checklist

Before testing, verify:

- [ ] Ran `npm run build` (NOT `npm start`)
- [ ] Saw "✅ Service Worker version updated" in build output
- [ ] Ran `npx cap sync android`
- [ ] Built APK: `.\gradlew.bat assembleDebug`
- [ ] Installed on device: `adb install -r app-debug.apk`

When testing:

- [x] Chrome DevTools shows service worker registered
- [x] Console shows "Platform: Android APK"
- [x] Cache storage shows `wellness-valley-2.0.XXXXX`
- [x] App works offline
- [ ] Update prompt appears when new version deployed

---

## 🎉 Summary

✅ **Cache WORKS in debug APK**  
✅ **Auto-updates when you deploy new version**  
✅ **Offline support enabled**  
✅ **Unique version per build**  

**Test flow:**
```powershell
npm run build → npx cap sync android → Build APK → Install → Test!
```

**Every time you build, cache version changes automatically!** 🚀
