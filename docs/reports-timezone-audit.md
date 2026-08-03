# Reports Timezone Audit

**Date:** 2026-07-20  
**Scope:** Diary · Nutrition Dashboard · Weight Dashboard · Education Dashboard · Leaderboards · Wellness Score · CSV · PDF · Excel exports  
**Criteria:** Every date-scoped query uses `applyDayFilter()` / `applyDateRangeFilter()`; aggregation reviewed; timezone duplication flagged.

---

## Reports migrated

Backend read paths that **already use** `applyDayFilter` / `applyDateRangeFilter` / `applySinceDayStartFilter`:

| Report / surface | API / repo | Filter helper | Timezone source |
|---|---|---|---|
| **Diary** | `GET /api/diary/list` → `diary.repository.js` (6 verticals) | `applyDayFilter` | `getUserTimezoneIana(ownerUserId)` |
| **Nutrition Dashboard** (day view) | `GET /api/food-corrections/stats?detailed=true&date=` → `fetchMealsForDate` | `applyDayFilter` | `getUserTimezoneIana(userId)` |
| **Nutrition Dashboard** (counts) | `getStatsCounts` | `applySinceDayStartFilter` | `getUserTimezoneIana(userId)` |
| **Wellness Score** (daily + history compute) | `wellness-score.repo` + upstream repos | `applyDayFilter` / `applyBeforeDayFilter` | `getUserTimezoneIana(userId)` |
| **Activity Report** (summary + detail) | `activity-report.repository.js` | `applyDateRangeFilter` | `getUserTimezoneIana(requester)` |
| **Activity Time Report** | `time-report.repository.js` | `applyDateRangeFilter` | `getUserTimezoneIana(userId)` |
| **Discipline Leaderboard** | `activity-report.repository.js` (bulk fetch) | `applyDateRangeFilter` | `IANA_IST` (platform calendar) |
| **Weight Loss Leaderboard** | `activity-report.repository.fetchWeightRecords` | `applyDateRangeFilter` | `IANA_IST` |
| **Wellness Score Leaderboard** | `wellness_score_daily_table.score_date` | YMD column (no `CreatedAt` filter) | `IANA_IST` |
| **Water intake** (feeds wellness + water tile) | `water.repo.getFoodRowsForDate` | `applyDayFilter` | `getUserTimezoneIana(userId)` |
| **Club attendance** | `misc.repository.fetchEducationLogs` | `applyDateRangeFilter` | `getUserTimezoneIana(userId)` |
| **Nutrition center attendees** | `centers.repository` (edu/weight/food) | `applyDateRangeFilter` | Hardcoded `Asia/Kolkata` in handler |
| **Downline weight status** | `reports.repository.getLatestWeightsForUsers` | N/A — latest weight, no date filter | N/A |

### Export formats (data source)

| Format | Where | Source data | Query layer |
|---|---|---|---|
| **CSV — Activity Report** | `ActivityReport.js` `handleDownload` | `GET /api/activity/report` | ✅ `applyDateRangeFilter` |
| **CSV — Activity Time Report** | `ActivityTimeReport.js` `handleCsvDownload` | `GET /api/activity/time-report` | ✅ `applyDateRangeFilter` (repo); ⚠️ post-agg uses `convertISTToLocalDate` |

---

## Reports remaining

Surfaces that **do not** use `applyDayFilter` on their primary read path, or have **non-compliant aggregation**:

