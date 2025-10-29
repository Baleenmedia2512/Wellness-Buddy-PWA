# 🔐 Google Sign-In Fix for Signed Bundle

## ✅ Current Status

Your `google-services.json` **already has** the correct release certificate hash!

**Your Release Keystore Fingerprints:**
- **SHA-1**: `25:F3:40:C6:10:61:4D:70:4D:17:BC:FC:6E:C1:2D:B3:5A:81:39:30` ✅
- **SHA-256**: `A4:77:48:1D:8A:63:B4:EB:60:25:F7:D4:6D:B2:7F:FD:B9:87:05:1F:9E:BF:EC:A0:43:5A:D6:9C:D6:CD:7B:E1`

---

## ⚠️ The Problem

Google Sign-In requires **BOTH SHA-1 AND SHA-256** fingerprints in Firebase Console.

You likely have the SHA-1 but **missing the SHA-256**.

---

## 🚀 SOLUTION - Add SHA-256 to Firebase

### Step 1: Open Firebase Console

1. Go to: https://console.firebase.google.com/
2. Select project: **wellness-buddy-5de14**

### Step 2: Navigate to Settings

1. Click ⚙️ **Settings** (gear icon) → **Project settings**
2. Scroll to **Your apps** section
3. Find: **com.wellnessbuddy.app** (Android app)

### Step 3: Add SHA-256 Fingerprint

1. Scroll to **SHA certificate fingerprints** section
2. Click **"Add fingerprint"** button
3. **Paste this SHA-256**:
   ```
   A4:77:48:1D:8A:63:B4:EB:60:25:F7:D4:6D:B2:7F:FD:B9:87:05:1F:9E:BF:EC:A0:43:5A:D6:9C:D6:CD:7B:E1
   ```
4. Click **Save**

### Step 4: Verify Both Fingerprints Are Present

After saving, you should see in Firebase Console:

**SHA-1 Fingerprints:**
- `25:F3:40:C6:10:61:4D:70:4D:17:BC:FC:6E:C1:2D:B3:5A:81:39:30` ✅

**SHA-256 Fingerprints:**
- `A4:77:48:1D:8A:63:B4:EB:60:25:F7:D4:6D:B2:7F:FD:B9:87:05:1F:9E:BF:EC:A0:43:5A:D6:9C:D6:CD:7B:E1` ✅

---

## 🔄 Step 5: Rebuild Your Signed Bundle

```powershell
cd frontend/android
./gradlew clean
./gradlew bundleRelease
```

**Output**: `app/build/outputs/bundle/release/app-release.aab`

---

## 🧪 Step 6: Test

### Option A: Test with Signed APK (Faster)

```powershell
./gradlew assembleRelease
# Output: app/build/outputs/apk/release/app-release.apk
# Install on device and test
```

### Option B: Upload to Play Store Internal Testing

1. Upload AAB to Play Console
2. Use Internal Testing track
3. Install from Play Store link
4. Test Google Sign-In

---

## ✅ Expected Behavior After Fix

1. Open app
2. Click **"Continue with Google"**
3. Native Android account picker appears ✅
4. Select your Google account ✅
5. Successfully signed in! ✅

---

## 🎯 Why This Happens

- Modern Android apps require **both SHA-1 and SHA-256** for OAuth
- Firebase uses these to verify your app's identity
- Missing SHA-256 = Authentication fails
- Adding SHA-256 = Authentication works!

---

## 📱 Additional: Play Store App Signing

**IMPORTANT**: If using Google Play App Signing:

After first upload to Play Store:
1. Go to: **Play Console** → **Setup** → **App integrity**
2. Find: **App signing key certificate**
3. Copy **SHA-1** and **SHA-256** from there
4. **Add these to Firebase as well!**

This is because Google re-signs your app with their own key.

---

## ✅ Summary

**Action Required:** Add SHA-256 to Firebase Console (Step 3 above)

**That's the only thing you need to do!** Your `google-services.json` is already correct.

After adding SHA-256 to Firebase, rebuild and test. Google Sign-In will work! 🎉
