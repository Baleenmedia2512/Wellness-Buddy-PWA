# 🏞️ Wellness Valley Rebrand - User Stories

**Epic:** Rebrand Wellness Buddy to Wellness Valley and launch on Google Play Store under organizational account

**Sprint Duration:** December 2-4, 2025 (3 days)  
**Testing Period:** December 5-18, 2025 (14 days mandatory)  
**Target Launch:** December 23, 2025

---

## 🎯 Day 1 Stories - December 2, 2025

### WV-001: Apply for Google Play Developer Account ($25)
**Priority:** CRITICAL  
**Story Points:** 1  
**Time Estimate:** 10 minutes  
**Deadline:** December 2, 2025 - 10:00 AM

**As a** solo developer  
**I want to** create and pay for a Google Play organizational developer account  
**So that** I can publish the rebranded app under the new organizational identity

**Acceptance Criteria:**
- [ ] Navigated to https://play.google.com/console/signup
- [ ] Selected "Organization" account type
- [ ] Completed all required organization details
- [ ] Paid $25 one-time registration fee
- [ ] Received confirmation email
- [ ] Account verification process initiated (1-2 day wait)

**Notes:** This MUST be done first thing in Hour 1 to avoid delays. Verification takes 1-2 days.

---

### WV-002: Rebrand App Package, Firebase Setup & Signing Config
**Priority:** CRITICAL  
**Story Points:** 15  
**Time Estimate:** 5-6 hours  
**Deadline:** December 2, 2025 - 6:00 PM

**As a** developer  
**I want to** rebrand the entire codebase from "Wellness Buddy" (com.wellnessbuddy.app) to "Wellness Valley" (com.wellnessvalley.app)  
**So that** the app has complete new branding across all configuration files, Java code, React components, and legal documents

**This story consolidates WV-002 through WV-007 into a single comprehensive code rebrand task.**

---

#### **PART A: Configuration Files & Package ID Changes**

**Files to Update:**
1. `frontend/capacitor.config.js`
   - Change `appId: "com.wellnessbuddy.app"` → `appId: "com.wellnessvalley.app"`
   - Change `appName: "Wellness Buddy"` → `appName: "Wellness Valley"`

2. `frontend/android/app/build.gradle`
   - Change `namespace "com.wellnessbuddy.app"` → `namespace "com.wellnessvalley.app"`
   - Change `applicationId "com.wellnessbuddy.app"` → `applicationId "com.wellnessvalley.app"`

3. `frontend/android/app/src/main/AndroidManifest.xml`
   - Change `package="com.wellnessbuddy.app"` → `package="com.wellnessvalley.app"`
   - Update all intent action strings from `com.wellnessbuddy.app.ACTION_*` → `com.wellnessvalley.app.ACTION_*`
   - Change application label references (lines 25, 43)

4. `frontend/package.json`
   - Change `"name": "wellness-buddy-pwa-frontend"` → `"name": "wellness-valley-pwa-frontend"`

5. `backend/package.json`
   - Change `"name": "wellness-buddy-pwa-backend"` → `"name": "wellness-valley-pwa-backend"`

6. `frontend/public/index.html`
   - Change `<title>Wellness Buddy PWA</title>` → `<title>Wellness Valley PWA</title>`

---

#### **PART B: Java Package Restructuring**

**Step 1: Create New Directory Structure**
```powershell
# Navigate to Java source directory
cd d:\Xampp\htdocs\Wellness-Buddy-PWA\frontend\android\app\src\main\java

# Create new package directory
New-Item -ItemType Directory -Path "com\wellnessvalley\app" -Force
New-Item -ItemType Directory -Path "com\wellnessvalley\app\plugins" -Force
New-Item -ItemType Directory -Path "com\wellnessvalley\app\services" -Force
```

**Step 2: Move All Java Files**
```powershell
# Move main activity
Move-Item "com\wellnessbuddy\app\MainActivity.java" "com\wellnessvalley\app\"

# Move plugins
Move-Item "com\wellnessbuddy\app\plugins\*.java" "com\wellnessvalley\app\plugins\"

# Move services
Move-Item "com\wellnessbuddy\app\services\*.java" "com\wellnessvalley\app\services\"

# Delete old directory structure
Remove-Item "com\wellnessbuddy" -Recurse -Force
```

**Step 3: Update Package Declarations in All Java Files (15 files total)**