| Report / surface | Issue | Detail |
|---|---|---|
| **Weight Dashboard** | No server day filter | `GET /api/weight/history` returns paginated full history; day scoping is **client-side** (`filterHistoryByDay` in `weightDashboardFormatter.js`) |
| **Education Dashboard** | No server day filter | `GET /api/education/logs` + `summary` return all/paginated logs; day scoping is **client-side** (`filterLogsByDay`) |
| **Nutrition Dashboard** (weekly chart) | Aggregation TZ bug | `food-corrections.service.getStats` buckets `weeklyData` with `new Date(CreatedAt).toISOString().split('T')[0]` — UTC prefix, not business calendar |
| **Nutrition calorie trend** | Client date loop | `calorieTrendApi.js` builds dates with `new Date(selectedDate).setDate()` — device-local, duplicates business-calendar logic |
| **Activity Report** (display) | String date extraction | `extractDateTime()` / `dedupeFirstLogPerMemberPerDay` use `CreatedAt` string prefix, not IANA calendar |
| **Activity Time Report** (display) | IST helper duplication | `time-report.service.js` uses `convertISTToLocalDate` + client `tzOffset` **after** UTC-aware repo fetch |
| **Discipline Leaderboard** (aggregation) | String date bucketing | `recordDateYmd = CreatedAt.slice(0, 10)` despite compliant repo queries |
| **Club attendance** (display) | String date bucketing | `misc.service` maps `date: log.CreatedAt.split('T')[0]` |
| **Weight service stats** | `+05:30` duplication | `getISTDateStr()` in `weight.service.js` for latest/previous weight day comparison |
| **PDF export** | **Not implemented** | No tabular report generates PDF; share cards use `html2canvas` → image only |
| **Excel export** | **Not implemented** | `scripts/smoke-test.js` references `GET /api/coach/download-attendance-excel` — **no handler exists** in `pages/api/` |
| **Testimonial reports** | Out of scope | Photo/video team reports — no `CreatedAt` day filtering |

### Dashboard vs report pattern

| Pattern | Examples | Compliant for day queries? |
|---|---|---|
| **Server day filter** | Diary, nutrition day stats, wellness score | ✅ |
| **Fetch-all + client filter** | Weight history, education logs | ⚠️ Acceptable for UX pagination; not `applyDayFilter` on server |
| **Range report** | Activity reports, leaderboards | ✅ via `applyDateRangeFilter` |
| **Point-in-time snapshot** | Downline weight status | ✅ (no calendar filter needed) |

---

## Timezone duplication removed

**None in this pass** — audit only. Duplicated patterns to consolidate in a follow-up:

| Duplication | Locations | Target replacement |
|---|---|---|
| `CreatedAt.slice(0,10)` / `split('T')[0]` | Discipline LB, activity dedupe, misc club attendance, food-corrections weekly agg | `formatUtcForDisplay(ts, timezoneIana).dateYmd` or shared `timestampToBusinessYmd` (backend equivalent) |
| `convertISTToLocalDate` + `tzOffset` | `time-report.service.js`, `timeReportHelpers.js` | IANA `formatUtcForDisplay` using `getUserTimezoneIana` only — drop client offset param |
| `getISTDateStr` (+05:30) | `weight.service.js` | `calendarDate` helpers + user TZ |
| `toLocalDateString` / device `Date` loops | `calorieTrendApi.js`, `dayAnalysesApi.js`, `analysisHelpers.js` | `todayBusinessDate` / `shiftDateYmd` from `datetimeUtils` |
| Hardcoded `Asia/Kolkata` | `centers.service.getAttendees`, leaderboard APIs | `getUserTimezoneIana` or explicit platform constant in one place |
| `parseDateRange` (+05:30) | `disciplineHelpers.js` (deprecated) | Already superseded by `parseRelativeDateRangeYmd` — safe to delete when confirmed unused |

---

## Potential issues

### High

1. **Nutrition weekly aggregation** — `getStats` non-detailed path groups meals by UTC ISO date, not user business day. Weekly carousel / summary chart can mis-attribute meals near midnight.
2. **Activity Time Report double timezone** — Repo filters with IANA; service re-buckets with `convertISTToLocalDate(tzOffset)`. CSV export reflects the IST-offset path, not the repo TZ.
3. **Discipline leaderboard day counts** — Repo returns correct rows; `slice(0,10)` day keys can disagree with `applyDateRangeFilter` boundaries.

### Medium

