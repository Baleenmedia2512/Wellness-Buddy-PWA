# Frontend UTC Migration Report

**Date:** 2026-07-20  
**Scope:** Remove IST assumptions from the frontend; display timestamps in UTC; keep business-calendar dates for API query params.

---

## New utilities

| File | Purpose |
|---|---|
| `frontend/src/shared/utils/datetimeUtils.js` | `parseUtcTimestamp`, `formatUtcDate/Time/DateTime`, `todayBusinessDate`, `dateToBusinessYmd`, `timestampToBusinessYmd`, `isSameBusinessDay`, etc. |
| `frontend/src/shared/hooks/useBusinessToday.js` | Live business-calendar YYYY-MM-DD (replaces `useISTToday`) |

**Rules applied:**
- Timestamps → parsed as UTC, displayed with `timeZone: 'UTC'`
- Calendar / API `date` params → `todayBusinessDate()` / `dateToBusinessYmd()` (default `Asia/Kolkata`; accepts `user.timezone` when passed to `useBusinessToday`)
- No UTC range math on the frontend (backend owns filtering)

---

## Files changed

### Shared
- `shared/utils/datetimeUtils.js` *(new)*
- `shared/utils/timezoneUtils.js` — replaced IST implementations with re-exports from `datetimeUtils`
- `shared/utils/index.js` — exports `datetimeUtils`
- `shared/hooks/useBusinessToday.js` *(new)*

### Diary
- `features/diary/hooks/useDiary.js` — `toYmd()` uses business calendar, not IST offset
- `features/diary/components/DiaryFeed.jsx` — UTC timeline labels; business-day headers
- `features/diary/api/diaryClient.js` — comment update

### Nutrition
- `features/nutrition/services/nutritionDashboard/analysisHelpers.js` — `parseMealTimestamp`, business-hour meal categories
- `features/nutrition/services/nutritionDashboard/index.js` — export rename
- `features/nutrition/components/dashboard/NutritionMealList.js`
- `features/nutrition/components/dashboard/NutritionAnalysisPanel.js`
- `features/nutrition/components/HomeNutritionCarousel.js`
- `features/nutrition/services/duplicateDetection/duplicateWeight.js`
- `features/nutrition/services/duplicateDetection/duplicateFood.js`

### Weight
- `features/weight/services/weightFormService.js`
- `features/weight/services/weightDashboardFormatter.js`
- `features/weight/components/WeightSummaryCards.js`
- `features/weight/components/WeightHistoryList.js`
- `features/weight/components/WeightDetailHeader.js`
- `features/weight/hooks/useWeightDashboard.js`
- `hooks/useWeightCapture.js` — `isSameBusinessDay` guard

### Education
- `features/education/services/educationFormatter.js`
- `features/education/services/educationDashboardFormatter.js`
- `features/education/components/EducationCard.js`
- `features/education/components/EducationLogList.js`

### Activity
- `features/activity/services/dailyActivityService.js` — `todayBusinessDate` for `targetDate`

### Water
- `features/water/services/waterStorageService.js` — `todayLocal()` → business calendar
- `features/water/hooks/useWaterTracker.js` — UTC log times

### Wellness score / Dashboard
- `features/wellness-score-sheet/domain/dateRange.js`
- `features/wellness-score-sheet/components/WellnessScoreSheet.jsx`
- `features/wellness-score-sheet/components/WellnessScoreHomeTile.jsx`
- `features/wellness-score-sheet/components/WellnessScorePage.jsx`
- `features/wellness-score-sheet/components/WellnessScoreCarouselCard.jsx`
- `features/wellness-score-sheet/hooks/useISTToday.js` — deprecated alias → `useBusinessToday`

### Reports / centers
- `features/nutrition-centers/components/AttendeeListModal.js` — UTC attendee log times

### App shell
- `App.js` — removed unused `getISTDateStr` helper

---

## Remaining IST references (intentional / deferred)

| Location | Notes |
|---|---|
| `features/wellness-score-sheet/hooks/useISTToday.js` | Deprecated re-export alias only |
| `shared/constants/timeWindows.js` | Business meal windows documented as Asia/Kolkata wall-clock |
| `shared/utils/imageValidator.js`, `shared/components/ImageUpload.js` | Capture upload sends device offset (`+05:30` etc.) — write path, not display |
| `shared/types/index.js` | JSDoc `recordedAtIst` typedef — docs only |
| `features/wellness-score-sheet/hooks/useWellnessScore.js` | Comments mention IST rollover |
| `shell/components/Dashboard.js` | Comments only |
| `features/leaderboard/components/WellnessScoreLeaderboard.js` | Comment only |
| Share cards (`NutritionCard`, `FoodImageShareCard`, `EducationShareCard`) | Still use device-local `new Date()` for “generated at” stamp |
| `features/activity/components/ActivityTimeReport.js` | Still passes `userTimezoneOffset` to backend time-report API |
| `features/testimonials/**` | Out of scope for this pass |
| Legal copy (`TermsAndConditions`, `PrivacyPolicy`) | “Business Hours … IST” — product copy |

---

## Removed helpers

| Old | Replacement |
|---|---|
| `todayDateInIST()` | `todayBusinessDate(timezoneIana)` |
| `istToLocalDate()` | `parseUtcTimestamp()` |
| `formatISTToLocalDate/Time/DateTime()` | `formatUtcDate/Time/DateTime()` |
| `useISTToday()` | `useBusinessToday(user?)` |
| `getISTDateStr()` | `isSameBusinessDay()` / `timestampToBusinessYmd()` |

---

## Follow-up (optional)

1. Wire `user.timezone` from profile API into `useBusinessToday(user)` everywhere (currently defaults to `Asia/Kolkata` when timezone not on user object).
2. Migrate share-card “generated at” stamps to UTC.
3. Remove deprecated `useISTToday` alias after one release cycle.
4. Update `shared/types/index.js` JSDoc from `recordedAtIst` to `recordedAtUtc`.
