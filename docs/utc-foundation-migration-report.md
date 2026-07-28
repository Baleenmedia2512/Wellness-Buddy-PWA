# UTC Foundation — Migration Report

**Date:** 2026-07-21  
**Phase:** Foundation only — repositories, APIs, and frontend **not migrated**  
**Status:** Ready for review

---

## Summary

This phase introduces a Luxon-backed shared datetime library under `backend/shared/lib/datetime/`, a reusable `applyDayFilter()` repository helper (created but **not wired**), deprecation markers on all legacy IST helpers, and replacement of **new timestamp generation** in services/API layers with `nowUtc()`.

Repositories continue to use legacy `getISTTimestamp()` and existing day-bound query conventions until the next migration phase.

---

## 1. Files Created

| File | Purpose |
|---|---|
| `backend/shared/lib/datetime/datetime.js` | Core UTC helpers (`nowUtc`, `toUtcRange`, etc.) |
| `backend/shared/lib/datetime/applyDayFilter.js` | Supabase day-filter helper (not used in repos yet) |
| `backend/shared/lib/datetime/index.js` | Barrel export |
| `backend/shared/lib/datetime/__tests__/datetime.test.js` | Unit tests (11 passing) |
| `docs/utc-foundation-migration-report.md` | This report |

### Dependency Added

| Package | Version | Location |
|---|---|---|
| `luxon` | `^3.7.2` | `backend/package.json` |

---

## 2. Helpers Created

Import from `backend/shared/lib/datetime/index.js` (or `@shared/lib/datetime` via jsconfig alias).

| Function | Signature | Description |
|---|---|---|
| `IANA_IST` | constant `'Asia/Kolkata'` | Default business timezone |
| `nowUtc()` | `() → string` | Current instant as ISO-8601 UTC (`…Z`) |
| `assertIanaTimezone()` | `(timezoneIana) → string` | Validates IANA zone; throws on invalid |
| `toUtcRange()` | `(dateYmd, timezoneIana) → { startUtc, endUtc }` | Single calendar day → UTC bounds |
| `toUtcRangeInclusive()` | `(startDate, endDate, timezoneIana) → { startUtc, endUtc }` | Inclusive date range → UTC bounds |
| `todayInTimezone()` | `(timezoneIana) → string` | Today's `YYYY-MM-DD` in given zone |
| `formatUtcForDisplay()` | `(utcTimestamp, timezoneIana?, format?) → string` | UTC → local display string |
| `addUtcDays()` | `(utcIso, days) → string` | Add days to a UTC instant (utility) |
| `applyDayFilter()` | `(query, column, dateYmd, timezoneIana) → query` | Chains `.gte`/`.lte` on Supabase builder |

### Example Usage (next phase)

```javascript
import { nowUtc, toUtcRange, todayInTimezone, applyDayFilter, IANA_IST } from '../../shared/lib/datetime/index.js';

const createdAt = nowUtc();
const today = todayInTimezone(IANA_IST);
const { startUtc, endUtc } = toUtcRange('2026-07-21', IANA_IST);

// Repository (future):
let q = supabase.from('food_nutrition_data_table').select('*').eq('UserID', userId);
q = applyDayFilter(q, 'CreatedAt', today, IANA_IST);
```

---

## 3. Deprecated IST Helpers

All helpers below are **retained** (not deleted) and marked `@deprecated` with a pointer to this report.

### Canonical (backend/utils)

| Helper | File | Replacement |
|---|---|---|
| `getISTTimestamp()` | `utils/supabaseClient.js` | `nowUtc()` (after column migration to `timestamptz`) |
| `convertToIST()` | `utils/supabaseClient.js` | `formatUtcForDisplay()` + UTC storage |
| `convertISTToUserLocalTime()` | `utils/timezoneConverter.js` | `formatUtcForDisplay()` with IANA zones |
| `getTimezoneInfo()` | `utils/timezoneConverter.js` | IANA zones via `assertIanaTimezone()` |
| `parseDateRange()` | `utils/disciplineHelpers.js` | `toUtcRangeInclusive()` |
| `parseDateRangeIST()` | `utils/timeReportHelpers.js` | `toUtcRangeInclusive()` |
| `formatDateIST()` | `utils/timeReportHelpers.js` | `todayInTimezone()` / `formatUtcForDisplay()` |
| `convertISTToLocalDate()` | `utils/timeReportHelpers.js` | `formatUtcForDisplay()` with IANA zones |

### Feature-local duplicates

| Helper | File | Replacement |
|---|---|---|
| `todayInIST()` | `features/water/validation/intake.schema.js` | `todayInTimezone('Asia/Kolkata')` |
| `todayInIST()` | `features/wellness-score/validation/wellness-score.schema.js` | `todayInTimezone('Asia/Kolkata')` |
| `getISTDateStr()` (private) | `features/weight/weight.service.js` | `formatUtcForDisplay()` |
| `getServerTime()` (inline IST offset) | `features/misc/misc.service.js` | `todayInTimezone('Asia/Kolkata')` |

