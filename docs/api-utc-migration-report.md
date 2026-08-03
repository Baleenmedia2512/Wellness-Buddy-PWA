# API UTC Migration Report

**Date:** 2026-07-20  
**Scope:** Backend API layer only (no frontend changes)  
**Goal:** Every endpoint accepting a `date` (or date range) must (1) read the user's IANA timezone, (2) delegate UTC bounds to repository helpers via `applyDayFilter` / `parseRelativeDateRangeYmd`, and (3) never compute calendar dates inside route handlers with `+05:30`, `DATE()`, or server-local `new Date()`.

---

## Pattern Applied

```javascript
import { getUserTimezoneIana } from '../user/domain/userTimezone.js';
import {
  resolveRequestedDateYmd,
  assertNotFutureDateYmd,
  parseRelativeDateRangeYmd,
} from '../../shared/lib/datetime/index.js';

const timezoneIana = await getUserTimezoneIana(userId);
const dateYmd = resolveRequestedDateYmd(query.date, timezoneIana);
assertNotFutureDateYmd(dateYmd, timezoneIana);
const rows = await repo.fetchSomething(userId, dateYmd, timezoneIana);
```

**Global / platform endpoints** (no single authenticated user) use `IANA_IST` (`Asia/Kolkata`) as the platform default calendar.

---

## APIs Migrated

| Endpoint | Handler / Service | Notes |
|---|---|---|
| `GET /api/water/intake` | `water/api/intake.handler.js` | User TZ → `resolveRequestedDateYmd` → `water.repo` |
| `GET /api/diary/list` | `background-analysis/diary.service.js` | Owner TZ → all `fetch*ForDay` repo calls |
| `GET /api/wellness-score/daily` | `wellness-score/api/daily-score.handler.js` | User TZ; schema no longer defaults date in validator |
| `GET /api/wellness-score/history` | `wellness-score/api/daily-score.handler.js` | User TZ for `today` cutoff in history |
| `GET /api/food-corrections/stats` | `food-corrections/food-corrections.service.js` | User TZ for detailed day + aggregate counts |
| `GET /api/activity` | `activity/activity.service.js` | User TZ for `targetDate` trend + save default day |
| `GET /api/activity/watch-calories` | `activity/activity.service.js` | User TZ for `date` param |
| `GET /api/activity/report` | `activity/activity-report.service.js` | User TZ via `parseRelativeDateRangeYmd` |
| `GET /api/activity/time-report` | `activity/time-report.service.js` | Replaced `parseDateRangeIST`; repo gets TZ |
| `GET /api/misc/club-attendance` | `misc/misc.service.js` | User TZ for `startDate` / `endDate` |
| `GET /api/nutrition-centers` | `nutrition-centers/centers.service.js` | Coach TZ for attendance metrics range |
| `GET /api/nutrition-centers/attendees` | `nutrition-centers/centers.service.js` | Platform TZ (`Asia/Kolkata`) — no `userId` on request |
| `GET /api/leaderboard/get-global-leaderboard` | `pages/api/leaderboard/get-global-leaderboard.js` | Platform TZ; uses `activity-report.repository` |
| `GET /api/leaderboard/get-discipline-leaderboard` | `pages/api/leaderboard/get-discipline-leaderboard.js` | Platform TZ `last10days`; repo bulk fetch |
| `GET /api/leaderboard/get-wellness-score-leaderboard` | `pages/api/leaderboard/get-wellness-score-leaderboard.js` | Platform TZ; removed `todayInIST()` |
| `GET /api/weight-progress-tips/check-progress` | `weight-progress-tips/api/check-progress.handler.js` | User TZ for yesterday lookups |

### Shared infrastructure added

| Module | Purpose |
|---|---|
| `features/user/domain/userTimezone.js` | `getUserTimezoneIana(userId)` from `team_table.timezone_iana` |
| `shared/lib/datetime/calendarDate.js` | `resolveRequestedDateYmd`, `parseRelativeDateRangeYmd`, validation helpers |

### Validators updated (shape only — no date defaults)