Update the first line of each file:
```java
// OLD: package com.wellnessbuddy.app;
// NEW: package com.wellnessvalley.app;

// OLD: package com.wellnessbuddy.app.plugins;
// NEW: package com.wellnessvalley.app.plugins;

// OLD: package com.wellnessbuddy.app.services;
// NEW: package com.wellnessvalley.app.services;
```

**Files requiring package declaration updates:**
- `MainActivity.java`
- `plugins/GalleryMonitorPlugin.java`
- `plugins/FoodImageAnalysisPlugin.java`
- `services/BackgroundService.java`
- `services/BootReceiver.java`
- `services/FoodAnalysisWorker.java`
- `services/GalleryMonitorService.java`
- `services/HeartbeatScheduler.java`
- `services/NetworkChangeReceiver.java`
- `services/NotificationHelper.java`
- `services/ServiceRestarter.java`
- `services/UserStatusChecker.java`
- All other Java files in the project

**Also update import statements in any file that imports the old package:**
```java
// OLD: import com.wellnessbuddy.app.services.*;
// NEW: import com.wellnessvalley.app.services.*;
```

---

#### **PART C: Android Resource Files**

**File: `frontend/android/app/src/main/res/values/strings.xml`**
```xml
<!-- OLD -->
<string name="app_name">Wellness Buddy</string>
<string name="title_activity_main">Wellness Buddy</string>

<!-- NEW -->
<string name="app_name">Wellness Valley</string>
<string name="title_activity_main">Wellness Valley</string>
```

---

#### **PART D: React Components - Display Name Updates (15 files)**

Replace all instances of "Wellness Buddy" with "Wellness Valley" in these files:

1. **`frontend/src/components/Login.js`**
   - Login screen title/header text

2. **`frontend/src/components/Header.js`**
   - App header branding text

3. **`frontend/src/components/LoadingSpinner.js`**
   - Loading screen text (2 instances)

4. **`frontend/src/components/InactiveUserModal.js`**
   - Email subject line: "Wellness Buddy - Account Inactive" → "Wellness Valley - Account Inactive"
   - Email body text (3 instances total)

5. **`frontend/src/components/UserNotFoundModal.js`**
   - Email subject line
   - Email body text (3 instances total)

6. **`frontend/src/components/PrivacyPolicy.js`**
   - Policy header and content references

7. **`frontend/src/components/TermsAndConditions.js`**
   - Terms header and all body references (10+ instances)

8. **`frontend/src/components/PrivacyPage.js`**
   - Page title and content (3 instances)

9. **`frontend/src/components/TermsPage.js`**
   - Page title and content (3 instances)

10. **Any other React component files with "Wellness Buddy" text**

---

#### **PART E: Legal & Backend Documents**

**Files to Update:**
1. `privacy-policy.html` - Replace all "Wellness Buddy" references
2. `backend/public/privacy-policy.html` - Replace all references
3. `backend/pages/privacy-policy.js` - Update component text
4. `backend/pages/delete-account.js` - Update email templates (3 instances)

---

#### **PART F: Verification Checklist**

After completing all changes above:

- [ ] **Search entire codebase** for "wellnessbuddy" (case-insensitive) - should find ZERO results except in:
  - Git history
  - Documentation files (README, guides)
  - Keystore alias name (keep as-is)
  
- [ ] **Search entire codebase** for "Wellness Buddy" - should find ZERO results in active code

- [ ] **Verify npm scripts work:**
  ```powershell
  cd d:\Xampp\htdocs\Wellness-Buddy-PWA\frontend
  npm install  # Should complete without errors
  npm run build  # Should build successfully
  ```

- [ ] **Verify Android build compiles:**
  ```powershell
  cd d:\Xampp\htdocs\Wellness-Buddy-PWA\frontend
  npx cap sync android
  cd android
  .\gradlew.bat clean
  .\gradlew.bat assembleDebug  # Should compile without errors
  ```

- [ ] **No compilation errors** in Java files
- [ ] **No import errors** or unresolved references
- [ ] **All package references** updated consistently

---

#### **Quick Reference: Search & Replace Commands**

Use your IDE's global search & replace (Ctrl+Shift+H in VS Code):

1. **Package ID in code files:**
   - Find: `com.wellnessbuddy.app`
   - Replace: `com.wellnessvalley.app`
   - Files: `*.js, *.java, *.xml, *.gradle, *.json`

2. **Display name in UI/content:**
   - Find: `Wellness Buddy`
   - Replace: `Wellness Valley`
   - Files: `*.js, *.jsx, *.html, *.xml`

