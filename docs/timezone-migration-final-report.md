# Timezone Migration — Final Report

**Date:** 2026-07-20  
**Objective:** Remove deprecated IST helpers, eliminate manual UTC/date math in repositories, standardize on `applyDayFilter()` / shared datetime utilities.

---

## Completed modules

### Backend infrastructure

| Item | Status |
|---|---|
| `shared/lib/datetime/datetime.js` | `nowUtc`, `toUtcRange`, `todayInTimezone`, `formatUtcForDisplay`, **`timestampToCalendarYmd`**, **`timeOfDayInTimezone`**, **`parseClientTimestampToUtc`** |
| `shared/lib/datetime/applyDayFilter.js` | `applyDayFilter`, `applyDateRangeFilter`, `applySinceDayStartFilter`, `applyBeforeDayFilter` |
| `shared/lib/datetime/calendarDate.js` | `resolveRequestedDateYmd`, `parseRelativeDateRangeYmd`, `assertNotFutureDateYmd` |
| `features/user/domain/userTimezone.js` | `getUserTimezoneIana(userId)` |

### Removed deprecated helpers

| Removed | Replacement |
|---|---|
| `getISTTimestamp()` | `nowUtc()` — **removed from `utils/supabaseClient.js`**; ~25 call sites migrated |
| `convertToIST()` | `parseClientTimestampToUtc()` — removed from `supabaseClient.js` |
| `todayInIST()` / `todayDateInIST()` | Already gone; frontend uses `todayBusinessDate()` / `useBusinessToday()` |
| `parseDateRange()` (+05:30) | **Deleted** from `disciplineHelpers.js` (unused) |
| `getISTDateStr()` (+05:30) | **Deleted** from `weight.service.js` → `timestampToCalendarYmd` |

### Repository layer (`applyDayFilter` compliant)

All date-scoped Supabase repositories now use shared filters (no manual `T00:00:00` / `T23:59:59`):

- `background-analysis/diary.repository.js`
- `water/data/water.repo.js`
- `food-corrections/food-corrections.repository.js`
- `wellness-score/data/wellness-score.repo.js`
- `activity/activity.repository.js`
- `activity/activity-report.repository.js`
- `activity/time-report.repository.js`
- `weight-progress-tips/data/weight-progress.repo.js`
- `nutrition-centers/centers.repository.js`
- `misc/misc.repository.js`

### Business logic / services (this cleanup pass)

| Module | Changes |
|---|---|
| **Discipline (Supabase)** | `disciplineCalculationsSupabase.js` — all 6 query blocks → `applyDateRangeFilter`; aggregation → `timestampToCalendarYmd` / `timeOfDayInTimezone` |
| **Weight** | Write path `nowUtc` + `parseClientTimestampToUtc`; stats use `timestampToCalendarYmd` + user TZ |
| **Education** | Write path UTC; window checks via `timeOfDayInTimezone` |
| **Food / analysis** | `analysis.service`, `food-corrections.service` weekly bucketing → `timestampToCalendarYmd` |
| **Activity time report** | Dropped `convertISTToLocalDate` + client `tzOffset`; uses requester IANA TZ |
| **Auth / user / testimonials / upline / wellness-university** | All `getISTTimestamp()` → `nowUtc()` |

### API handlers (date param migration — prior + verified)

Diary, water, diary list, wellness-score daily/history, food-corrections stats, activity daily/report/time-report, leaderboards, nutrition-centers, misc club-attendance, weight-progress check-progress.

### Frontend (prior pass)

`datetimeUtils.js`, `useBusinessToday`, dashboards (diary, nutrition, weight, education, wellness score, water), UTC display helpers.

---

## Remaining issues

### High — legacy SQL path (unused in production APIs)

| File | Issue |
|---|---|
| `utils/disciplineCalculations.js` | MySQL `DATE(CreatedAt)` — **no active imports**; delete or migrate when MySQL path retired |

### Medium — deprecated helpers still present (not imported by features)

| File | Issue |
|---|---|
| `utils/timeReportHelpers.js` | `parseDateRangeIST`, `convertISTToLocalDate` still contain `+05:30` — **unused** after time-report service migration; safe to delete in follow-up |
| `utils/timezoneConverter.js` | `convertISTToUserLocalTime` — check callers |
| `features/auth/auth.service.js` | OTP expiry still uses manual `+05:30` for “IST calendar day” (not a repository filter) |
| `features/auth/auth.repository.js` | Same pattern for OTP cleanup cutoff |
| `features/testimonials/testimonials.service.js` | `istNow` +05:30 for OTP/token expiry display |

### Medium — aggregation without server day filter

| Surface | Issue |
|---|---|
| Weight / Education dashboards | Full-history APIs; client filters by business day |
| Discipline leaderboard API | `CreatedAt.slice(0,10)` day bucketing (repo queries are compliant) |
| Activity report dedupe | String-prefix date keys in `dedupeFirstLogPerMemberPerDay` |
| Nutrition `calorieTrendApi.js` | Client `Date` loop for multi-day chart |

