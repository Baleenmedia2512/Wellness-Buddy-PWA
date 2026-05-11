# Wellness Buddy PWA — Complete Folder Structure

**Branch:** current (live production, pre-VSA)
**Generated:** 2026-05-11
**Excluded from tree:** `node_modules/`, `.next/`, `.git/`, `build/`, `dist/`, `android/`, `ios/`, `.vercel/`

---

## Backend

```
backend/
├── migrations/
│   ├── add_city_village_fields.sql
│   ├── fix_coach_team_id_foreign_key.sql
│   └── wellness_counselling_assessments.sql
├── pages/
│   ├── api/
│   │   ├── admin/
│   │   │   ├── all-members-discipline.js
│   │   │   └── time-windows.js
│   │   ├── coach/
│   │   │   ├── attendance-report.js
│   │   │   ├── club-attendance-report.js
│   │   │   ├── discipline-report.js
│   │   │   ├── download-attendance-excel.js
│   │   │   ├── hierarchical-club-attendance.js
│   │   │   ├── hierarchical-clubs-overview.js
│   │   │   ├── team-hierarchy.js
│   │   │   └── team-steps.js
│   │   ├── counselling/
│   │   │   ├── get-assessments.js
│   │   │   ├── hierarchical-assessments.js
│   │   │   └── save-assessment.js
│   │   ├── debug/
│   │   │   └── verify-team-structure.js
│   │   ├── leaderboard/
│   │   │   ├── get-discipline-leaderboard.js
│   │   │   └── get-global-leaderboard.js
│   │   ├── team/
│   │   │   ├── check-availability.js
│   │   │   └── claim-id.js
│   │   ├── upline/
│   │   │   ├── cancel-request.js
│   │   │   ├── request.js
│   │   │   └── validate-otp.js
│   │   ├── user/
│   │   │   ├── skip-setup.js
│   │   │   └── status.js
│   │   ├── users/
│   │   │   └── search.js
│   │   ├── wellness-university/
│   │   │   ├── enroll.js
│   │   │   ├── get-enrollments.js
│   │   │   └── update-enrollment.js
│   │   ├── check-center-name.js
│   │   ├── delete-background-analysis.js
│   │   ├── delete-education-log.js
│   │   ├── delete-user-account.js
│   │   ├── delete-weight-entry.js
│   │   ├── detect-face.js
│   │   ├── get-activity-time-report.js
│   │   ├── get-background-analysis.js
│   │   ├── get-daily-activity.js
│   │   ├── get-education-log-image.js
│   │   ├── get-education-logs.js
│   │   ├── get-education-summary.js
│   │   ├── get-food-corrections.js
│   │   ├── get-global-corrections.js
│   │   ├── get-latest-token-costs.js
│   │   ├── get-my-club-attendance.js
│   │   ├── get-nutrition-centers.js
│   │   ├── get-screen-time.js
│   │   ├── get-time-windows.js
│   │   ├── get-token-correction.js
│   │   ├── get-token-pricing.js
│   │   ├── get-token-usage.js
│   │   ├── get-user-context.js
│   │   ├── get-user-profile.js
│   │   ├── get-watch-burned-calories.js
│   │   ├── get-water-intake.js
│   │   ├── get-weight-history.js
│   │   ├── lookup-user-id.js
│   │   ├── register-nutrition-center.js
│   │   ├── reset-sequences.js
│   │   ├── reverse-lookup-correction.js
│   │   ├── save-background-analysis.js
│   │   ├── save-daily-activity.js
│   │   ├── save-education-log.js
│   │   ├── save-food-correction.js
│   │   ├── save-google-user.js
│   │   ├── save-screen-time.js
│   │   ├── save-token-correction.js
│   │   ├── save-token-usage.js
│   │   ├── save-weight-entry.js
│   │   ├── search-food-history.js
│   │   ├── send-otp.js
│   │   ├── server-time.js
│   │   ├── service-health.js
│   │   ├── snooze-profile-pic.js
│   │   ├── test-db.js
│   │   ├── test-db-connection.js
│   │   ├── undo-deleted-analysis.js
│   │   ├── undo-deleted-education-log.js
│   │   ├── undo-deleted-weight-entry.js
│   │   ├── unregister-nutrition-center.js
│   │   ├── update-nutrition-analysis.js
│   │   ├── update-user-profile.js
│   │   ├── user-nutrition-stats.js
│   │   └── verify-otp.js
│   ├── delete-account.js
│   └── privacy-policy.js
├── public/
│   └── privacy-policy.html
├── utils/
│   ├── apiConfig.js
│   ├── cache.js
│   ├── columnMapping.js
│   ├── dbPool.js
│   ├── disciplineCalculations.js
│   ├── disciplineCalculationsSupabase.js
│   ├── disciplineHelpers.js
│   ├── foodTypeDetection.js
│   ├── HIERARCHY_HELPERS_GUIDE.md
│   ├── hierarchyHelpers.js
│   ├── supabaseClient.js
│   ├── teamAttendanceHelpers.js
│   ├── teamHierarchyBuilder.js
│   ├── timeReportHelpers.js
│   ├── timestampUtils.js
│   ├── timezoneConverter.js
│   └── weightValidation.js
├── .env
├── .gitignore
├── deployment-report.json
├── next.config.js
├── package.json
├── package-lock.json
└── vercel.json
```