| File | Change |
|---|---|
| `activity/activity.validators.js` | Removed `toDateKey()` / server-local defaults |
| `wellness-score/validation/wellness-score.schema.js` | Removed `todayInIST()` default for `date` |
| `background-analysis/analysis.validators.js` | `validateDiaryList` uses `assertCalendarDateYmd` |

---

## APIs Remaining / Deferred

These do **not** accept a client `date` filter, or are explicitly out of scope for this pass:

| Area | Reason |
|---|---|
| `utils/disciplineCalculationsSupabase.js` | Protected business-logic owner — requires `@principal-eng` |
| `utils/disciplineCalculations.js` | Legacy MySQL `DATE()` — not used by migrated API routes |
| `utils/timeReportHelpers.js` | Deprecated IST helpers; still used for **display grouping** (`convertISTToLocalDate`) in time-report, not for DB date bounds |
| `GET /api/misc/server-time` | Returns platform clock; uses `todayInTimezone('Asia/Kolkata')` intentionally |
| Weight / education / captures write APIs | Timestamp generation (`getISTTimestamp`, `convertToIST`) — separate from date-filter migration |
| Cron jobs (`/api/cron/*`) | System jobs; use `nowUtc()` for timestamps, not user calendar filters |
| `GET /api/reports/downline-weight-status` | No date-range query param (snapshot report) |

### Follow-up (non-blocking)

| Location | Issue |
|---|---|
| `food-corrections/food-corrections.service.js` `getStats()` aggregate path | Weekly `dailyNutrition` map still buckets via `new Date(CreatedAt).toISOString()` — display aggregation, not a date-filter API |
| `GET /api/nutrition-centers/attendees` | No `userId` param today; uses platform TZ. Consider passing coach `userId` in a future API revision for per-coach TZ |
| Discipline leaderboard meal-window checks | Still extracts `HH:MM:SS` from stored IST strings; per-user TZ windows not applied (global leaderboard semantics) |

---

## IST / `DATE()` Removal Summary

| Removed from API layer | Replacement |
|---|---|
| Inline `IST_OFFSET_MS` / `+05:30` in leaderboard handlers | `todayInTimezone` + `shiftDateYmd` + `activity-report.repository` |
| `todayInIST()` in wellness-score schema / leaderboard | `todayInTimezone(IANA_IST)` |
| `parseDateRangeIST` in time-report service | `parseRelativeDateRangeYmd` + user TZ |
| Server-local `parseDateRange` in activity-report service | `parseRelativeDateRangeYmd` + user TZ |
| `toDateKey()` / `new Date().toISOString().slice(0,10)` in activity validators | Resolved in service via user TZ |
| Manual yesterday ISO bounds in check-progress | `shiftDateYmd` + `applyDayFilter` in repo |
| `T23:59:59` string suffix in discipline leaderboard queries | `applyDateRangeFilter` via repository |

---

## Verification

```bash
node --test backend/shared/lib/datetime/__tests__/datetime.test.js
node --test backend/features/user/__tests__/timezone.test.js
```

**Result:** 12/12 datetime tests passing (2026-07-20).

---

## Files Changed (API layer)

- `features/water/api/intake.handler.js`
- `features/background-analysis/diary.service.js`
- `features/background-analysis/analysis.validators.js`
- `features/wellness-score/api/daily-score.handler.js`
- `features/wellness-score/validation/wellness-score.schema.js`
- `features/food-corrections/food-corrections.service.js`
- `features/activity/activity.service.js`
- `features/activity/activity.validators.js`
- `features/activity/activity-report.service.js`
- `features/activity/time-report.service.js`
- `features/misc/misc.service.js`
- `features/nutrition-centers/centers.service.js`
- `features/weight-progress-tips/api/check-progress.handler.js`
- `features/weight-progress-tips/data/weight-progress.repo.js`
- `pages/api/leaderboard/get-global-leaderboard.js`
- `pages/api/leaderboard/get-discipline-leaderboard.js`
- `pages/api/leaderboard/get-wellness-score-leaderboard.js`
- `features/user/domain/userTimezone.js` (new)
- `shared/lib/datetime/calendarDate.js` (new)