### Inline IST patterns (comment-marked `@deprecated`)

| Location | Pattern |
|---|---|
| `pages/api/leaderboard/get-global-leaderboard.js` | `IST_OFFSET_MS`, `toISTString()` |
| `features/background-analysis/analysis.validators.js` | `Date.now() + 330 * 60 * 1000` for "today IST" |

### Frontend (not modified — listed for completeness)

| Helper | File | Replacement (future) |
|---|---|---|
| `todayDateInIST()` | `frontend/src/shared/utils/timezoneUtils.js` | Frontend Luxon equivalent of `todayInTimezone()` |

### Not found in backend

| Helper | Status |
|---|---|
| `todayDateInIST()` | Frontend only |
| `todayInIST()` in `timezoneConverter.js` | Never existed; duplicated in validation schemas |

---

## 4. `nowUtc()` Replacements (non-repository)

These files were updated to use `nowUtc()` / `addUtcDays()` instead of `new Date().toISOString()` for **new timestamp generation**:

| File | Change |
|---|---|
| `utils/timestampUtils.js` | Fallback paths use `nowUtc()` |
| `features/weight/weight.service.js` | Response `timestamp` field |
| `features/background-analysis/analysis.service.js` | Response `timestamp`, `shareExpiresAt` (+30 days) |
| `features/user/profile.service.js` | Snooze `until` (+1 day) |
| `pages/api/cron/reactivate-user.js` | Log `timestamp` |
| `pages/api/cron/deactivate-idle-users.js` | Log `timestamp` |
| `pages/api/leaderboard/get-global-leaderboard.js` | Response `calculatedAt` |
| `pages/api/upline/request.js` | `ProcessedAt`, cancel `now` |

### Intentionally unchanged

| Category | Reason |
|---|---|
| All `*.repository.js` / `*.repo.js` files | Repository migration deferred |
| `getISTTimestamp()` call sites (~30) | Legacy IST plain-string columns; migrated in next phase |
| `Date.now()` for latency/correlation IDs | Not business timestamp generation |
| `utils/dbPool.js` log line | Diagnostic logging only |
| `nutrition-centers/centers.service.js` UTC date slice | Date extraction (not timestamp); separate migration |
| `activity.validators.js` default date | Date default (not timestamp); separate migration |
| Frontend | Explicitly out of scope |

---

## 5. Repository Status — No Changes

The following repository patterns remain **untouched**:

### Timestamp writes still using legacy helpers

| Pattern | Example files |
|---|---|
| `getISTTimestamp()` for `CreatedAt`/`UpdatedAt` | `weight.repository.js`, `analysis.repository.js`, `wellness-score.repo.js`, `card.repo.js`, `testimonials.repository.js`, etc. |
| `new Date().toISOString()` for `timestamptz` columns | `captures.repository.js` (4 sites), `weight-progress.repo.js` (2 sites) |

### Day-filter query conventions (unchanged)

| Convention | Example files |
|---|---|
| Naive `T00:00:00` / `T23:59:59` bounds | `food-corrections.repository.js`, `water.repo.js`, `diary.repository.js` |
| `+05:30` offset bounds | `activity.repository.js`, `diary.repository.js` |
| IST date-range helpers | `disciplineHelpers.js`, `timeReportHelpers.js` |

### `applyDayFilter()` — created, not wired

No repository imports or uses `applyDayFilter()` yet.

---

## 6. API & Frontend Status — No Changes

- No API route business logic migrated to UTC day bounds
- No handler signature changes
- No frontend `timezoneUtils.js` changes
- No database migrations

---

## 7. Test Results

```
node --test backend/shared/lib/datetime/__tests__/datetime.test.js
ℹ tests 11 | pass 11 | fail 0
```

---

## 8. Recommended Next Phase (after review)

1. **Repository migration** — replace per-table day-bound conventions with `applyDayFilter()` + `toUtcRange()`
2. **Column migration** — `timestamp without time zone` (IST plain strings) → `timestamptz` (UTC)
3. **Replace `getISTTimestamp()`** call sites with `nowUtc()` once columns are `timestamptz`
4. **Centralize `todayInIST()`** — remove duplicates; use `todayInTimezone(IANA_IST)`
5. **Frontend** — add Luxon + mirror `shared/lib/datetime` API in `frontend/src/shared/utils/`
6. **Remove deprecated helpers** after 90-day rollout per feature-flag policy

---

## 9. Review Checklist

- [ ] Approve Luxon dependency in backend
- [ ] Approve `shared/lib/datetime/` API surface
- [ ] Approve deprecation strategy (JSDoc, no deletions)
- [ ] Confirm repository migration can proceed as Phase 2
- [ ] Confirm `timestamptz` migration plan for legacy IST columns