### Backend Counts

| Folder | Files |
|---|---:|
| `migrations/` | 3 |
| `pages/api/` (root) | 57 |
| `pages/api/admin/` | 2 |
| `pages/api/coach/` | 8 |
| `pages/api/counselling/` | 3 |
| `pages/api/debug/` | 1 |
| `pages/api/leaderboard/` | 2 |
| `pages/api/team/` | 2 |
| `pages/api/upline/` | 3 |
| `pages/api/user/` | 2 |
| `pages/api/users/` | 1 |
| `pages/api/wellness-university/` | 3 |
| `pages/` (root) | 2 |
| `public/` | 1 |
| `utils/` | 17 |
| Backend root config | 7 |
| **Total backend files** | **114** |

---

## Frontend

```
frontend/
├── assets/
│   └── icon.png
├── icons/
│   ├── icon-128.png
│   ├── icon-128.webp
│   ├── icon-192.png
│   ├── icon-192.webp
│   ├── icon-256.png
│   ├── icon-256.webp
│   ├── icon-48.png
│   ├── icon-48.webp
│   ├── icon-512.png
│   ├── icon-512.webp
│   ├── icon-72.png
│   ├── icon-72.webp
│   ├── icon-96.png
│   └── icon-96.webp
├── public/
│   ├── call-icon.png
│   ├── call-icon-1.png
│   ├── icon-512.png
│   ├── index.html
│   ├── logo.png
│   ├── manifest.webmanifest
│   ├── service-worker.js
│   ├── street-view-icon.png
│   ├── wellness-valley-icon.png
│   └── whatsapp-icon.png
├── src/
│   ├── assets/
│   │   └── wellness-valley-icon.png
│   ├── components/
│   │   ├── common/
│   │   │   ├── DisciplineScoreLogos.js
│   │   │   ├── HierarchicalNode.js
│   │   │   └── HierarchicalReportLayout.js
│   │   ├── WellnessCounselling/
│   │   │   ├── EatingHabitsSection.js
│   │   │   ├── HealthProblemChips.js
│   │   │   ├── MedicationSection.js
│   │   │   ├── SleepQualitySection.js
│   │   │   └── WellnessCounsellingForm.js
│   │   ├── ActivityTimeReport.js
│   │   ├── AdminDashboard.js
│   │   ├── AttendanceReport.js
│   │   ├── AttendanceReport_backup.js
│   │   ├── AttendanceReport_old.js
│   │   ├── CameraTest.js
│   │   ├── ClubSelectionModal.js
│   │   ├── CoachScoreSummary.js
│   │   ├── CompleteProfilePage.js
│   │   ├── CustomAlertModal.js
│   │   ├── Dashboard.js
│   │   ├── DatePickerCalendar.js
│   │   ├── DeleteAccountModal.js
│   │   ├── DisciplineLeaderboard.js
│   │   ├── DisciplineReport.js
│   │   ├── DisciplineReport.QuickStart.js
│   │   ├── DisciplineReport_old.js
│   │   ├── DisciplineReportIntegration.guide.js
│   │   ├── DuplicateFoodModal.js
│   │   ├── EditableFoodItem.js
│   │   ├── EducationCard.js
│   │   ├── EducationCardModal.js
│   │   ├── EducationDashboard.js
│   │   ├── EducationLogCard.js
│   │   ├── FoodCorrectionsDebugPanel.js
│   │   ├── Header.js
│   │   ├── HierarchicalScoreCard.js
│   │   ├── HierarchicalTeamView.js
│   │   ├── ImageTypeSelector.js
│   │   ├── ImageUpload.js
│   │   ├── InactiveUserModal.js
│   │   ├── LeaderboardSettingsDropdown.js
│   │   ├── LeaderboardSettingsModal.js
│   │   ├── LoadingSpinner.js
│   │   ├── LocationGuard.js
│   │   ├── Login.js
│   │   ├── MandatoryProfilePictureModal.js
│   │   ├── ManualEducationEntryModal.js
│   │   ├── ManualFoodEntryModal.js
│   │   ├── ManualWatchEntryModal.js
│   │   ├── ManualWeightEntryModal.js
│   │   ├── MobilePickers.js
│   │   ├── NutritionCard.js
│   │   ├── NutritionCenterRegistration.js
│   │   ├── NutritionCentersMap.js
│   │   ├── NutritionDashboard.js
│   │   ├── PersonalDisciplineScore.js
│   │   ├── PrivacyPolicy.js
│   │   ├── ScreenDashboard.js
│   │   ├── ScreenTimeCard.js
│   │   ├── SmartFoodSearchModal.js
│   │   ├── StepCounter.js
│   │   ├── StepsDashboard.js
│   │   ├── SuccessSavePopup.js
│   │   ├── TeamMemberSearch.js
│   │   ├── TermsAndConditions.js
│   │   ├── TestImageGuide.js
│   │   ├── TimeWindowSettingsModal.js
│   │   ├── TouchFeedbackButton.js
│   │   ├── UpdateManager.example.js
│   │   ├── UserNotFoundModal.js
│   │   ├── UserProfileModal.js
│   │   ├── WatchActivityCard.js
│   │   ├── WaterTracker.js
│   │   ├── WeightCard.js
│   │   ├── WeightCardModal.js
│   │   ├── WeightDashboard.js
│   │   └── WeightLossLeaderboard.js
│   ├── config/
│   │   ├── leaderboardConfig.js
│   │   └── version.js
│   ├── pages/
│   │   ├── PrivacyPage.js
│   │   ├── ReminderSettingsPage.js
│   │   ├── ScreenTimePage.js
│   │   ├── SetupWizard.js
│   │   ├── TermsPage.js
│   │   ├── ValidateOTP.js
│   │   ├── WellnessCounselling.js
│   │   ├── WellnessUniversityEnrollment.js
│   │   └── WellnessUniversityReport.js
│   ├── plugins/
│   │   ├── foodImageAnalysis.js
│   │   ├── galleryMonitorPlugin.js
│   │   ├── inAppUpdatePlugin.js
│   │   ├── screenTimePlugin.js
│   │   └── stepCounterPlugin.js
│   ├── services/
│   │   ├── tokenCost/
│   │   │   ├── index.js
│   │   │   ├── tokenCostCalculator.js
│   │   │   ├── tokenCostConfig.js
│   │   │   ├── tokenTracker.js
│   │   │   └── userPricingManager.js
│   │   ├── apiClient.js
│   │   ├── backgroundNutritionService.js
│   │   ├── cacheManager.js
│   │   ├── cameraService.js
│   │   ├── dailyActivityService.js
│   │   ├── disciplineReportService.js
│   │   ├── duplicateDetectionService.js
│   │   ├── educationDetectionService.js
│   │   ├── firebase.js
│   │   ├── foodCorrectionService.js
│   │   ├── galleryMonitor.js
│   │   ├── geminiService.js
│   │   ├── getUserId.js
│   │   ├── imageTypeDetector.js
│   │   ├── locationAttendanceService.js
│   │   ├── nutritionFallback.js
│   │   ├── nutritionSaveService.js
│   │   ├── reminderService.js
│   │   ├── screenTimeService.js
│   │   ├── teamHierarchyService.js
│   │   ├── userContextService.js
│   │   └── weightDetectionService.js
│   ├── utils/
│   │   ├── backButtonHandler.js
│   │   ├── imageValidator.js
│   │   ├── mobileInit.js
│   │   ├── shareUtils.js
│   │   ├── textSelectionFix.js
│   │   └── timezoneUtils.js
│   ├── App.js
│   ├── index.css
│   ├── index.js
│   └── LazyLoadStyles.css
├── .env
├── .env.production
├── .gitignore
├── .npmrc
├── capacitor.config.js
├── deployment-report.json
├── package.json
├── package-lock.json
├── postcss.config.js
├── tailwind.config.js
└── update-sw-version.js
```