3. **Package name in npm configs:**
   - Find: `wellness-buddy-pwa`
   - Replace: `wellness-valley-pwa`
   - Files: `package.json`

---

**Definition of Done:**
- [ ] All 200+ code locations updated with new package ID and name
- [ ] Java package structure completely reorganized
- [ ] All configuration files updated
- [ ] All React components show "Wellness Valley"
- [ ] All legal documents updated
- [ ] No compilation errors
- [ ] Build succeeds: `npm run build` ✅
- [ ] Android build succeeds: `gradlew assembleDebug` ✅
- [ ] Global search for "wellnessbuddy" returns zero results (except docs/history)
- [ ] Global search for "Wellness Buddy" returns zero results in active code
- [ ] All changes committed to git with message: "Complete rebrand to Wellness Valley - Package ID and display name changes"

---

### WV-003: Rename App Signing Keystore File
**Priority:** HIGH  
**Story Points:** 1  
**Time Estimate:** 5 minutes  
**Deadline:** December 2, 2025 - 6:30 PM

**As a** developer  
**I want to** rename the app signing keystore file  
**So that** it matches the new app name

**Acceptance Criteria:**
- [ ] Navigated to `frontend/android/` directory
- [ ] Renamed `wellness-buddy-keystore.jks` to `wellness-valley-keystore.jks`
- [ ] Updated `build.gradle` signing config to reference new filename
- [ ] Verified keystore alias remains `wellness-buddy` (no need to change)
- [ ] Verified passwords remain unchanged
- [ ] Backup of keystore file created and stored securely

**Command:**
```powershell
cd d:\Xampp\htdocs\Wellness-Buddy-PWA\frontend\android
ren wellness-buddy-keystore.jks wellness-valley-keystore.jks
```

---

### WV-004: Add Wellness Valley to Firebase & Download google-services.json
**Priority:** HIGH  
**Story Points:** 2  
**Time Estimate:** 20 minutes  
**Deadline:** December 2, 2025 - 7:00 PM

**As a** developer  
**I want to** add a new Android app configuration in Firebase  
**So that** the rebranded app can use Firebase services with the new package ID

