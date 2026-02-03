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
  VERSION: '1.6.2',
  
  // Version code (for Android builds - must match build.gradle)
  VERSION_CODE: 15,
  
  // Release name (for Play Store)
  RELEASE_NAME: 'Android In-App Updates',
  
  // Build date
  BUILD_DATE: '2026-02-03',
};

/**
 * 📋 CHANGE LOG
 * 
 * Version 1.6.2 (Code 15) - 2026-02-03
 *   ✨ New features and improvements
 *   🔧 Minor enhancements
 * 
 * Version 1.6.1 (Code 14) - 2026-02-02
 *   🔧 Minor bug fixes and improvements
 *   📱 Version bump for maintenance release
 * 
 * Version 1.6.0 (Code 13) - 2026-01-19
 *   💰 Enhanced Token Pricing Configuration with per-million token pricing model
 *   💱 Live USD to INR exchange rate integration with auto-refresh capability
 *   📊 Improved Admin Dashboard with detailed cost breakdown and usage analytics
 *   🔄 Real-time token usage summary with automatic cost calculations
 *   ✨ Better UI for pricing configuration with visual hierarchy
 *   🔧 Added reset to defaults functionality for pricing configuration
 *   📈 Enhanced exchange rate display with loading states and refresh button
 *   🎨 Implemented clear logo display and branding improvements
 * 
 * Version 1.5.0 (Code 12) - 2026-01-07
 *   🚀 Enhanced food search with smarter variation generation and faster results
 *   ⚡ Implemented connection pool across all APIs to eliminate timeout errors
 *   💾 Smart caching system for improved performance and fresh data
 *   📱 Added PWA features for offline support and faster loading
 *   🔧 Improved mobile Google sign-in experience
 *   ✅ Better food query accuracy with refined AI prompts
 *   🐛 Fixed stale data issues in user profiles
 *   🔐 Enhanced cache invalidation for dynamic data
 * 
 * Version 1.4.1 (Code 11) - 2026-01-06
 *   🐛 Fixed timezone bug causing incorrect date ranges in discipline reports
 *   🔧 Custom date ranges now query correct dates (e.g., Jan 4-5 instead of Jan 3-4)
 *   ✅ Discipline percentages calculate accurately across all date ranges
 * 
 * Version 1.4.0 (Code 10) - 2025-12-29
 *   ✨ Made Discipline Report accessible to all users (not just coaches)
 *   🗑️ Removed debug panel from production app
 *   🔧 Enhanced team hierarchy display with coach performance tracking
 *   🐛 Fixed null safety issues in activity data calculations
 *   📊 Improved discipline report with recursive team queries
 *   🎨 UI/UX improvements across dashboard components
 * 
 * Version 1.3.0 (Code 9) - 2025-11-24
 *   ✨ New features and improvements
 *   🔧 Minor enhancements
 * 
 * Version 1.2.5 (Code 8) - 2025-11-11
 *   🔒 Implemented build-time API key injection for enhanced security
 *   🛡️ Removed hardcoded Gemini API keys from source code
 *   🔧 Updated GalleryMonitorService to use BuildConfig.GEMINI_API_KEY
 *   📝 Added gradle.properties for local API key configuration
 *   🚫 Untracked sensitive files (.env.production, gradle.properties) from Git
 *   📚 Created GEMINI_API_KEY_SETUP.md security documentation
 *   ✅ Build-time injection prevents future key exposure in Git
 * 
 * Version 1.2.4 (Code 7) - 2025-11-03
 *   🔧 Fixed race condition causing "Account Not Found" modal for new Google users
 *   ✅ Set freshGoogleSignIn flag before popup opens (in Login component)
 *   🔐 Enhanced checkUserStatus to skip check during fresh sign-in
 *   🛡️ Handle duplicate username error with unique timestamp suffix
 *   📊 Added comprehensive logging for debugging sign-in flow
 *   ⚡ Graceful error handling with fail-open policy for backend issues
 *   🎯 Verified OTP login flow remains unaffected and safe
 * 
 * Version 1.2.3 (Code 6) - 2025-10-31
 *   🔐 Fixed Google Sign-In for Play Store releases (App Signing Key)
 *   ✅ Added Play Store App Signing SHA-1 to Firebase
 *   🔧 Updated google-services.json with new OAuth clients
 *   🎯 Resolved "User not authenticated" error in signed builds
 *   👤 Added user status check feature with inactive/non-existent user modals
 *   📧 Enhanced email support with pre-filled templates
 * 
 * Version 1.2.1 (Code 4) - 2025-10-29
 *   🔐 Fixed Google Sign-In for signed release builds
 *   🔧 Added SHA-256 certificate configuration
 *   ✨ Enhanced version display with clean UI
 *   🐛 Resolved OAuth authentication issues
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
