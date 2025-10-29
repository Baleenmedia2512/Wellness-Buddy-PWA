# 🔍 Debug Google Sign-In - Step-by-Step Testing

## Current Status ✅
- SHA-1 added to Firebase ✅
- SHA-256 added to Firebase ✅
- Fresh google-services.json ✅
- Configuration files correct ✅

---

## 🧪 Test & Debug Process

### Step 1: Build Fresh Signed APK

```powershell
cd c:\xampp\htdocs\Wellness-Buddy-PWA\frontend\android

# Clean everything
./gradlew clean

# Build signed APK
./gradlew assembleRelease
```

**Output**: `app/build/outputs/apk/release/app-release.apk`

### Step 2: Completely Remove Old App

```powershell
# Uninstall any existing version (removes all cached data)
adb uninstall com.wellnessbuddy.app
```

### Step 3: Install Fresh Signed APK

```powershell
# Install the signed release APK
adb install app/build/outputs/apk/release/app-release.apk
```

### Step 4: Get Real-Time Logs

Open a new terminal and run:

```powershell
# Monitor logs in real-time
adb logcat -c
adb logcat | findstr /i "GoogleAuth Firebase OAuth credential sign"
```

Keep this running while you test!

### Step 5: Test and Check Logs

1. Open the app on your device
2. Click "Continue with Google"
3. Watch the logcat output

---

## 🔍 What to Look For in Logs

### ✅ Good Signs:
```
GoogleAuth: initialize
GoogleAuth: signIn
Firebase: authentication successful
```

### ❌ Bad Signs (Common Errors):

#### Error 1: "DEVELOPER_ERROR" or "API not enabled"
```
OAuth2: Error 10
```
**Solution**: 
- Wait 10-15 minutes for Firebase changes to propagate
- Ensure SHA-256 is in Firebase Console
- Try again

#### Error 2: "Sign in failed" or "null result"
```
GoogleAuth: Sign in failed
```
**Solution**: 
- Check that google-services.json is latest version
- Verify SHA-1 matches your keystore
- Rebuild: `./gradlew clean assembleRelease`

#### Error 3: "serverClientId not found"
```
Missing serverClientId
```
**Solution**: Already correct in your config, but verify:
```xml
<!-- strings.xml should have: -->
<string name="server_client_id">610941252952-u9h8srgfr879aucl4sbc8h3f6i68cq7n.apps.googleusercontent.com</string>
```

---

## 🎯 Quick Verification Commands

### Verify APK is Signed Correctly:
```powershell
jarsigner -verify -verbose -certs app/build/outputs/apk/release/app-release.apk | findstr "CN="
```

Should show: `CN=Easy2Work Developer`

### Verify SHA-1 of Installed APK:
```powershell
# Get the APK signature
keytool -printcert -jarfile app/build/outputs/apk/release/app-release.apk
```

Should show: `SHA1: 25:F3:40:C6:10:61:4D:70:4D:17:BC:FC:6E:C1:2D:B3:5A:81:39:30`

---

## 🔧 Alternative Test: Use Android Client ID

If still not working, try using the **Android OAuth client ID** instead of web client ID:

### Update strings.xml:

**Current (Web Client ID):**
```xml
<string name="server_client_id">610941252952-u9h8srgfr879aucl4sbc8h3f6i68cq7n.apps.googleusercontent.com</string>
```

**Try (Android Client ID):**
```xml
<string name="server_client_id">610941252952-1ovol30kmvb8g0cbg3u85521aq1bj4el.apps.googleusercontent.com</string>
```

Then rebuild and test.

---

## 🚀 Advanced: Check Google Play Services

On your test device:

1. **Settings** → **Apps** → **Google Play Services**
2. Check version (should be recent)
3. If outdated, update from Play Store

---

## 📱 Test Scenarios

### Scenario 1: First Time Sign-In
1. Fresh install
2. Click "Continue with Google"
3. Should show account picker
4. Select account
5. Should authenticate

**Expected Behavior**: Account picker → Select account → Success

### Scenario 2: Already Signed In
1. App already has auth
2. Should maintain session
3. No re-authentication needed

---

## 🔍 Specific Error Solutions

### If you see: "12500: Sign in cancelled"
- User cancelled the sign-in flow
- This is normal if you press back

### If you see: "10: Developer error"
- Firebase configuration mismatch
- **Solution**: 
  1. Download fresh google-services.json
  2. Wait 15 minutes
  3. Rebuild completely

### If you see: "7: Network error"
- Device has no internet
- **Solution**: Check device internet connection

### If you see: "8: Internal error"
- Google Play Services issue
- **Solution**: Update Google Play Services on device

---

## ⚡ Quick Test Script

Run this complete test sequence:

```powershell
# Complete test sequence
cd c:\xampp\htdocs\Wellness-Buddy-PWA\frontend\android

# Step 1: Clean
./gradlew clean

# Step 2: Build
./gradlew assembleRelease

# Step 3: Uninstall old
adb uninstall com.wellnessbuddy.app

# Step 4: Install new
adb install app/build/outputs/apk/release/app-release.apk

# Step 5: Monitor logs
adb logcat -c
adb logcat | findstr /i "GoogleAuth"
```

Then test on device and watch the logs!

---

## 🎯 Most Likely Issues

Based on your setup, if it's still not working:

### Issue #1: Firebase Propagation (70% likely)
**Solution**: Wait 15-20 minutes after adding SHA-256, then rebuild

### Issue #2: Testing Wrong Build (20% likely)
**Solution**: Make SURE you're testing the signed release, not debug

### Issue #3: Cached Google Credentials (10% likely)
**Solution**: 
```powershell
# Clear app data via ADB
adb shell pm clear com.wellnessbuddy.app

# Or uninstall and reinstall
adb uninstall com.wellnessbuddy.app
adb install app/build/outputs/apk/release/app-release.apk
```

---

## 📊 Checklist Before Testing

- [ ] Downloaded fresh google-services.json after adding SHA-256
- [ ] Waited at least 10-15 minutes after Firebase changes
- [ ] Ran `./gradlew clean`
- [ ] Built with `./gradlew assembleRelease` (NOT debug)
- [ ] Uninstalled previous app version completely
- [ ] Installed fresh signed APK
- [ ] Device has internet connection
- [ ] Google Play Services is up to date
- [ ] Monitoring logcat for errors

---

## 🆘 If Still Not Working

Share the output from:

```powershell
# 1. Check APK signature
jarsigner -verify -verbose -certs app/build/outputs/apk/release/app-release.apk

# 2. Check SHA fingerprint
keytool -printcert -jarfile app/build/outputs/apk/release/app-release.apk

# 3. Capture error logs
adb logcat -d | findstr /i "GoogleAuth error failed"
```

This will help identify the exact issue!
