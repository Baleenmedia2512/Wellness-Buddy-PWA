# 🔍 Google Sign-In Troubleshooting - Signed Bundle

## ✅ What's Already Correct

Based on your Firebase screenshot:
- ✅ SHA-1 fingerprint added: `25:f3:40:c6:10:61:4d:70:4d:17:bc:fc:6e:c1:2d:b3:5a:81:39:30`
- ✅ SHA-256 fingerprint added: `a4:77:48:1d:8a:63:b4:eb:60:25:f7:d4:6d:b2:7f:fd:b9:87:05:1f:9e:bf:ec:a0:43:5a:d6:9c:d6:cd:7b:e1`
- ✅ Configuration files are correct
- ✅ Keystore is properly configured

---

## 🔧 Troubleshooting Steps

### Step 1: Download Fresh google-services.json

After adding SHA-256, Firebase generates a new configuration. You need to download it:

1. **Firebase Console**: https://console.firebase.google.com/
2. **Project Settings** → **Your apps** → **com.wellnessbuddy.app**
3. **Click**: "Download google-services.json" button
4. **Replace** the file at: `frontend/android/app/google-services.json`

### Step 2: Clean Build

```powershell
cd frontend/android
./gradlew clean
```

### Step 3: Sync Capacitor

```powershell
cd ..
npx cap sync android
```

### Step 4: Rebuild Signed Bundle

```powershell
cd android
./gradlew bundleRelease
```

---

## 🧪 Step 5: Test Properly

**IMPORTANT**: You MUST test with the actual signed build, not debug build!

### Option A: Test with Signed APK

```powershell
# Build signed APK
./gradlew assembleRelease

# APK location: app/build/outputs/apk/release/app-release.apk

# Install on device
adb install -r app/build/outputs/apk/release/app-release.apk
```

### Option B: Upload to Play Store Internal Testing

This is the MOST ACCURATE test because it uses Google's signing:

1. Upload `app-release.aab` to Play Console
2. Go to: **Internal testing** track
3. Add your email as tester
4. Install from Play Store link
5. Test Google Sign-In

---

## ⚠️ Common Issues & Solutions

### Issue 1: Still Using Debug Build
**Problem**: Testing with debug build instead of signed release
**Solution**: MUST use signed APK/AAB (assembleRelease or bundleRelease)

### Issue 2: Firebase Propagation Delay
**Problem**: Firebase changes take time to propagate
**Solution**: Wait 5-10 minutes after adding SHA-256, then rebuild

### Issue 3: Cached Credentials
**Problem**: Old cached Google credentials on device
**Solution**: 
```powershell
# Uninstall app completely
adb uninstall com.wellnessbuddy.app

# Reinstall signed version
adb install app/build/outputs/apk/release/app-release.apk
```

### Issue 4: Google Play Services Outdated
**Problem**: Device has old Google Play Services
**Solution**: Update Google Play Services on test device

### Issue 5: Play App Signing Not Configured
**Problem**: If using Play Console, Google re-signs with different key
**Solution**: Get SHA-1 & SHA-256 from Play Console and add to Firebase

To get Play Store signing key:
1. **Play Console** → **Setup** → **App integrity**
2. Find: **App signing key certificate**
3. Copy SHA-1 and SHA-256
4. Add these to Firebase as well

---

## 🎯 Verification Checklist

Before testing:
- [ ] Downloaded fresh google-services.json after adding SHA-256
- [ ] Replaced google-services.json in project
- [ ] Ran `./gradlew clean`
- [ ] Ran `npx cap sync android`
- [ ] Built signed release: `./gradlew bundleRelease` or `assembleRelease`
- [ ] Uninstalled any previous version from device
- [ ] Installed SIGNED version (not debug)
- [ ] Waited 5-10 minutes after Firebase changes
- [ ] Testing on device with updated Google Play Services

---

## 📱 Expected Test Flow

1. **Open signed APK** on device
2. Click **"Continue with Google"**
3. **Native account picker** should appear
4. Select Google account
5. **Should authenticate successfully**

If it fails, check logcat:
```powershell
adb logcat | findstr "GoogleAuth\|Firebase\|OAuth"
```

---

## 🚀 Play Console App Signing (IMPORTANT!)

If you're uploading to Play Store:

### First Upload:
1. Upload your AAB
2. Google will show you their signing certificate

### After First Upload:
1. Go to: **Play Console** → **Setup** → **App integrity**
2. Under **App signing key certificate**, you'll see:
   - SHA-1: (Google's key)
   - SHA-256: (Google's key)
3. **Copy these** and **add to Firebase**

### Result:
You'll have 4 fingerprints in Firebase:
- Your debug keystore (SHA-1)
- Your release keystore (SHA-1) ✅
- Your release keystore (SHA-256) ✅
- Play Store signing key (SHA-1) - After upload
- Play Store signing key (SHA-256) - After upload

This is NORMAL and CORRECT!

---

## 🔍 Debug Information

### Check APK Signature:
```powershell
jarsigner -verify -verbose -certs app/build/outputs/apk/release/app-release.apk
```

Should show: CN=Easy2Work Developer

### Check google-services.json:
Look for this in your google-services.json:
```json
{
  "client_id": "610941252952-1ovol30kmvb8g0cbg3u85521aq1bj4el.apps.googleusercontent.com",
  "client_type": 1,
  "android_info": {
    "package_name": "com.wellnessbuddy.app",
    "certificate_hash": "25f340c610614d704d17bcfc6ec12db35a813930"
  }
}
```

The `certificate_hash` should match your keystore SHA-1 (without colons).

---

## ✅ Most Likely Solution

Based on your setup, the most likely fixes are:

1. **Download fresh google-services.json** (do this NOW)
2. **Wait 5-10 minutes** for Firebase changes to propagate
3. **Clean rebuild**: `./gradlew clean bundleRelease`
4. **Test with signed build** (not debug!)

If still not working after these steps, then you'll need to add Play Store signing keys (after first upload).

---

## 📞 Next Steps

1. Download fresh `google-services.json` from Firebase
2. Replace the file in your project
3. Clean and rebuild
4. Test with signed APK
5. If still failing, share the error from logcat

The configuration looks correct, so it's likely just a matter of:
- Using fresh google-services.json
- Waiting for propagation
- Testing with the actual signed build
