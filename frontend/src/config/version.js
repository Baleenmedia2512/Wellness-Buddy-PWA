/**
 * 🔢 APP VERSION CONFIGURATION
 * 
 * This is the SINGLE SOURCE OF TRUTH for app versioning.
 * Update these values when releasing a new version.
 * 
 * ⚠️ IMPORTANT: After changing version here, also update:
 * 1. frontend/android/app/build.gradle (versionCode & versionName)
 * 2. frontend/package.json (version field)
 * 
 * 📋 VERSION NUMBERING GUIDE (Semantic Versioning):
 * 
 * Format: MAJOR.MINOR.PATCH
 * 
 * MAJOR (1.x.x):
 *   - Breaking changes
 *   - Complete redesign
 *   - Major feature overhaul
 *   Example: 1.0.0 → 2.0.0
 * 
 * MINOR (x.1.x):
 *   - New features (backwards compatible)
 *   - Significant improvements
 *   - New functionality
 *   Example: 1.0.0 → 1.1.0
 * 
 * PATCH (x.x.1):
 *   - Bug fixes
 *   - Minor improvements
 *   - Security patches
 *   Example: 1.1.0 → 1.1.1
 * 
 * 🔄 WHEN TO UPDATE WHICH NUMBER:
 * 
 * PATCH Version (x.x.X) - Increment for:
 *   ✓ Bug fixes only
 *   ✓ Security patches
 *   ✓ Performance improvements (no new features)
 *   ✓ Text/UI corrections
 *   Example: Google Sign-In bug fix
 * 
 * MINOR Version (x.X.x) - Increment for:
 *   ✓ New features added
 *   ✓ New screens/pages
 *   ✓ Enhanced functionality
 *   ✓ New integrations
 *   Example: Adding nutrition dashboard, new authentication method
 * 
 * MAJOR Version (X.x.x) - Increment for:
 *   ✓ Complete app redesign
 *   ✓ Breaking API changes
 *   ✓ Major architectural changes
 *   ✓ Removing old features
 *   Example: Complete UI overhaul, new backend system
 * 
 * 📱 VERSION CODE (Android):
 *   - Must ALWAYS INCREMENT (never decrease)
 *   - Should be sequential: 1, 2, 3, 4, 5...
 *   - Play Store uses this to identify newer versions
 *   - Rule: versionCode++ for every release
 * 
 * 📝 EXAMPLE VERSION HISTORY:
 *   v1.0.0 (code 1) - Initial Release
 *   v1.0.1 (code 2) - Bug fixes
 *   v1.1.0 (code 3) - Privacy improvements + new features
 *   v1.1.1 (code 4) - Authentication fix
 *   v1.2.0 (code 5) - New dashboard feature
 *   v2.0.0 (code 6) - Major redesign
 * 
 * 🎯 CURRENT RELEASE:
 */

export const APP_VERSION = {
  // Current version number (displayed to users)
  VERSION: '1.2.0',
  
  // Version code (for Android builds - must match build.gradle)
  VERSION_CODE: 3,
  
  // Release name (for Play Store)
  RELEASE_NAME: 'Authentication Fix & Stability',
  
  // Build date
  BUILD_DATE: '2025-10-29',
};

/**
 * 📋 CHANGE LOG
 * 
 * Version 1.2.0 (Code 3) - 2025-10-29
 *   🔐 Fixed Google Sign-In for release builds
 *   ✨ Added version display in app menu
 *   🔧 Updated signing certificates
 *   🐛 Fixed authentication bugs
 * 
 * Version 1.1.0 (Code 2) - Previous
 *   🔒 Privacy improvements (gallery monitoring)
 *   ⚡ Performance enhancements (85% faster)
 *   ✨ UI improvements
 * 
 * Version 1.0.0 (Code 1) - Initial Release
 *   🎉 Initial app release
 *   📸 AI-powered food analysis
 *   🔐 Google Sign-In
 *   📊 Nutrition tracking
 */

/**
 * 🔄 HOW TO UPDATE VERSION FOR NEW RELEASE:
 * 
 * Step 1: Update THIS file (version.js)
 *   - Change VERSION to new version number
 *   - Increment VERSION_CODE by 1
 *   - Update RELEASE_NAME
 *   - Update BUILD_DATE
 *   - Add entry to CHANGE LOG
 * 
 * Step 2: Update build.gradle
 *   File: frontend/android/app/build.gradle
 *   Change:
 *     versionCode 3        → versionCode 4 (or next number)
 *     versionName "1.2.0"  → versionName "1.3.0" (or next version)
 * 
 * Step 3: Update package.json
 *   File: frontend/package.json
 *   Change:
 *     "version": "1.2.0"   → "version": "1.3.0" (or next version)
 * 
 * Step 4: Rebuild
 *   Run: ./gradlew clean bundleRelease
 * 
 * ✅ That's it! The version will automatically appear in the app.
 */

// Helper function to get formatted version string
export const getVersionString = () => {
  return `Version ${APP_VERSION.VERSION}`;
};

// Helper function to get full version info
export const getFullVersionInfo = () => {
  return {
    version: APP_VERSION.VERSION,
    versionCode: APP_VERSION.VERSION_CODE,
    releaseName: APP_VERSION.RELEASE_NAME,
    buildDate: APP_VERSION.BUILD_DATE,
    displayText: getVersionString(),
  };
};

export default APP_VERSION;
