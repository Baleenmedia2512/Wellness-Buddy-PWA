/**
 * 🔢 APP VERSION CONFIGURATION
 * 
 * This is the SINGLE SOURCE OF TRUTH for app versioning.
 * Update these values when releasing a new version.
 * 
 * ⚠️ IMPORTANT: After changing version here, also update:
 * 1. frontend/android/app/build.gradle (versionCode & versionName)
 * 2. frontend/ios/App/App/Info.plist (CFBundleShortVersionString & CFBundleVersion)
 *    → Run: cd frontend/ios/App && agvtool new-marketing-version X.X && agvtool new-version -all XX
 * 3. frontend/package.json (version field)
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
  VERSION: '2.7',
  
  // Version code (for Android builds - must match build.gradle)
  // Also used as CFBundleVersion for iOS builds - must match Info.plist
  VERSION_CODE: 33,
  
  // iOS build number (CFBundleVersion in Info.plist) - must match VERSION_CODE
  IOS_BUILD_NUMBER: 31,
  
  // Release name (for Play Store / App Store)
  RELEASE_NAME: 'Version 2.7 Update',
  
  // Build date
  BUILD_DATE: '2026-04-28',
  
  // Platform release notes
  PLATFORMS: {
    ANDROID: { versionCode: 32, versionName: '2.7' },
    IOS: { buildNumber: 31, versionName: '2.7' },
  },
};

/**
 * 📋 CHANGE LOG
 * 
 * Version 2.6 (Code 30) - 2026-04-28 [iOS RELEASE]
 *   🍎 iOS App Store - First iOS build prepared and exported for App Store Connect
 *   📦 ExportOptions-AppStore.plist - Added App Store export configuration for iOS
 *   🔢 iOS Version Sync - iOS version aligned with Android (2.6 / build 30)
 *   🔐 iOS Signing - Automatic signing with Team ID VXAC9D3CKR
 *   🚫 Login UI - Removed "← Back to other options" button from OTP login screen
 *   🗂️ .gitignore - xcarchive and IPA build artifacts excluded from git
 * 
 * Version 2.6 (Code 30) - 2026-04-21
 *   🔥 Firebase Update - Updated Firebase configuration and client IDs for Wellness Valley project
 *   🔐 Auth Improvement - Refreshed Google Sign-In client IDs for improved authentication reliability
 *   📱 Capacitor Config - Updated capacitor configuration to align with new Firebase setup
 *   🔧 Code Quality - Minor code readability improvements across backend API utilities
 *   🐛 Bug Fixes - General stability improvements and minor fixes
 * 
 * Version 2.5 (Code 27) - 2026-04-15
 *   👣 Step Counter - Real-time step tracking with daily goals and progress display
 *   ⏱️ Screen Timer - Monitor and manage daily screen usage time
 *   🔔 Reminder System - Smart reminders for meals, workouts, hydration and wellness activities
 *   📊 Activity Report - Comprehensive activity analytics with trends and insights
 *   🎓 Wellness Valley University - In-app learning hub with wellness courses and educational content
 *   ⌚ Smart Watch Option - Smartwatch integration support for health data sync
 *   📈 Food Graph - Visual charts for food intake tracking over time
 *   ⚖️ Weight Graph - Weight progress graphs with trend analysis
 *   📚 Education Graph - Visual progress tracking for education and learning activities
 *   🔥 Calorie Reduction - Smart calorie reduction suggestions and tracking
 *   ✏️ Edit Option (All) - Full edit capability across all data entries and records
 *   🔍 Missing Item Food Detection - AI-powered detection of missing or incomplete food entries
 *   📋 Attendance Report - Detailed attendance tracking and reporting for teams
 *   🧠 Counselling - In-app wellness counselling and mental health support features
 *   🏥 Medical & Health - Enhanced medical and health tracking features
 *   ➕ Expand & Collapse Option - Collapsible sections across the app for better navigation
 *   🐛 Bug Fixes - Resolved multiple reported bugs across all modules for smoother experience
 *   📱 Responsive Design - Improved responsive layouts across all screens for mobile, tablet and web
 *   🖼️ Logo for All Profiles - Added logo/avatar display across all user, team and club profile sections
 *   🎨 UI Enhancements - Polished UI across all screens with improved visuals, spacing and consistency
 * 
 * Version 2.4 (Code 26) - 2026-03-10
 *   🐛 Fixed timezone issue causing incorrect date calculations
 *   📊 Enhanced Team Dashboard with improved member search functionality
 *   🔍 Added advanced team member filtering and search capabilities
 *   ✨ Improved overall team management experience
 *   🔧 General stability improvements and bug fixes
 * 
 * Version 2.3 (Code 25) - 2026-03-03
 *   🔧 Fixed coach heading - now hidden completely when no coach is assigned
 *   📤 Fixed WhatsApp share functionality in Android app
 *   📄 Enhanced share quality - images now shared as documents to prevent WhatsApp compression
 *   🏆 Fixed Weight Loss Leaderboard alignment issues
 *   ✨ Enhanced overall stability and user experience
 * 
 * Version 2.2 (Code 24) - 2026-02-27
 *   🏆 Weight loss leaderboard strip with real-time tracking
 *   📤 Enhanced WhatsApp share with clear screenshots (no quiz pop-ups)
 *   💾 Updated cache management for improved performance and data freshness
 *   ✨ Enhanced overall stability and user experience
 * 
 * Version 2.1 (Code 23) - 2026-02-26
 *   🍽️ Fixed food editor save functionality
 *   ✨ Users can now update food name without modifying gram values
 *   🔧 Previously, editing a food item required changing the gram value to save
 *   📝 Now any field can be edited independently and saved successfully
 *   ✅ Enhanced user experience for food item management
 * 
 * Version 2.0 (Code 22) - 2026-02-26
 *   🎉 Major version release
 *   📦 Version synchronization across all build files
 *   ✨ Enhanced stability and performance improvements
 * 
 * Version 1.9 (Code 21) - 2026-02-24
 *   📱 WhatsApp share feature implemented for easy content sharing
 *   💾 Enhanced cache management for better performance and data freshness
 *   🎨 UI enhancements across multiple screens for improved user experience
 *   ✏️ Fixed nutrition value editing - protein values now properly update in database
 *   🧹 Removed camera instruction text from main page for cleaner UI
 *   🔧 General stability improvements and bug fixes
 * 
 * Version 1.8 (Code 20) - 2026-02-18
 *   � Made team selection optional for better user flexibility
 *   📤 Added uploading page with help and guidance features
 *   �🔄 Version update and build improvements
 *   📦 Synchronized versions across all package files
 *   ✅ Updated build configurations for new release
 *   🎯 General maintenance and stability improvements
 * 
 * Version 1.7 (Code 19) - 2026-02-13
 *   🍽️ Enhanced food correction system with improved accuracy
 *   🔧 Improved error handling and user feedback mechanisms
 *   🎨 UI/UX refinements for better user experience
 *   ✨ General stability improvements and bug fixes
 * 
 * Version 1.6.5 (Code 18) - 2026-02-04
 *   ✨ Discipline Report UI/UX Improvements
 *   🎨 Redesigned both "All My Team" and "My Direct Team" tabs with flat list view
 *   📊 Fixed member counting to show actual team members (not entire organization)
 *   🔄 Implemented proper sorting by discipline score (highest first)
 *   🔍 Enhanced filtering system working correctly on both tabs
 *   📈 Updated summary statistics (AVG, TOP STAR, AT RISK) to calculate from current view
 *   ✅ Removed hierarchical tree structure for better user experience
 *   🎯 Both tabs now display consistent flat member lists with scores
 * 
 * Version 1.6.4 (Code 17) - 2026-02-04
 *   🔧 Maintenance release with stability improvements
 *   📦 Version synchronization across all build files
 *   ✅ Updated package.json, package-lock.json, and build.gradle
 * 
 * Version 1.6.3 (Code 16) - 2026-02-03
 *   ✨ Android In-App Updates feature
 *   🔄 Enhanced update mechanism for seamless app updates
 *   📱 Improved user experience with automatic update notifications
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
 * Step 2: Update build.gradle (Android)
 *   File: frontend/android/app/build.gradle
 *   Change:
 *     versionCode 3        → versionCode 4 (or next number)
 *     versionName "1.2.0"  → versionName "1.3.0" (or next version)
 * 
 * Step 3: Update iOS Info.plist
 *   Run these commands:
 *     cd frontend/ios/App
 *     agvtool new-marketing-version 1.3.0   (version name)
 *     agvtool new-version -all 4            (build number / version code)
 *   OR manually edit: frontend/ios/App/App/Info.plist
 *     CFBundleShortVersionString → new version name (e.g. 1.3.0)
 *     CFBundleVersion            → new build number (e.g. 4)
 * 
 * Step 4: Update package.json
 *   File: frontend/package.json
 *   Change:
 *     "version": "1.2.0"   → "version": "1.3.0" (or next version)
 * 
 * Step 5: Rebuild
 *   Android: ./gradlew clean bundleRelease
 *   iOS:     npm run build && npx cap copy ios
 *            then archive in Xcode or via xcodebuild
 * 
 * ✅ That's it! The version will automatically appear in the app.
 */

// Helper function to get formatted version string
export const getVersionString = () => {
  return `v ${APP_VERSION.VERSION}`;
};

// Helper function to get full version info
export const getFullVersionInfo = () => {
  return {
    version: APP_VERSION.VERSION,
    versionCode: APP_VERSION.VERSION_CODE,
    iosBuildNumber: APP_VERSION.IOS_BUILD_NUMBER,
    releaseName: APP_VERSION.RELEASE_NAME,
    buildDate: APP_VERSION.BUILD_DATE,
    displayText: getVersionString(),
    platforms: APP_VERSION.PLATFORMS,
  };
};

export default APP_VERSION;
