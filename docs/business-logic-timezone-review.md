# Business Logic Timezone Review

**Date:** 2026-07-20  
**Scope:** Wellness Score · Discipline · Leaderboards · Activity reports · Nutrition reports · Water calculations  
**Constraint:** Review only — no algorithm redesign. Protected `disciplineCalculations*` left unchanged (requires `@principal-eng`).

---

## Criteria

| Rule | Meaning |
|---|---|
| `applyDayFilter()` / `applyDateRangeFilter()` | All calendar-day DB queries must use shared datetime helpers |
| No `DATE()` | No SQL `DATE(column)` for business-day bucketing |
| No `+05:30` | No manual IST offset math in read/query paths |
| No server timezone | “Today” and ranges derived from user/platform IANA timezone, not `new Date()` / host TZ |

---

## Business logic reviewed

### 1. Wellness Score

| Layer | File(s) | Query filters | Post-query date logic |
|---|---|---|---|
| API | `features/wellness-score/api/daily-score.handler.js` | Resolves date via `getUserTimezoneIana` + `resolveRequestedDateYmd` | N/A |
| Repo | `features/wellness-score/data/wellness-score.repo.js` | `applyDayFilter`, `applyBeforeDayFilter` on education + weight | `score_date` range uses YMD columns (no `CreatedAt` math) |
| Domain | `domain/score.rules.js`, `domain/window.helpers.js` | None (pure) | Extracts `HH:MM:SS` from `CreatedAt` string for meal/window checks |
| Upstream | `food-corrections.repository.fetchMealsForDate`, `water.repo.getFoodRowsForDate`, `activity.repository` | All use `applyDayFilter` when called with user TZ | N/A |

**Verdict:** Query layer **compliant**. Window scoring still assumes wall-clock time embedded in the stored timestamp string (legacy `timestamp without time zone` behaviour).

---

### 2. Discipline

| Layer | File(s) | Query filters | Post-query date logic |
|---|---|---|---|
| Supabase impl | `utils/disciplineCalculationsSupabase.js` | **Non-compliant** — `.gte/.lte` with `` `${date}T00:00:00` `` / `` `T23:59:59` `` on 6 tables | `normalizeTimestamp().split('T')[0]`; `convertISTToUserLocalTime`; `getMealType` from string time |
| MySQL impl | `utils/disciplineCalculations.js` | **Non-compliant** — `DATE(w.CreatedAt)`, `DATE(e.CreatedAt)`, `DATE(f.CreatedAt)` | `TIME()` comparisons in SQL |
| Leaderboard API | `pages/api/leaderboard/get-discipline-leaderboard.js` | **Compliant** — delegates to `activity-report.repository` (`applyDateRangeFilter`) | **Risk** — `recordDateYmd = CreatedAt.slice(0,10)` for day bucketing |
| Helpers | `utils/disciplineHelpers.js` | N/A | Deprecated `parseDateRange()` still uses `+05:30` offset math |

**Active call graph:** `calculateMemberDisciplineSupabase` is only invoked from `calculateTeamDisciplineSupabase` (no live API import found). Production discipline leaderboard reimplements discipline % inline in `get-discipline-leaderboard.js` using migrated repo queries.

**Verdict:** Legacy discipline modules **non-compliant**. Live leaderboard query path **compliant**; aggregation logic **at risk** (string-prefix dates).

---

### 3. Leaderboards

| Endpoint | Date resolution | DB queries | Notes |
|---|---|---|---|
| `get-discipline-leaderboard.js` | `parseRelativeDateRangeYmd(..., IANA_IST)` | `activityReportRepo.fetch*` with `IANA_IST` | Platform TZ by design; not per-member TZ |
| `get-wellness-score-leaderboard.js` | `todayInTimezone(IANA_IST)` / `resolveRequestedDateYmd(..., IANA_IST)` | Filters `wellness_score_daily_table.score_date` (YMD column) | No `CreatedAt` filter |
| `get-global-leaderboard.js` | `todayInTimezone(IANA_IST)`, `shiftDateYmd` | `fetchWeightRecords(..., IANA_IST)` via `applyDateRangeFilter` | Platform TZ |

**Verdict:** All leaderboard **read queries** use `applyDateRangeFilter` or YMD columns. Hardcoded `IANA_IST` is intentional for global/platform rankings (not server host TZ).

---

### 4. Activity reports

| Layer | File(s) | Query filters | Post-query date logic |
|---|---|---|---|
| Service | `features/activity/activity-report.service.js` | `getUserTimezoneIana` → `parseRelativeDateRangeYmd` | `extractDateTime()` — regex on timestamp string |
| Repo | `features/activity/activity-report.repository.js` | `applyDateRangeFilter` on weight, education, food, steps | `dedupeFirstLogPerMemberPerDay` keys on `CreatedAt` prefix; `filterFoodByMealTime` uses string `HH:MM:SS` |
| Time report service | `features/activity/time-report.service.js` | User TZ via `getUserTimezoneIana` | `convertISTToLocalDate(r.CreatedAt, tzOffset)` for water/calorie day maps |
| Time report repo | `features/activity/time-report.repository.js` | `applyDateRangeFilter` on all activity tables | N/A |

**Verdict:** Query layer **compliant**. Report tables and time-report day grouping still use string extraction / `convertISTToLocalDate` (IST-named legacy helper).

---

### 5. Nutrition reports

| Feature | File(s) | Query filters |
|---|---|---|
| Daily meals (wellness + dashboard) | `food-corrections.repository.fetchMealsForDate` | `applyDayFilter` |
| Stats / weekly counts | `food-corrections.repository.getStatsCounts` | `applySinceDayStartFilter` + `todayInTimezone(timezoneIana)` |
| Activity report meal breakdown | `activity-report.repository.fetchFoodRecords` | `applyDateRangeFilter` |