### Low — intentional constants

| Item | Notes |
|---|---|
| `05:30:00` breakfast defaults | Meal **window** config, not TZ offset |
| `IANA_IST` on global leaderboards | Platform calendar for rankings |
| `imageValidator.js` / `ImageUpload.js` | Device offset on **capture upload** (write contract) |
| `disciplineCalculations.js` | Protected legacy MySQL implementation |

### Documentation / comments

- `backend/backend.md` still mentions `getISTTimestamp` / `convertToIST` on supabaseClient — update on next docs pass
- `UnknownEntryFlow.jsx` comment references `getISTTimestamp`

---

## Performance improvements

1. **Nutrition calorie trend** — 7× parallel `stats?detailed=true` calls; consider single range API with `applyDateRangeFilter` + server-side daily rollup.
2. **Weight / Education dashboards** — optional `?date=` + `applyDayFilter` on history endpoints to reduce payload for day-scoped views.
3. **Discipline leaderboard** — bulk fetch already batched; fix client-side date bucketing to avoid re-processing edge cases.
4. **Remove dead code** — `parseDateRangeIST`, `convertISTToLocalDate`, `disciplineCalculations.js` reduces bundle confusion and review surface.

---

## Risk analysis

| Risk | Severity | Mitigation |
|---|---|---|
| **Write timestamp format change** (`IST naive` → `UTC ISO`) | High | Existing rows may mix formats until backfill; `applyDayFilter` assumes UTC-comparable strings. Monitor meal/weight window scores near migration boundary. |
| **Legacy rows without `Z` suffix** | Medium | `parseClientTimestampToUtc` / `formatUtcForDisplay` normalize on read; verify Supabase comparison ordering on mixed data. |
| **Global leaderboard uses `IANA_IST`** | Low | Documented product choice; not a bug. |
| **Time report API `userTimezoneOffset` ignored** | Low | Param still accepted in validator but service uses profile IANA TZ — correct for migration; update API docs. |
| **testimonials/auth OTP “IST day” math** | Low | Unrelated to activity queries; separate cleanup ticket. |
| **Protected `disciplineCalculations.js`** | Low | Dead code path; do not invoke from new features. |

---

## Testing checklist

### Automated

- [ ] `node --test backend/shared/lib/datetime/__tests__/datetime.test.js`
- [ ] `node --test backend/features/user/__tests__/timezone.test.js`
- [ ] `node --test backend/features/wellness-score/__tests__/*.test.js`
- [ ] Full backend test suite (`npm test` in `backend/`)

### Manual — calendar day boundaries

- [ ] Log weight at 00:15 IST — appears on correct business day in diary + weight dashboard
- [ ] Log meal at 23:50 IST — nutrition day view includes entry
- [ ] User with non-`Asia/Kolkata` profile TZ (when wired) — water intake date matches profile

### Manual — reports

- [ ] Activity report (last 7 days) — row counts match detail view
- [ ] Activity time report CSV — dates align with on-screen matrix
- [ ] Discipline leaderboard — no off-by-one vs activity report for same period
- [ ] Wellness score daily + history — scores stable vs pre-migration for historical dates

### Manual — writes

- [ ] New food log `CreatedAt` stored as UTC ISO
- [ ] Education log with EXIF timestamp — window on-time/late unchanged for IST business windows
- [ ] Weight save with client timestamp — `CreatedAt` parses correctly

### Regression

- [ ] Leaderboards load (discipline, wellness score, weight loss)
- [ ] Downline weight status report (no date filter — latest weights)
- [ ] OTP / auth flows (unaffected by repo migration but touched `nowUtc`)

---

## Verification summary

| Check | Result |
|---|---|
| No `getISTTimestamp()` / `convertToIST()` in feature code | ✅ Removed from `supabaseClient.js`; call sites migrated |
| No `todayInIST()` / `todayDateInIST()` | ✅ Not present in codebase |
| Repositories manual UTC bounds | ✅ None found (`T00:00:00` only in comments / idle-cleanup docs) |
| Repositories use `applyDayFilter` / `applyDateRangeFilter` | ✅ All scoped domain repos |
| `DATE(CreatedAt)` in active paths | ⚠️ Only `disciplineCalculations.js` (legacy MySQL, unused) |
| `+05:30` in read/query paths | ✅ Removed from discipline Supabase + food weekly agg + time report |
| `+05:30` remaining | ⚠️ auth OTP, testimonials OTP, deprecated `timeReportHelpers` dead code |

---

## Related reports

- [`docs/utc-foundation-migration-report.md`](utc-foundation-migration-report.md)
- [`docs/api-utc-migration-report.md`](api-utc-migration-report.md)
- [`docs/frontend-utc-migration-report.md`](frontend-utc-migration-report.md)
- [`docs/repository-utc-migration-report.md`](repository-utc-migration-report.md)
- [`docs/business-logic-timezone-review.md`](business-logic-timezone-review.md)
- [`docs/reports-timezone-audit.md`](reports-timezone-audit.md)
