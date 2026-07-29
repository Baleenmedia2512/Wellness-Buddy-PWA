# User Timezone Support — Implementation Report

**Date:** 2026-07-21  
**Scope:** Profile read/write only — no business-logic changes  
**Status:** Ready for review

---

## Summary

Added `timezone_iana` to `team_table` with default `Asia/Kolkata`. Profile GET, POST, and PUT now read/write the user's timezone and always return `timezone` in the response (defaulting to `Asia/Kolkata` when unset).

---

## 1. Modified APIs

| Method | Route | Change |
|---|---|---|
| **GET** | `/api/user/profile?email=` | Response `data.timezone` added (always present, defaults to `Asia/Kolkata`) |
| **POST** | `/api/user/profile` | Accepts `timezone`, `timezoneIana`, or `timezone_iana` in body; response `data.timezone` always present |
| **PUT** | `/api/user/profile` | **New** — same handler as POST (update profile) |

### Request body (POST / PUT)

New optional field (any one alias):

```json
{
  "email": "user@example.com",
  "timezone": "America/New_York"
}
```

Aliases accepted: `timezone`, `timezoneIana`, `timezone_iana`

Validation uses `assertIanaTimezone()` from `shared/lib/datetime`. Invalid IANA zones return `400`.

Empty string clears to default: `Asia/Kolkata`.

### Response shape

**GET** `data` object — new field:

```json
{
  "timezone": "Asia/Kolkata"
}
```

**POST / PUT** `data` object — new field (always included):

```json
{
  "timezone": "Asia/Kolkata"
}
```

### APIs not modified

| Route | Reason |
|---|---|
| `/api/user/save-email` | Out of scope (not profile CRUD) |
| `/api/user/context` | Out of scope |
| `/api/user/google` | DB default handles new users |
| All discipline / activity / report APIs | Business logic unchanged per requirement |

---

## 2. Schema Changes

### Table: `team_table`

| Column | Type | Default | Nullable | Description |
|---|---|---|---|---|
| `timezone_iana` | `TEXT` | `'Asia/Kolkata'` | `NOT NULL` | IANA timezone identifier |

### Files changed (application layer)

| File | Change |
|---|---|
| `features/user/user.repository.js` | Select `timezone_iana` in `getProfile()` and `verifyProfile()` |
| `features/user/user.validators.js` | `validateTimezoneIana()`, timezone parsing in `validateUpdateProfile()` |
| `features/user/profile.service.js` | Read/write timezone; `timezone` in GET + POST/PUT responses |
| `features/user/domain/profileTimezone.js` | `resolveProfileTimezone()` — default fallback |
| `pages/api/user/profile.js` | Added `PUT` method; CORS allows `PUT` |

### Response field mapping

| DB column | API field | Default when null/empty |
|---|---|---|
| `timezone_iana` | `timezone` | `Asia/Kolkata` |

---

## 3. Migration SQL

**File:** `backend/migrations/add_timezone_iana_to_team_table.sql`

```sql
ALTER TABLE team_table
  ADD COLUMN IF NOT EXISTS timezone_iana TEXT NOT NULL DEFAULT 'Asia/Kolkata';

COMMENT ON COLUMN team_table.timezone_iana IS
  'IANA timezone identifier for the member (e.g. Asia/Kolkata). Used for calendar-day boundaries.';

UPDATE team_table
  SET timezone_iana = 'Asia/Kolkata'
  WHERE timezone_iana IS NULL;
```

**Apply:** Run against Supabase before deploying the backend changes. Requires `@principal-eng` + `@dba` review per governance policy.

---

## 4. Tests

**File:** `backend/features/user/__tests__/timezone.test.js`

```
node --test backend/features/user/__tests__/timezone.test.js
```

Covers:
- `resolveProfileTimezone()` default fallback
- `validateTimezoneIana()` valid/invalid/empty input
- `validateUpdateProfile()` alias handling (`timezone`, `timezoneIana`, `timezone_iana`)

---

## 5. Business Logic — Unchanged

No changes to:
- Discipline calculations
- Activity time windows
- Report date ranges
- IST helper functions
- Repository day-filter queries

Timezone is stored and returned on profile only. Downstream features will consume it in a future phase (e.g. `applyDayFilter()` with user timezone).

---

## 6. Review Checklist

- [ ] Approve migration SQL on production Supabase
- [ ] Confirm API field name `timezone` (camelCase) vs `timezone_iana` (snake_case) is acceptable to frontend
- [ ] Confirm PUT alias on same route as POST is acceptable
- [ ] Deploy migration before backend code