### Frontend Counts

| Folder | Files |
|---|---:|
| `assets/` (root) | 1 |
| `icons/` | 14 |
| `public/` | 10 |
| `src/assets/` | 1 |
| `src/components/` (flat) | 67 |
| `src/components/common/` | 3 |
| `src/components/WellnessCounselling/` | 5 |
| `src/config/` | 2 |
| `src/pages/` | 9 |
| `src/plugins/` | 5 |
| `src/services/` (flat) | 21 |
| `src/services/tokenCost/` | 5 |
| `src/utils/` | 6 |
| `src/` root | 4 |
| Frontend root config | 11 |
| **Total frontend files** | **164** |

---

## Combined Totals

- **Backend files:** 114 (95 of these are `.js` API/util/config)
- **Frontend files:** 164 (122 of these are `.js`/`.jsx` source)
- **Grand total tracked:** 278 files

## Notable Legacy / Cleanup Candidates

These appear in the tree as `_old`, `_backup`, `.QuickStart`, `.guide`, `.example` — likely safe to remove during rebase but verify nothing imports them first:

- `frontend/src/components/AttendanceReport_backup.js`
- `frontend/src/components/AttendanceReport_old.js`
- `frontend/src/components/DisciplineReport_old.js`
- `frontend/src/components/DisciplineReport.QuickStart.js`
- `frontend/src/components/DisciplineReportIntegration.guide.js`
- `frontend/src/components/UpdateManager.example.js`
- `frontend/src/components/TestImageGuide.js`
- `frontend/src/components/CameraTest.js`
