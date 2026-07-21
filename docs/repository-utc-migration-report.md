# Repository UTC Filtering — Migration Report

**Date:** 2026-07-21  
**Scope:** Backend repositories only — frontend unchanged  
**Default timezone:** `Asia/Kolkata` (`IANA_IST`) via optional `timezoneIana` parameter

---

## Summary

All repository-layer calendar-day and date-range filters in the scoped domains now use `applyDayFilter()` and related helpers from `shared/lib/datetime/applyDayFilter.js`. Manual `T00:00:00`, `T23:59:59`, `+05:30`, and `istDayBounds()` patterns were removed from repositories.

No business-logic modules (discipline calculations, validators, API route handlers) were changed.

---

## Helpers Used

| Helper | Use case |
|---|---|
| `applyDayFilter(query, column, dateYmd, timezoneIana)` | Single calendar day (inclusive) |
| `applyDateRangeFilter(query, column, startDate, endDate, timezoneIana)` | Multi-day inclusive range |
| `applySinceDayStartFilter(query, column, dateYmd, timezoneIana)` | On/after start of day (`gte` only) |
| `applyBeforeDayFilter(query, column, dateYmd, timezoneIana)` | Strictly before start of day (`lt`) |

All helpers delegate to `toUtcRange()` / `toUtcRangeInclusive()` — repositories never compute UTC bounds directly.

Also added: `shiftDateYmd()` in `shared/lib/datetime/datetime.js` for relative calendar dates (food stats week window).

---

## Repositories Migrated

### Food
| File | Functions | Filter helper |
|---|---|---|
| `features/food-corrections/food-corrections.repository.js` | `fetchMealsForDate`, `getStatsCounts` | `applyDayFilter`, `applySinceDayStartFilter` |

### Water
| File | Functions | Filter helper |
|---|---|---|
| `features/water/data/water.repo.js` | `getFoodRowsForDate` | `applyDayFilter` |

### Weight
| File | Functions | Filter helper |
|---|---|---|
| `features/wellness-score/data/wellness-score.repo.js` | `getWeightRecordsForDate`, `getPreviousWeightBeforeDate` | `applyDayFilter`, `applyBeforeDayFilter` |

> `features/weight/weight.repository.js` — no calendar-day filters (history listing only).

### Education
| File | Functions | Filter helper |
|---|---|---|
| `features/background-analysis/diary.repository.js` | `fetchEducationForDay` | `applyDayFilter` |
| `features/misc/misc.repository.js` | `fetchEducationLogs` | `applyDateRangeFilter` |
| `features/nutrition-centers/centers.repository.js` | `attendanceForCenter`, `getAttendeeList` (education leg) | `applyDateRangeFilter` |

> `features/education/education.repository.js` — no calendar-day filters.

### Activity
| File | Functions | Filter helper |
|---|---|---|
| `features/activity/activity.repository.js` | `fetchDailyRows`, `findExistingDailyRows`, `fetchWatchCalorieRows` | `applyDayFilter`, `applyDateRangeFilter` |
| `features/activity/activity-report.repository.js` | `fetchWeightRecords`, `fetchEducationRecords`, `fetchFoodRecords`, `fetchStepRecords` | `applyDateRangeFilter` |
| `features/activity/time-report.repository.js` | `fetchTimeReportData` | `applyDateRangeFilter` |

### Diary / Background Analysis
| File | Functions | Filter helper |
|---|---|---|
| `features/background-analysis/diary.repository.js` | `fetchFoodForDay`, `fetchWeightForDay`, `fetchWatchForDay`, `fetchUnknownCapturesForDay`, `fetchPendingCapturesForDay` | `applyDayFilter` |

> Removed: `istDayBounds()`, `istDayBoundsWithOffset()` local helpers.

### Reports
| File | Status |
|---|---|
| `features/reports/reports.repository.js` | **No date filters** — fetches latest weight per user only; nothing to migrate |

### Nutrition Centers (cross-cutting attendance)
| File | Functions | Filter helper |
|---|---|---|
| `features/nutrition-centers/centers.repository.js` | `attendanceForCenter`, `getAttendeeList` | `applyDateRangeFilter` |

---

## Service Layer Adjustments (repository callers only)

Minimal changes to pass `YYYY-MM-DD` dates instead of pre-formatted `T00:00:00` strings:

| File | Change |
|---|---|
| `features/misc/misc.service.js` | `getClubAttendance` passes `startYmd`/`endYmd` to repo |
| `features/nutrition-centers/centers.service.js` | Attendance/attendee calls pass YMD dates |

---

## Remaining — Not Migrated (by design)

### Repositories with no calendar-day filters
| File | Reason |
|---|---|
| `features/weight/weight.repository.js` | List/history queries only |
| `features/education/education.repository.js` | No day-bound queries |
| `features/background-analysis/analysis.repository.js` | No day-bound queries |
| `features/reports/reports.repository.js` | Latest-weight lookup only |
| `features/captures/data/captures.repository.js` | No day-bound queries |
| `features/user/user.repository.js` | No day-bound queries |
| `features/auth/auth.repository.js` | OTP expiry cutoff (not calendar day) |
| `features/testimonials/testimonials.repository.js` | No day-bound queries |
| `features/weight-progress-tips/data/weight-progress.repo.js` | No day-bound queries |
| `features/idle-cleanup/data/idle-repo.js` | Inactivity threshold (not calendar day) |

### Non-repository code (business logic / API routes — unchanged per requirement)
| File | Pattern | Why deferred |
|---|---|---|
| `utils/disciplineCalculationsSupabase.js` | `T00:00:00` / `T23:59:59` on CreatedAt | Protected business-logic module |
| `pages/api/leaderboard/get-discipline-leaderboard.js` | Inline date bounds in API route | Not a repository |
| `features/weight-progress-tips/api/check-progress.handler.js` | IST day-start math | API handler, not repository |
| `features/background-analysis/analysis.validators.js` | Date validation only | Validator, not repository |

---

## Timezone Parameter

Every migrated repository function accepts an optional final argument:

```javascript
timezoneIana = IANA_IST  // 'Asia/Kolkata'
```

Callers currently omit it (defaults to IST), preserving existing behaviour. Future phase: pass `user.timezone_iana` from profile.

---

## Tests

```
node --test backend/shared/lib/datetime/__tests__/datetime.test.js
ℹ tests 12 | pass 12 | fail 0
```

Covers `applyDayFilter` and `applyDateRangeFilter`.

---

## Review Checklist

- [ ] Confirm IST default preserves current query results against legacy `timestamp without time zone` columns
- [ ] Plan Phase 2: pass per-user `timezone_iana` from profile into repository callers
- [ ] Plan Phase 3: migrate `disciplineCalculationsSupabase.js` (requires `@principal-eng`)
- [ ] Plan column migration `timestamp without time zone` → `timestamptz` for full UTC correctness
