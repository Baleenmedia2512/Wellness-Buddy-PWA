# Google Sign-In Fix for Play Store - Version 6 (1.2.3)

## 🔴 Problem
Google Sign-In was failing in the Play Store release with error:
```
❌ Auth state: User not authenticated
```

**Symptoms:**
- Google Sign-In works perfectly in **debug builds** (local testing)
- Google Sign-In **fails** in **Play Store releases** (closed testing/production)
- Error appears immediately after clicking "Sign in with Google"
- No user authentication state is set

---

## � Root Cause

When you upload an APK to Google Play Store with **App Signing by Google Play** enabled:

1. You sign the APK with your **Upload Key** (local keystore)
2. Google Play **re-signs** the APK with their **App Signing Key** before distribution
3. The distributed APK has a **different SHA-1 certificate** than your local build
4. Firebase rejects authentication because the **App Signing SHA-1 wasn't registered**

**The Fix:** Add the Play Store App Signing SHA-1 certificate to Firebase.

---

## ✅ Solution

### **Step 1: Get Both SHA-1 Certificates from Play Console**

1. Open [Google Play Console](https://play.google.com/console)
2. Select your app: **Wellness Buddy**
3. Navigate to: **Setup → App signing**
4. Copy **BOTH** SHA-1 certificates:

#### **App Signing Key Certificate** (What Google uses to sign releases)
```
7D:DF:44:EA:A7:33:CB:AB:78:66:EE:01:7D:FC:89:25:0A:E4:4C:1F
```
**This is the one causing the auth failure!**

#### **Upload Key Certificate** (What you use to sign before upload)
```
25:F3:40:C6:10:61:4D:70:4D:17:BC:FC:6E:C1:2D:B3:5A:81:39:30
```

---

### **Step 2: Add Both SHA-1s to Firebase Console**

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select project: **wellness-buddy-5de14**
3. Click ⚙️ **Project Settings**
4. Scroll to **"Your apps"** section
5. Find Android app: **com.wellnessbuddy.app**

#### Add App Signing Key SHA-1:
1. Click **"Add fingerprint"**
2. Paste: `7D:DF:44:EA:A7:33:CB:AB:78:66:EE:01:7D:FC:89:25:0A:E4:4C:1F`
3. Click **Save**

#### Add Upload Key SHA-1:
1. Click **"Add fingerprint"** again
2. Paste: `25:F3:40:C6:10:61:4D:70:4D:17:BC:FC:6E:C1:2D:B3:5A:81:39:30`
3. Click **Save**

---

### **Step 3: Download Updated google-services.json**

1. After saving both SHA-1s, click **"Download google-services.json"**
2. Replace the file in your project:
   ```
   frontend/android/app/google-services.json
   ```

**The updated file will contain new OAuth client entries:**
```json
{
  "client_id": "610941252952-bd150c5jrgd3ol7umdf708e2d184efqd.apps.googleusercontent.com",
  "client_type": 1,
  "android_info": {
    "package_name": "com.wellnessbuddy.app",
    "certificate_hash": "7ddf44eaa733cbab7866ee017dfc89250ae44c1f"
  }
}
```

---

### **Step 4: Sync and Rebuild**

```powershell
# Navigate to frontend directory
cd c:\xampp\htdocs\Wellness-Buddy-PWA\frontend

# Sync Capacitor to apply the updated google-services.json
npx cap sync android

# Build the release APK
.\build-apk.bat
```

Or manually:
```powershell
cd android
.\gradlew clean
.\gradlew assembleRelease
```

---

### **Step 5: Upload New Release to Play Store**

1. **Bump version** in `frontend/android/app/build.gradle`:
   ```gradle
   versionCode 6
   versionName "1.2.3"
   ```

2. **Locate the APK**:
   ```
   frontend\android\app\build\outputs\apk\release\app-release.apk
   ```

3. **Upload to Play Console**:
   - Go to: **Testing → Closed testing - Alpha → Create new release**
   - Upload the APK
   - Add release notes mentioning Google Sign-In fix
   - Review and rollout

---

## 🧪 Testing the Fix

### **For Testers:**

#### **Option A: Wait for New Build (Recommended)**
1. Wait for the new version (6 / 1.2.3) to be available in Play Store
2. Update the app
3. Try Google Sign-In
4. ✅ Should work successfully

#### **Option B: Quick Test (Without New Build)**
If you want to test immediately:
1. **Uninstall** the app completely
2. Clear Google Play Store cache:
   ```
   Settings → Apps → Google Play Store → Storage → Clear Cache & Data
   ```
3. Wait **15-20 minutes** (for Firebase to propagate)
4. **Re-install** from Play Store
5. Try Google Sign-In

**Note:** Option B may work but is not guaranteed. Option A (new build) is the proper fix.

---

## 📊 Verification

### **Before Fix:**
```
❌ google-services.json had OAuth clients for:
   - Upload Key SHA-1: 25f340c610614d704d17bcfc6ec12db35a813930 ✅
   - App Signing SHA-1: MISSING ❌
   
Result: Auth fails in Play Store builds
```

### **After Fix:**
```
✅ google-services.json now has OAuth clients for:
   - Upload Key SHA-1: 25f340c610614d704d17bcfc6ec12db35a813930 ✅
   - App Signing SHA-1: 7ddf44eaa733cbab7866ee017dfc89250ae44c1f ✅
   
Result: Auth works in both debug and Play Store builds
```

---

## 📝 Technical Details

### **How Google Sign-In Authentication Works:**

1. User clicks "Sign in with Google" in Android app
2. App sends authentication request with:
   - Package name: `com.wellnessbuddy.app`
   - APK signature (SHA-1): `7ddf44eaa733cbab7866ee017dfc89250ae44c1f`
3. Firebase checks: "Is this SHA-1 registered for this package?"
4. Firebase finds OAuth client: `610941252952-bd150c5jrgd3ol7umdf708e2d184efqd`
5. ✅ Authentication succeeds

### **OAuth Clients in google-services.json:**

```json
{
  "oauth_client": [
    {
      "client_id": "610941252952-1ovol30kmvb8g0cbg3u85521aq1bj4el.apps.googleusercontent.com",
      "certificate_hash": "25f340c610614d704d17bcfc6ec12db35a813930"
      // ↑ For local debug builds (Upload Key)
    },
    {
      "client_id": "610941252952-bd150c5jrgd3ol7umdf708e2d184efqd.apps.googleusercontent.com",
      "certificate_hash": "7ddf44eaa733cbab7866ee017dfc89250ae44c1f"
      // ↑ For Play Store releases (App Signing Key) - THIS WAS MISSING
    },
    {
      "client_id": "610941252952-u9h8srgfr879aucl4sbc8h3f6i68cq7n.apps.googleusercontent.com",
      "client_type": 3
      // ↑ Web client ID (for server-side validation)
    }
  ]
}
```

---

## 🎯 Expected Results

After implementing this fix:

- ✅ Google Sign-In works in **debug builds** (already working)
- ✅ Google Sign-In works in **Play Store releases** (NOW FIXED)
- ✅ No more "User not authenticated" errors
- ✅ Users can successfully authenticate with Google accounts
- ✅ Profile pictures and user data load correctly

---

## 🔒 Security Notes

- **SHA-1 certificates are public** - they're not secret credentials
- The **App Signing Key** is managed securely by Google Play
- The **Upload Key** should be stored securely (already in keystore)
- `google-services.json` is safe to commit to version control
- Never commit your `.jks` keystore files

---

## 📚 Related Documentation

- [Play App Signing Guide](https://support.google.com/googleplay/android-developer/answer/9842756)
- [Firebase Android Setup](https://firebase.google.com/docs/android/setup)
- [Google Sign-In for Android](https://developers.google.com/identity/sign-in/android/start)

---

## ✅ Resolution Status

- **Issue:** Google Sign-In failing in Play Store releases
- **Fixed in:** Version 6 (1.2.3)
- **Date Fixed:** October 31, 2025
- **Fix Type:** Configuration update (no code changes required)
- **Testing Status:** Ready for testing in Closed Testing - Alpha

---

## 🚀 Quick Reference

**Play Console SHA-1 Certificates:**
- App Signing: `7D:DF:44:EA:A7:33:CB:AB:78:66:EE:01:7D:FC:89:25:0A:E4:4C:1F`
- Upload Key: `25:F3:40:C6:10:61:4D:70:4D:17:BC:FC:6E:C1:2D:B3:5A:81:39:30`

**Firebase Project:** `wellness-buddy-5de14`

**Package Name:** `com.wellnessbuddy.app`

**Build Commands:**
```powershell
npx cap sync android
.\build-apk.bat
```

## 🔍 Root Cause
When you upload an app bundle to Google Play Console, Google Play re-signs your app with its own certificate (App Signing Key). This means:
- Your local debug/release APK uses your local keystore certificate ✅
- Play Store app uses Google Play's managed certificate ❌ (not in google-services.json)

Your Firebase Console shows **4 SHA fingerprints**, but your current `google-services.json` only contains **1** SHA fingerprint:
- Current: `28:d0:18:a3:91:cb:5e:a3:f6:13:4d:a4:60:dc:bd:28:5b:65:03:e5` (SHA-1)

The other 3 SHA fingerprints (including the Google Play App Signing certificate) are missing from your google-services.json file.

## ✅ Solution

### Step 1: Download Updated google-services.json

1. **Go to Firebase Console**:
   - Visit: https://console.firebase.google.com/
   - Select project: **wellness-buddy-5de14**

2. **Navigate to Project Settings**:
   - Click the gear icon ⚙️ (top left) → Project Settings
   - Scroll down to "Your apps" section
   - Find your Android app: **com.wellnessbuddy.app**

3. **Download New google-services.json**:
   - Click the **Download google-services.json** button
   - This will download a NEW file with ALL 4 SHA certificates

4. **Replace Old File**:
   ```bash
   # Backup old file first
   cp frontend/android/app/google-services.json frontend/android/app/google-services.json.backup

   # Replace with new downloaded file
   # Copy the new google-services.json to: frontend/android/app/google-services.json
   ```

### Step 2: Verify the New File

Open the new `google-services.json` and verify it contains **multiple** oauth_client entries with different certificate_hash values:

```json
"oauth_client": [
  {
    "client_id": "...",
    "client_type": 1,
    "android_info": {
      "package_name": "com.wellnessbuddy.app",
      "certificate_hash": "28d018a391cb5ea3f6134da460dcbd285b6503e5"  // SHA-1 #1
    }
  },
  {
    "client_id": "...",
    "client_type": 1,
    "android_info": {
      "package_name": "com.wellnessbuddy.app",
      "certificate_hash": "25f340c61061d470..."  // SHA-1 #2
    }
  },
  {
    "client_id": "...",
    "client_type": 1,
    "android_info": {
      "package_name": "com.wellnessbuddy.app",
      "certificate_hash": "d6cf38eebc..."  // SHA-1 #3
    }
  },
  {
    "client_id": "...",
    "client_type": 1,
    "android_info": {
      "package_name": "com.wellnessbuddy.app",
      "certificate_hash": "a477481d8a63..."  // SHA-256
    }
  },
  {
    "client_id": "610941252952-u9h8srgfr879aucl4sbc8h3f6i68cq7n.apps.googleusercontent.com",
    "client_type": 3  // Web client
  }
]
```

### Step 3: Rebuild and Upload

1. **Sync the changes**:
   ```bash
   cd frontend
   npx cap sync
   ```

2. **Build new app bundle**:
   ```bash
   # In Android Studio:
   # Build → Generate Signed Bundle/APK → Android App Bundle
   # Use your upload keystore: wellness-buddy-keystore.jks
   ```

3. **Upload to Play Store**:
   - Upload the new bundle to Play Console
   - Submit for review (or internal testing)

4. **Test**:
   - Download the app from Play Store (or internal test track)
   - Try Google Sign-In
   - Should work now! ✅

## 🎯 Why This Fixes It

The new `google-services.json` will contain OAuth client configurations for ALL certificate hashes:
1. **Your debug certificate** (development)
2. **Your upload certificate** (the one in wellness-buddy-keystore.jks)
3. **Google Play App Signing certificate** (managed by Google Play) ← This is the key one!
4. **SHA-256 versions** (for enhanced security)

When users download from Play Store, the app is signed with Google Play's certificate (#3), and now Firebase will recognize it.

## 📋 Verification Checklist

- [ ] Downloaded new google-services.json from Firebase Console
- [ ] Verified new file has multiple oauth_client entries with different certificate_hash values
- [ ] Backed up old google-services.json
- [ ] Replaced frontend/android/app/google-services.json with new file
- [ ] Ran `npx cap sync`
- [ ] Built new app bundle
- [ ] Uploaded to Play Console
- [ ] Tested on device with Play Store download
- [ ] Google Sign-In working ✅

## 🔐 Important Notes

### About App Signing Keys

When you enrolled in **Google Play App Signing**, Google Play created a new signing key for your app:
- **Upload Key**: Your keystore (wellness-buddy-keystore.jks) - used to upload bundles
- **App Signing Key**: Google Play's managed key - used to sign the actual app users download

The SHA fingerprints you see in Play Console include both keys.

### Future Updates

Every time you add or change SHA certificates in Firebase/Google Cloud Console, you should:
1. Download a fresh google-services.json
2. Replace the old one
3. Rebuild and upload

### If It Still Doesn't Work

1. **Wait 10-15 minutes**: Google's servers need time to propagate the changes
2. **Clear app data**: On your test device, clear the app data before testing
3. **Check SHA certificates**: In Firebase Console, verify all 4 SHA fingerprints are listed
4. **Check package name**: Ensure it's exactly `com.wellnessbuddy.app` everywhere
5. **Check OAuth consent screen**: In Google Cloud Console, ensure the app is published (not in testing with limited users)

## 🎉 Expected Result

After this fix:
- ✅ Google Sign-In works in debug APK
- ✅ Google Sign-In works in release APK  
- ✅ Google Sign-In works in Play Store bundle ← **FIXED!**
- ✅ All platforms use the same Google OAuth client configuration

Your users will be able to sign in with Google regardless of how they installed the app!
