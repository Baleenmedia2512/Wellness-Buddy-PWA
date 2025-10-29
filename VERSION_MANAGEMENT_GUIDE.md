# 📦 Version Management Guide

## ✅ Current Setup

The app now uses a **centralized version configuration** system with a single source of truth for version information.

### 📁 File Structure:
```
frontend/src/config/version.js    ← Single source of truth
frontend/src/components/Header.js ← Uses version from config
frontend/android/app/build.gradle ← Android build version
frontend/package.json             ← NPM package version
```

---

## 🎯 How Version is Displayed

The version number appears in the **user menu dropdown** when you click the profile picture in the header.

**Display Format:** `Version 1.2.0`

---

## 🔄 How to Update Version (Step-by-Step)

### Step 1: Update `version.js` (Main Configuration)

**File:** `frontend/src/config/version.js`

Update these values:
```javascript
export const APP_VERSION = {
  VERSION: '1.2.0',           // ← Change this to new version (e.g., '1.3.0')
  VERSION_CODE: 3,            // ← Increment by 1 (e.g., 4)
  RELEASE_NAME: 'Your Release Name',  // ← Update release name
  BUILD_DATE: '2025-10-29',   // ← Update to today's date
};
```

**Decision Guide for VERSION:**

| Change Type | Example | What to Update |
|------------|---------|----------------|
| **Bug Fix** | Fixed Google Sign-In | `1.2.0` → `1.2.1` (PATCH) |
| **New Feature** | Added nutrition dashboard | `1.2.0` → `1.3.0` (MINOR) |
| **Major Redesign** | Complete UI overhaul | `1.2.0` → `2.0.0` (MAJOR) |

**Decision Guide for VERSION_CODE:**
- **ALWAYS increment by 1** for every release
- Never decrease or reuse a version code
- Example: 3 → 4 → 5 → 6 (sequential)

### Step 2: Update `build.gradle` (Android Build)

**File:** `frontend/android/app/build.gradle`

Find and update:
```gradle
defaultConfig {
    applicationId "com.wellnessbuddy.app"
    minSdkVersion rootProject.ext.minSdkVersion
    targetSdkVersion rootProject.ext.targetSdkVersion
    versionCode 3              // ← Change to match VERSION_CODE (e.g., 4)
    versionName "1.2.0"        // ← Change to match VERSION (e.g., "1.3.0")
    testInstrumentationRunner "androidx.test.runner.AndroidJUnitRunner"
```

**Rules:**
- `versionCode` must match `VERSION_CODE` from version.js
- `versionName` must match `VERSION` from version.js (in quotes)

### Step 3: Update `package.json` (NPM Package)

**File:** `frontend/package.json`

Find and update:
```json
{
  "name": "wellness-buddy-pwa-frontend",
  "version": "1.2.0",    // ← Change to match VERSION (e.g., "1.3.0")
  "private": true,
```

**Rule:**
- `version` must match `VERSION` from version.js

### Step 4: Update CHANGE LOG in `version.js`

Add your changes to the CHANGE LOG section in `version.js`:

```javascript
/**
 * 📋 CHANGE LOG
 * 
 * Version 1.3.0 (Code 4) - 2025-11-15
 *   ✨ Added new dashboard feature
 *   🔧 Improved performance
 *   🐛 Fixed minor bugs
 * 
 * Version 1.2.0 (Code 3) - 2025-10-29
 *   🔐 Fixed Google Sign-In for release builds
 *   ✨ Added version display in app menu
 *   ...
 */
```

---

## 📊 Quick Reference Table

| What Changed | PATCH (x.x.X) | MINOR (x.X.x) | MAJOR (X.x.x) |
|-------------|---------------|---------------|---------------|
| Bug fixes | ✅ | ❌ | ❌ |
| Security patches | ✅ | ❌ | ❌ |
| Performance tweaks | ✅ | ❌ | ❌ |
| New features | ❌ | ✅ | ❌ |
| New screens/pages | ❌ | ✅ | ❌ |
| UI improvements | ❌ | ✅ | ❌ |
| Complete redesign | ❌ | ❌ | ✅ |
| Breaking changes | ❌ | ❌ | ✅ |

---

## 💡 Real-World Examples

### Example 1: Bug Fix Release
**Scenario:** Fixed a crash when uploading images