**Acceptance Criteria:**
- [ ] Logged into Firebase Console (https://console.firebase.google.com/)
- [ ] Opened existing project `wellness-buddy-5de14`
- [ ] Clicked "Add app" and selected Android
- [ ] Entered package name: `com.wellnessvalley.app`
- [ ] Set nickname: "Wellness Valley"
- [ ] Retrieved SHA-1 fingerprint from keystore using keytool command
- [ ] Added SHA-1 certificate fingerprint to Firebase app
- [ ] Downloaded new `google-services.json` file
- [ ] Replaced old `google-services.json` in `frontend/android/app/`
- [ ] Verified Firebase auto-created new OAuth client in Google Cloud Console
- [ ] Verified OAuth client references new package name

**Command to get SHA-1:**
```powershell
cd d:\Xampp\htdocs\Wellness-Buddy-PWA\frontend\android
keytool -list -v -keystore wellness-valley-keystore.jks -alias wellness-buddy
```

---

## 🎨 Day 2 Stories - December 3, 2025

### WV-010: Design Feature Graphic (1024x500) with Canva AI
**Priority:** HIGH  
**Story Points:** 3  
**Time Estimate:** 1.5 hours  
**Deadline:** December 3, 2025 - 11:00 AM

**As a** Play Store visitor  
**I want to** see an attractive feature graphic with "Wellness Valley" branding  
**So that** I'm enticed to learn more about the app

**Acceptance Criteria:**
- [ ] Created new Canva project with dimensions 1024x500px
- [ ] Used Canva AI/Magic Design to generate wellness-themed graphic
- [ ] Incorporated "Wellness Valley" text prominently
- [ ] Included tagline: "AI-Powered Nutrition Tracking" or similar
- [ ] Used health/wellness color scheme (teal, green gradients)
- [ ] Included visual elements: food, phone mockup, AI icons
- [ ] Exported as high-quality PNG or JPG
- [ ] File size under 1MB
- [ ] Looks professional and significantly different from old graphic
- [ ] Saved to `play-store-assets/graphics/` directory

**Design Requirements:**
- Dimensions: Exactly 1024x500px
- Format: PNG or JPG
- Content: "Wellness Valley" branding, health imagery
- Style: Modern, professional, Play Store optimized

---

### WV-011: Create/Update App Icon (512x512) for New Brand
**Priority:** MEDIUM  
**Story Points:** 2  
**Time Estimate:** 1 hour  
**Deadline:** December 3, 2025 - 12:30 PM

**As a** user  
**I want to** see a refreshed app icon on my device  
**So that** the icon reflects the Wellness Valley brand

**Acceptance Criteria:**
- [ ] Assessed if current icon contains "Wellness Buddy" text (if yes, must update)
- [ ] Created/updated icon design (512x512px master)
- [ ] Generated all required sizes (48, 72, 96, 128, 192, 256, 512px)
- [ ] Exported in PNG and WebP formats
- [ ] Updated icons in `frontend/icons/` directory
- [ ] Updated Android mipmap resources if needed
- [ ] Built app and verified new icon appears on device
- [ ] Icon is recognizable at all sizes

**Note:** Skip if current icon is text-free and reusable

---

### WV-012: Capture 4-8 Screenshots (1080x1920) for Play Store
**Priority:** HIGH  
**Story Points:** 3  
**Time Estimate:** 1.5 hours  
**Deadline:** December 3, 2025 - 2:30 PM

**As a** Play Store visitor  
**I want to** see representative screenshots of Wellness Valley's features  
**So that** I understand what the app does before downloading

**Acceptance Criteria:**
- [ ] Built and installed app on Android device or emulator
- [ ] Captured screenshot: Login/welcome screen
- [ ] Captured screenshot: Camera/food photo capture interface
- [ ] Captured screenshot: AI analysis results screen
- [ ] Captured screenshot: Nutrition dashboard/history
- [ ] Captured screenshot: Additional feature screens (4-8 total)
- [ ] All screenshots show "Wellness Valley" branding
- [ ] Screenshots are 1080x1920px minimum (phone portrait)
- [ ] Cropped/edited for professional appearance
- [ ] No debug information or personal data visible
- [ ] Saved to `play-store-assets/screenshots/` directory
- [ ] Screenshots look different enough from old app to avoid duplicate detection

**Requirements:**
- Minimum: 4 screenshots
- Recommended: 8 screenshots
- Format: PNG or JPG
- Dimensions: 1080x1920px (phone) or larger

---

### WV-013: Update Privacy Policy & Terms Documents
**Priority:** MEDIUM  
**Story Points:** 2  
**Time Estimate:** 30 minutes  
**Deadline:** December 3, 2025 - 3:00 PM

**As a** user  
**I want to** read accurate privacy and terms documents for Wellness Valley  
**So that** I understand my rights and the app's policies

**Acceptance Criteria:**
- [ ] Updated `privacy-policy.html` - all instances of "Wellness Buddy" changed
- [ ] Updated `backend/pages/privacy-policy.js` - references updated
- [ ] Updated `backend/pages/delete-account.js` - email templates updated (3 instances)
- [ ] Updated Terms & Conditions components with new name
- [ ] Verified privacy policy URL is accessible
- [ ] Verified legal text is accurate and complete
- [ ] No references to old app name remain

**Files Affected:**
- `privacy-policy.html`
- `backend/public/privacy-policy.html`
- `backend/pages/privacy-policy.js`
- `backend/pages/delete-account.js`

---

### WV-014: Build Signed Release Bundle (AAB)
**Priority:** CRITICAL  
**Story Points:** 2  
**Time Estimate:** 1 hour  
**Deadline:** December 3, 2025 - 5:00 PM

**As a** developer  
**I want to** create a signed release bundle  
**So that** I can upload the app to the Play Store

**Acceptance Criteria:**
- [ ] Executed clean build: `npm run android:clean`
- [ ] Built web assets: `npm run build`
- [ ] Synced with Capacitor: `npx cap sync android`
- [ ] Navigated to `android/` directory
- [ ] Executed: `.\gradlew.bat bundleRelease`
- [ ] Bundle created successfully at `android/app/build/outputs/bundle/release/app-release.aab`
- [ ] Bundle is signed with wellness-valley-keystore.jks
- [ ] Bundle size is reasonable (under 100MB)
- [ ] No build errors or warnings (critical ones)
- [ ] Version code incremented appropriately

**Commands:**
```powershell
cd d:\Xampp\htdocs\Wellness-Buddy-PWA\frontend
npm run build
npx cap sync android
cd android
.\gradlew.bat bundleRelease
```

---

### WV-015: Test All Features on Physical Android Device
**Priority:** CRITICAL  
**Story Points:** 5  
**Time Estimate:** 2-3 hours  
**Deadline:** December 3, 2025 - 8:00 PM

**As a** developer  
**I want to** thoroughly test all app features on a physical device  
**So that** I ensure the rebranded app works correctly before submission

**Acceptance Criteria:**
- [ ] Installed AAB on test device via Play Console or converted to APK
- [ ] App name displays as "Wellness Valley" in launcher
- [ ] App name displays correctly in app switcher
- [ ] Google Sign-In works successfully
- [ ] Camera permission requested and works
- [ ] Gallery access permission works
- [ ] Can capture food photo successfully
- [ ] AI analysis returns nutrition results
- [ ] Background service starts and runs
- [ ] Notifications appear when expected
- [ ] App data syncs to backend
- [ ] No crashes during normal usage flow
- [ ] Privacy policy link works
- [ ] Terms & conditions link works
- [ ] Delete account flow works
- [ ] All "Wellness Valley" branding displays correctly
- [ ] No "Wellness Buddy" text visible anywhere
- [ ] Tested on Android 11+ device
- [ ] Tested on Android 13+ device (if available)

**Critical Test Flows:**
1. Install → Sign In → Take Photo → View Analysis
2. Background service monitoring
3. User account management

---

### WV-016: Fix Critical Bugs (If Any Found)
**Priority:** CRITICAL  
**Story Points:** Variable (3-8)  
**Time Estimate:** 1-3 hours  
**Deadline:** December 3, 2025 - 11:59 PM

**As a** developer  
**I want to** fix any critical bugs discovered during testing  
**So that** the app is stable for closed testing

**Acceptance Criteria:**
- [ ] All critical bugs identified and logged
- [ ] Each bug fixed in code
- [ ] Fixes tested and verified
- [ ] New AAB built with fixes
- [ ] Regression testing completed
- [ ] No new bugs introduced by fixes
- [ ] App passes all test criteria from WV-015

**Definition of Critical Bug:**
- App crashes
- Core features don't work
- Google Sign-In fails
- Data loss occurs
- Security vulnerabilities

**Note:** If no critical bugs found, this story can be skipped

---

## 📱 Day 3 Stories - December 4, 2025

### WV-017: Create Play Store Listing (App Name, Description, Graphics)
**Priority:** HIGH  
**Story Points:** 3  
**Time Estimate:** 1 hour  
**Deadline:** December 4, 2025 - 11:00 AM

**As a** Play Store administrator  
**I want to** create a complete app listing for Wellness Valley  
**So that** users can discover and learn about the app

**Acceptance Criteria:**
- [ ] Logged into Google Play Console (account should be verified by now)
- [ ] Clicked "Create app"
- [ ] Selected "App" (not Game)
- [ ] Selected "Free" (not Paid)
- [ ] Entered app name: "Wellness Valley"
- [ ] Selected default language: English (US)
- [ ] Completed app details form
- [ ] Entered short description (80 chars): "AI nutrition tracker - Snap food photos, get instant health insights! 🥗📸"
- [ ] Entered full description (copied from store-listing-text.txt with "Wellness Valley" branding)
- [ ] Uploaded app icon (512x512px)
- [ ] Uploaded feature graphic (1024x500px)
- [ ] Uploaded 4-8 phone screenshots
- [ ] Set category: Health & Fitness
- [ ] Added tags: nutrition, health, fitness, AI, wellness, food tracking
- [ ] Entered contact email: easy2work.india@gmail.com
- [ ] Entered privacy policy URL
- [ ] Saved as draft

**Store Listing Text Template:**
```
🥗 WELLNESS VALLEY - Your AI-Powered Nutrition Companion

Transform your health journey with intelligent food tracking and personalized nutrition insights!

🔥 KEY FEATURES:
• 📸 Smart Food Recognition
• 🧠 AI-Powered Insights
• 📊 Comprehensive Tracking
• 🎯 Goal Setting
• 🔒 Privacy First

Download Wellness Valley today! 🌟
```

---

### WV-018: Fill Content Rating Questionnaire (ESRB/PEGI)
**Priority:** HIGH  
**Story Points:** 2  
**Time Estimate:** 30 minutes  
**Deadline:** December 4, 2025 - 12:00 PM

**As a** Play Store administrator  
**I want to** complete the content rating questionnaire accurately  
**So that** the app receives the appropriate age rating

**Acceptance Criteria:**
- [ ] Navigated to "Content rating" section in Play Console
- [ ] Started new questionnaire
- [ ] Selected category: Health & Fitness
- [ ] Answered all questions accurately:
  - Violence: None
  - Sexual content: None
  - Language: None
  - Controlled substances: None
  - User interaction: Yes (photo uploads)
  - Data collection: Yes (nutrition data, photos)
- [ ] Provided data collection details
- [ ] Submitted questionnaire
- [ ] Received rating certificate
- [ ] Rating is "Everyone" or "PEGI 3" (expected)
- [ ] Certificate attached to app listing

---

### WV-019: Upload AAB to Closed Testing Track
**Priority:** CRITICAL  
**Story Points:** 2  
**Time Estimate:** 30 minutes  
**Deadline:** December 4, 2025 - 1:00 PM

**As a** developer  
**I want to** upload the AAB to the Closed Testing track  
**So that** I can begin the mandatory 14-day testing period

**Acceptance Criteria:**
- [ ] Navigated to "Closed testing" in Play Console
- [ ] Created new closed testing release
- [ ] Uploaded `app-release.aab` file
- [ ] Upload completed successfully (no errors)
- [ ] Entered release name: "1.0.0" or "1.2.5" (continuing version)
- [ ] Entered release notes:
  ```
  🎉 Welcome to Wellness Valley v1.0!
  
  🥗 AI-powered nutrition tracking
  📸 Smart food photo analysis
  📊 Comprehensive health insights
  🔒 Privacy-focused design
  
  Start your wellness journey today!
  ```
- [ ] Saved release (not yet published)
- [ ] Verified AAB integrity check passed
- [ ] No security warnings or critical issues flagged

---

### WV-020: Invite 20 Testers to Closed Testing Program
**Priority:** CRITICAL  
**Story Points:** 3  
**Time Estimate:** 1 hour  
**Deadline:** December 4, 2025 - 3:00 PM

**As a** developer  
**I want to** invite 20 testers to the closed testing program  
**So that** I meet Google's mandatory testing requirements

**Acceptance Criteria:**
- [ ] Created email list with 20 email addresses
- [ ] List includes mix of:
  - Friends (5-8 people)
  - Family members (5-8 people)
  - Colleagues (if available)
  - Own Gmail accounts (2-3 if needed)
- [ ] Added all emails to closed testing tester list in Play Console
- [ ] Published closed testing release
- [ ] Testers received invitation emails
- [ ] At least 20 testers confirmed access
- [ ] Shared testing link with all testers
- [ ] Provided instructions to testers:
  - Install app
  - Use it normally for 14 days
  - Report any bugs/feedback
- [ ] Set up feedback monitoring channel (email/group chat)
- [ ] Testing period officially started: December 5, 2025

**Tester Requirements:**
- Must have Google account
- Must accept Play Store tester agreement
- Should use app at least 2-3 times during 14 days

---

### WV-021: Update Store Assets Documentation & README
**Priority:** LOW  
**Story Points:** 1  
**Time Estimate:** 15 minutes  
**Deadline:** December 4, 2025 - 5:00 PM

**As a** team member  
**I want to** update the store assets documentation  
**So that** there's a record of the new graphics and text

**Acceptance Criteria:**
- [ ] Updated `play-store-assets/store-listing-text.txt` with "Wellness Valley" text
- [ ] Updated `play-store-assets/canva-ai-prompts.md` with new prompts used
- [ ] Updated `play-store-assets/README.md` with latest asset information
- [ ] Documented graphic file locations
- [ ] Committed changes to git repository

---

## 🧪 Testing Period Stories - December 5-18, 2025

### WV-022: Monitor Daily Testing Feedback & Crash Reports
**Priority:** MEDIUM  
**Story Points:** 2  
**Time Estimate:** 30 min/day for 14 days  
**Deadline:** December 5-18, 2025 - Daily at 10:00 AM

**As a** developer  
**I want to** monitor tester feedback and crash reports daily  
**So that** I can identify and address issues before production release

**Acceptance Criteria:**
- [ ] Checked Play Console pre-launch reports daily
- [ ] Monitored crash reports (should be zero)
- [ ] Reviewed tester feedback emails
- [ ] Tracked tester engagement (how many are active)
- [ ] Documented all reported issues
- [ ] Categorized issues: Critical, High, Medium, Low
- [ ] Communicated with testers about issues
- [ ] Created plan to address critical issues if any found
- [ ] Ensured minimum 12 testers remain active throughout period
- [ ] No critical bugs that would reset testing period

**Daily Checklist:**
- Check Play Console → Closed Testing → Feedback
- Check email for tester comments
- Review crash/ANR reports
- Note active tester count

---

### WV-023: Address Non-Critical Bugs (Optional - Resets Timer!)
**Priority:** LOW  
**Story Points:** Variable (2-5)  
**Time Estimate:** Variable  
**Deadline:** December 18, 2025 - 11:59 PM (Before testing ends)

**As a** developer  
**I want to** fix minor bugs found during testing  
**So that** the production release is as polished as possible

**Acceptance Criteria:**
- [ ] Only non-critical bugs addressed
- [ ] Understood that app update RESETS 14-day timer
- [ ] Evaluated if fix is worth resetting testing period
- [ ] If updating: Built new AAB and uploaded to closed testing
- [ ] If updating: Extended timeline by 14 days from update date
- [ ] If not updating: Documented bugs to fix post-launch

**⚠️ WARNING:** Updating app during testing restarts the 14-day countdown!

**Decision Matrix:**
- Critical security issue → Update immediately
- Major feature broken → Update immediately
- Minor UI bug → Wait until post-launch
- Enhancement → Wait until post-launch

---

## 🚀 Production Release Stories - December 19, 2025

### WV-024: Promote Release from Testing to Production
**Priority:** CRITICAL  
**Story Points:** 1  
**Time Estimate:** 15 minutes  
**Deadline:** December 19, 2025 - 10:00 AM

**As a** developer  
**I want to** promote the app from closed testing to production  
**So that** it can be reviewed and launched publicly

**Acceptance Criteria:**
- [ ] Verified 14 full days of testing completed (Dec 5-18)
- [ ] Verified no critical bugs reported
- [ ] Logged into Play Console
- [ ] Navigated to Closed Testing release
- [ ] Clicked "Promote to Production"
- [ ] Confirmed promotion
- [ ] Release moved to Production track (in review)
- [ ] Promotion confirmation email received

---

### WV-025: Write Production Release Notes & What's New
**Priority:** HIGH  
**Story Points:** 1  
**Time Estimate:** 15 minutes  
**Deadline:** December 19, 2025 - 10:30 AM

**As a** user  
**I want to** read about what's new in Wellness Valley  
**So that** I understand the app's features before downloading

**Acceptance Criteria:**
- [ ] Opened production release editor
- [ ] Entered release notes:
  ```
  🎉 Introducing Wellness Valley - Your AI Nutrition Companion!
  
  ✨ FEATURES:
  • 📸 Instant food recognition from photos
  • 🧠 AI-powered nutrition analysis
  • 📊 Track calories, macros, vitamins & minerals
  • 🎯 Set and achieve health goals
  • 🔒 Privacy-first design
  • 📱 Works offline
  
  Transform your health journey with smart nutrition tracking!
  
  Download now and start your wellness journey! 🌟
  ```
- [ ] Release notes are clear, engaging, and accurate
- [ ] No references to "Wellness Buddy"
- [ ] Saved production release
- [ ] Ready for submission

---

### WV-026: Submit App to Google for Production Review
**Priority:** CRITICAL  
**Story Points:** 1  
**Time Estimate:** 5 minutes  
**Deadline:** December 19, 2025 - 11:00 AM

**As a** developer  
**I want to** submit the app for Google's production review  
**So that** it can go live on the Play Store

**Acceptance Criteria:**
- [ ] Reviewed all production release details
- [ ] Verified all required fields completed:
  - Store listing
  - Content rating
  - App content declarations
  - Pricing & distribution
  - Production release AAB
- [ ] Clicked "Submit for review"
- [ ] Received submission confirmation
- [ ] Submission email received from Google
- [ ] Status shows "In review" in Play Console
- [ ] Monitoring email for review updates

**Expected Review Time:** 2-3 days (Dec 20-22)

---

## 🎉 Post-Submission Stories - December 20-23, 2025

### WV-027: Monitor Google Review Status (2-3 Days)
**Priority:** MEDIUM  
**Story Points:** 1  
**Time Estimate:** 10 min/day for 3 days  
**Deadline:** December 20-22, 2025 - Daily at 10:00 AM

**As a** developer  
**I want to** monitor the production review status daily  
**So that** I can respond quickly to any issues or approval

**Acceptance Criteria:**
- [ ] Checked Play Console status daily
- [ ] Monitored email for Google communications
- [ ] Responded to any review questions within 24 hours
- [ ] If rejected: Reviewed rejection reasons
- [ ] If rejected: Fixed issues and resubmitted
- [ ] If approved: Verified app is live on Play Store
- [ ] If approved: Tested download and installation as end user

**Possible Outcomes:**
- ✅ Approved → App goes live
- ⚠️ Needs changes → Fix and resubmit (adds 1-2 days)
- ❌ Rejected → Address serious issues (adds 3-7 days)

---

### WV-028: Verify App is Live & Available on Play Store
**Priority:** CRITICAL  
**Story Points:** 2  
**Time Estimate:** 30 minutes  
**Deadline:** December 23, 2025 - 12:00 PM (Launch Day)

**As a** developer  
**I want to** confirm the app is publicly available on the Play Store  
**So that** users can discover and download Wellness Valley

**Acceptance Criteria:**
- [ ] Received "App Published" email from Google
- [ ] Searched for "Wellness Valley" on Play Store
- [ ] App appears in search results
- [ ] App listing shows correct information:
  - Name: Wellness Valley
  - Icon: New icon
  - Feature graphic: New graphic
  - Screenshots: All correct
  - Description: Wellness Valley text
  - Rating: Everyone (or equivalent)
- [ ] Downloaded app on personal device
- [ ] Installed successfully
- [ ] App runs without errors
- [ ] Signed in successfully
- [ ] All features work in production
- [ ] Shared Play Store link with stakeholders
- [ ] Announced launch to testers/team

**Play Store URL Format:**
`https://play.google.com/store/apps/details?id=com.wellnessvalley.app`

---

### WV-029: Set Up Analytics & Crash Monitoring
**Priority:** MEDIUM  
**Story Points:** 2  
**Time Estimate:** 1 hour  
**Deadline:** December 23, 2025 - 5:00 PM

**As a** developer  
**I want to** set up monitoring for the live app  
**So that** I can track downloads, crashes, and user feedback

**Acceptance Criteria:**
- [ ] Configured Play Console notifications for:
  - New reviews/ratings
  - Crash reports
  - ANR reports
  - Security alerts
- [ ] Set up Firebase Analytics monitoring
- [ ] Configured crash reporting (Firebase Crashlytics)
- [ ] Created dashboard for key metrics:
  - Daily installs
  - Active users
  - Crash-free rate
  - Average rating
- [ ] Set up alerts for critical issues
- [ ] Documented monitoring process
- [ ] Scheduled weekly review of metrics

---

### WV-030: Update Project Documentation & Close Sprint 🎉
**Priority:** LOW  
**Story Points:** 1  
**Time Estimate:** 30 minutes  
**Deadline:** December 24, 2025 - 12:00 PM

**As a** team member  
**I want to** update project documentation with final status  
**So that** there's a complete record of the rebrand project

**Acceptance Criteria:**
- [ ] Updated `REBRAND_EXECUTIVE_SUMMARY.md` with actual dates
- [ ] Marked all checklist items as complete
- [ ] Documented actual time spent vs estimates
- [ ] Documented lessons learned
- [ ] Updated repository README if needed
- [ ] Committed all final changes to git
- [ ] Tagged release: `v1.0.0-wellness-valley`
- [ ] Archived rebrand documentation for future reference
- [ ] Celebrated successful launch! 🎉

---

## 📊 Story Summary

**Total Stories:** 30  
**Total Story Points:** 67  
**Total Estimated Time:** 12-17 hours active work + 14 days testing + 2-3 days review

### By Priority:
- **CRITICAL:** 7 stories (account, build, testing setup, submission)
- **HIGH:** 13 stories (code changes, graphics, testing)
- **MEDIUM:** 7 stories (documentation, monitoring)
- **LOW:** 3 stories (optional improvements)

### By Day:
- **Day 1 (Dec 2):** 9 stories, ~6-8 hours
- **Day 2 (Dec 3):** 7 stories, ~7-8 hours  
- **Day 3 (Dec 4):** 5 stories, ~3-4 hours
- **Testing (Dec 5-18):** 2 stories, ~30 min/day
- **Production (Dec 19):** 3 stories, ~30 min
- **Post-Launch (Dec 20-23):** 4 stories, ~2 hours total

---

## 🎯 Definition of Done

A story is considered "Done" when:
- [ ] All acceptance criteria are met
- [ ] Code changes committed to git (if applicable)
- [ ] Testing completed successfully
- [ ] No critical bugs introduced
- [ ] Documentation updated (if applicable)
- [ ] Stakeholder/self approval received

---

**Epic Status:** 🔴 Not Started  
**Target Completion:** December 23, 2025  
**Last Updated:** December 2, 2025