4. **Weight / Education dashboards** — Client-side day filter uses migrated `datetimeUtils` on frontend, but backend returns unscoped history. Large histories = extra payload; day boundary depends on frontend `DEFAULT_BUSINESS_TIMEZONE` until `user.timezone` is wired everywhere.
5. **Calorie trend API** — Seven parallel `stats?detailed=true` calls with device-local date strings may request wrong calendar days for non-IST users.
6. **Global leaderboards** — Intentionally use `IANA_IST`; members in other timezones ranked on platform calendar.
7. **Nutrition center attendees** — Hardcoded `Asia/Kolkata`; not requester TZ.

### Low

8. **PDF / Excel** — Not present for operational reports; product gap only.
9. **Downline weight report** — No date dimension; uses latest weight ever — correct by design.
10. **Wellness score leaderboard** — Reads precomputed `score_date` rows; compute path is migrated but leaderboard date defaults to platform IST.

---

## Aggregation logic review (by surface)

| Surface | Query | Aggregation | TZ-safe? |
|---|---|---|---|
| Diary | `applyDayFilter` per vertical | Merge + sort by `capturedAt` | Query ✅; sort uses `Date` parse |
| Nutrition day | `applyDayFilter` | Sum macros in service | ✅ |
| Nutrition week | `applySinceDayStartFilter` | `dailyMap` via `toISOString` | ❌ |
| Weight dashboard | Full history | Client filter + trend series | Client ✅ (post-migration); server N/A |
| Education dashboard | Full logs | Client filter + monthly groups | Client ✅; month keys use UTC getters |
| Activity report | `applyDateRangeFilter` | Dedupe per member/day, meal window filter | Query ✅; dedupe ⚠️ |
| Time report | `applyDateRangeFilter` | Per-day activity matrix, water/calorie sets | Query ✅; sets ⚠️ |
| Wellness score | `applyDayFilter` | `score.rules` window checks on time string | Query ✅; windows ⚠️ |
| Leaderboards | `applyDateRangeFilter` or YMD table | Inline discipline % / weight delta | Mixed |

---

## Recommended next steps

1. Fix `food-corrections.service.getStats` weekly `dailyMap` to bucket by business YMD in `timezoneIana`.
2. Replace `convertISTToLocalDate` in time-report with IANA-only helpers; remove `tzOffset` from API contract.
3. Add shared backend `timestampToCalendarYmd(ts, timezoneIana)` and use in activity dedupe + discipline LB + misc club attendance.
4. Wire `user.timezone` into nutrition `calorieTrendApi` date loop (frontend).
5. Optionally add `?date=` + `applyDayFilter` to weight/education history APIs when dashboard is day-scoped (performance, not correctness).
6. Remove or implement stale Excel smoke-test endpoint.

---

## Files reviewed

```
backend/features/background-analysis/diary.service.js
backend/features/background-analysis/diary.repository.js
backend/features/food-corrections/food-corrections.service.js
backend/features/food-corrections/food-corrections.repository.js
backend/features/weight/weight.service.js
backend/features/education/education.service.js
backend/features/education/education.repository.js
backend/features/wellness-score/api/daily-score.handler.js
backend/features/wellness-score/data/wellness-score.repo.js
backend/features/activity/activity-report.service.js
backend/features/activity/activity-report.repository.js
backend/features/activity/time-report.service.js
backend/features/activity/time-report.repository.js
backend/features/reports/reports.service.js
backend/features/water/data/water.repo.js
backend/features/misc/misc.service.js
backend/features/nutrition-centers/centers.service.js
backend/pages/api/leaderboard/*.js
frontend/src/features/activity/components/ActivityReport.js
frontend/src/features/activity/components/ActivityTimeReport.js
frontend/src/features/nutrition/services/nutritionDashboard/*
frontend/src/features/weight/hooks/useWeightDashboard.js
frontend/src/features/education/hooks/useEducationDashboard.js
frontend/src/features/wellness-score-sheet/*
frontend/src/features/reports/*
```