```javascript
// version.js
VERSION: '1.2.1',        // Was 1.2.0, increment PATCH
VERSION_CODE: 4,         // Was 3, increment by 1
```

```gradle
// build.gradle
versionCode 4            // Was 3
versionName "1.2.1"      // Was "1.2.0"
```

```json
// package.json
"version": "1.2.1"       // Was "1.2.0"
```

### Example 2: New Feature Release
**Scenario:** Added nutrition history dashboard

```javascript
// version.js
VERSION: '1.3.0',        // Was 1.2.0, increment MINOR
VERSION_CODE: 4,         // Was 3, increment by 1
```

```gradle
// build.gradle
versionCode 4            // Was 3
versionName "1.3.0"      // Was "1.2.0"
```

```json
// package.json
"version": "1.3.0"       // Was "1.2.0"
```

### Example 3: Major Update
**Scenario:** Complete app redesign with new architecture

```javascript
// version.js
VERSION: '2.0.0',        // Was 1.2.0, increment MAJOR
VERSION_CODE: 4,         // Was 3, increment by 1
```

```gradle
// build.gradle
versionCode 4            // Was 3
versionName "2.0.0"      // Was "1.2.0"
```

```json
// package.json
"version": "2.0.0"       // Was "1.2.0"
```

---

## 🔍 Verification Checklist

Before building for release:

- [ ] Updated `VERSION` in `version.js`
- [ ] Incremented `VERSION_CODE` in `version.js`
- [ ] Updated `RELEASE_NAME` in `version.js`
- [ ] Updated `BUILD_DATE` in `version.js`
- [ ] Updated CHANGE LOG in `version.js`
- [ ] Updated `versionCode` in `build.gradle` (matches VERSION_CODE)
- [ ] Updated `versionName` in `build.gradle` (matches VERSION)
- [ ] Updated `version` in `package.json` (matches VERSION)
- [ ] All three files have same version number
- [ ] Version code always incremented (never same or lower)

---

## 🏗️ Build After Version Update

```powershell
# Navigate to android directory
cd frontend/android

# Clean previous builds
./gradlew clean

# Build signed release bundle
./gradlew bundleRelease

# Output: app/build/outputs/bundle/release/app-release.aab
```

---

## 🧪 Testing Version Display

1. Build and install the app
2. Sign in
3. Click profile picture (top right)
4. Check bottom of dropdown menu
5. Should display: `Version X.X.X` (your new version)

---

## 📝 Version Number Format

**Semantic Versioning: MAJOR.MINOR.PATCH**

```
      1  .  2  .  0
      ↑     ↑     ↑
    MAJOR MINOR PATCH
```

- **MAJOR**: Incompatible API changes, major redesigns
- **MINOR**: New features, backwards compatible
- **PATCH**: Bug fixes, backwards compatible

---

## ⚠️ Common Mistakes to Avoid

❌ **DON'T:** Update only one file and forget others
✅ **DO:** Update all three files (version.js, build.gradle, package.json)

❌ **DON'T:** Reuse or decrease version code
✅ **DO:** Always increment version code by 1

❌ **DON'T:** Use different version numbers in different files
✅ **DO:** Keep VERSION synchronized across all files

❌ **DON'T:** Forget to update CHANGE LOG
✅ **DO:** Document what changed in each version

---

## 🎯 Summary

**One Place to Update Version Logic:**
- `frontend/src/config/version.js` ← Main source

**Three Places to Update Version Numbers:**
1. `frontend/src/config/version.js` (VERSION & VERSION_CODE)
2. `frontend/android/app/build.gradle` (versionCode & versionName)
3. `frontend/package.json` (version)

**Where Version Appears:**
- User menu dropdown (shown to all users)

**Auto-Updates:**
- The Header component automatically reads from version.js
- No need to manually update UI components

---

## 🚀 Next Release Example

When you're ready for the next release:

1. **Decide version type**: Bug fix (1.2.1) or New feature (1.3.0)?
2. **Update version.js**:
   - Change VERSION to `1.3.0`
   - Change VERSION_CODE to `4`
   - Update RELEASE_NAME
   - Update BUILD_DATE
3. **Update build.gradle**: versionCode `4`, versionName `"1.3.0"`
4. **Update package.json**: version `"1.3.0"`
5. **Build**: `./gradlew clean bundleRelease`
6. **Verify**: Check version in app menu
7. **Upload to Play Store**

That's it! Clean, simple, and maintainable! ✨