**Verdict:** **Compliant** on all date-scoped nutrition queries when handler passes user timezone.

---

### 6. Water calculations

| Layer | File(s) | Query filters | Domain |
|---|---|---|---|
| API | `features/water/api/intake.handler.js` | `getUserTimezoneIana` → `resolveRequestedDateYmd` | Delegates to domain |
| Repo | `features/water/data/water.repo.js` | `applyDayFilter` on food rows | N/A |
| Domain | `features/water/domain/intake.rules.js` | None (pure) | `50 ml/kg` (= `weight/20 × 1000`); beverage filter via `foodTypeDetection` |

**Verdict:** **Compliant**. Water goal formula matches business rule (50 ml × kg). Duplicated inline in discipline leaderboard (`weight/20*1000`) — same math, not a TZ issue.

---

## Business logic modified

**None in this review pass.**

Reason: `disciplineCalculations*` is protected (`@principal-eng` required per `claude.md` §8). Changes were limited to audit and documentation per “do not redesign algorithms.”

Recommended follow-up PRs (query-layer only, no formula changes):

1. `disciplineCalculationsSupabase.js` — replace `` `.gte/.lte` + `T00:00:00` `` with `applyDateRangeFilter` (+ optional `timezoneIana` param defaulting to `IANA_IST`).
2. `get-discipline-leaderboard.js` — replace `recordDateYmd` string slice with `formatUtcForDisplay(ts, IANA_IST).slice(0,10)` or shared calendar helper.
3. `activity-report.repository.dedupeFirstLogPerMemberPerDay` — bucket by business YMD in requesting timezone, not raw prefix.
4. Deprecate/remove unused `disciplineCalculations.js` MySQL path if confirmed dead.

---

## Potential risks

### High

| Risk | Where | Impact |
|---|---|---|
| Manual `T00:00:00`/`T23:59:59` bounds | `disciplineCalculationsSupabase.js`, `calculateAttendanceMetrics` | Rows near midnight misclassified when DB stores UTC vs legacy IST strings; range endpoints not TZ-aware |
| `DATE()` in MySQL discipline SQL | `disciplineCalculations.js` | Server/connection TZ affects day boundaries if this path is ever invoked |
| `recordDateYmd = CreatedAt.slice(0,10)` | Discipline leaderboard, activity dedupe | Assumes date prefix equals business calendar day; breaks for true UTC timestamps or users outside platform TZ |

### Medium

| Risk | Where | Impact |
|---|---|---|
| `convertISTToLocalDate` + client `tzOffset` | `time-report.service.js`, `timeReportHelpers.js` | Name implies IST storage; mixed with `applyDateRangeFilter` (IANA) — inconsistent day buckets across report types |
| Hardcoded `IANA_IST` on global leaderboards | All 3 leaderboard APIs | Members in non-IST profile timezones ranked on platform calendar, not their own |
| Window checks via string `HH:MM:SS` | Wellness score, discipline leaderboard, activity meal filter | Correct only if stored timestamps represent business wall-clock; wrong after full UTC/timestamptz migration |
| `getISTTimestamp()` on writes | wellness-score upsert, many repos | New rows may still be written as IST-offset strings while reads use UTC range math |

### Low

| Risk | Where | Impact |
|---|---|---|
| Deprecated `parseDateRange()` (+05:30) | `disciplineHelpers.js` | Leak if any caller still imports it (no active imports found in scoped modules) |
| `05:30:00` default breakfast window | Multiple files | Business rule default (meal window start), not a TZ offset — acceptable |
| `disciplineCalculations.js` unused | MySQL variant | Dead code confusion; no runtime risk if never called |

---

## Compliance summary

| Domain | `applyDayFilter` on queries | No `DATE()` | No `+05:30` reads | No server TZ |
|---|---|---|---|---|
| Wellness Score | ✅ | ✅ | ✅ | ✅ (user TZ) |
| Discipline (live leaderboard) | ✅ | ✅ | ✅ | ⚠️ platform `IANA_IST` |
| Discipline (legacy modules) | ❌ | ❌ | ⚠️ | ⚠️ |
| Leaderboards | ✅ | ✅ | ✅ | ⚠️ platform `IANA_IST` |
| Activity reports | ✅ | ✅ | ⚠️ time-report helpers | ✅ (requester TZ) |
| Nutrition reports | ✅ | ✅ | ✅ | ✅ (user TZ) |
| Water | ✅ | ✅ | ✅ | ✅ (user TZ) |

---

## Files reviewed

```
backend/features/wellness-score/api/daily-score.handler.js
backend/features/wellness-score/data/wellness-score.repo.js
backend/features/wellness-score/domain/score.rules.js
backend/features/wellness-score/domain/window.helpers.js
backend/utils/disciplineCalculations.js
backend/utils/disciplineCalculationsSupabase.js
backend/utils/disciplineHelpers.js
backend/pages/api/leaderboard/get-discipline-leaderboard.js
backend/pages/api/leaderboard/get-wellness-score-leaderboard.js
backend/pages/api/leaderboard/get-global-leaderboard.js
backend/features/activity/activity-report.service.js
backend/features/activity/activity-report.repository.js
backend/features/activity/time-report.service.js
backend/features/activity/time-report.repository.js
backend/features/food-corrections/food-corrections.repository.js
backend/features/water/api/intake.handler.js
backend/features/water/data/water.repo.js
backend/features/water/domain/intake.rules.js
backend/shared/lib/datetime/applyDayFilter.js
```
