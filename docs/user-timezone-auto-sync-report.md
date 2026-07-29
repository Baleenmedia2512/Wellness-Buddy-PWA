# User Timezone Auto-Sync — Implementation Report

**Date:** 2026-07-20  
**Scope:** Detect device IANA timezone on the client; sync `team_table.timezone_iana` on authentication. No repository filter / UTC / business-logic changes.

---

## Authentication flow used

The app uses **Firebase Authentication** on the client plus backend user provisioning:

| Step | Flow | Timezone sync hook |
|---|---|---|
| **OTP login** | `POST /api/auth/verify-otp` → Firebase sign-in → `handleOtpVerified` | `verifyOtp` service syncs after OTP success |
| **Google sign-in** | Firebase popup/redirect → `POST /api/user/google` (`saveUserToBackend`) | `saveGoogleUser` syncs after user resolve/create |
| **App startup / auto-login** | Firebase `onAuthStateChanged` → `getUserId` / `checkUserStatus` → `POST /api/user/lookup` | `lookupUser` syncs on successful lookup |
| **Session validation** | Same as startup — lookup runs when auth state restores | Same |
| **Profile fetch** | `GET /api/user/profile` | **Not modified** (read-only; sync happens on auth paths above) |

There is no separate refresh-token backend endpoint; Firebase handles token refresh client-side. Lookup on each authenticated session covers returning users.

---

## Frontend files modified

| File | Change |
|---|---|
| `frontend/src/shared/utils/deviceTimezone.js` | **New** — `getDeviceTimezoneIana()` via `Intl.DateTimeFormat().resolvedOptions().timeZone` |
| `frontend/src/features/user/services/authService.js` | Sends `timezoneIana` on `verify-otp` |
| `frontend/src/features/auth/services/auth.api.js` | Sends `timezoneIana` on `verify-otp` |
| `frontend/src/shared/services/auth/userSetup.js` | Sends `timezoneIana` on `POST /api/user/lookup` (`fetchUserStatus`) |
| `frontend/src/shared/services/getUserId.js` | Sends `timezoneIana` on lookup (auth warm-start) |
| `frontend/src/features/user/services/user.api.js` | Sends `timezoneIana` on lookup + Google sign-in |
| `frontend/src/App.js` | Sends `timezoneIana` in `saveUserToBackend` (Google flow) |

No timezone is hardcoded on the frontend. When `Intl` is unavailable, an empty string is sent and the backend falls back to `Asia/Kolkata`.

---

## Backend files modified

| File | Change |
|---|---|
| `backend/features/user/domain/deviceTimezone.js` | **New** — `resolveDeviceTimezoneIana()`, `hasDeviceTimezoneInput()` |
| `backend/features/user/timezone-sync.service.js` | **New** — `syncUserTimezoneIfChanged()` |
| `backend/features/auth/auth.validators.js` | Accept optional `timezoneIana` on verify-otp |
| `backend/features/auth/auth.service.js` | Sync after OTP verify (including demo accounts) |
| `backend/features/user/user.validators.js` | Accept optional `timezoneIana` on lookup + Google |
| `backend/features/user/google-auth.service.js` | Sync after Google user resolve/create |
| `backend/features/user/lookup.service.js` | Sync after successful lookup |
| `backend/features/user/user.service.js` | Re-export `syncUserTimezoneIfChanged` |
| `backend/features/user/__tests__/deviceTimezone.test.js` | **New** — unit tests |

**Not modified:** repositories, `applyDayFilter`, discipline/weight/nutrition business logic, `CreatedAt` / `UpdatedAt` on any table.

---

## APIs changed

| Endpoint | Method | New optional field | Behaviour |
|---|---|---|---|
| `/api/auth/verify-otp` | POST | `timezoneIana` | Sync after successful OTP |
| `/api/user/google` | POST | `timezoneIana` | Sync after user found/created |
| `/api/user/lookup` | GET/POST | `timezoneIana` (query or body) | Sync after successful lookup |

No new endpoints. No breaking changes — field is optional; existing clients continue to work (no sync when field omitted).

---

## Validation added

| Layer | Rule |
|---|---|
| `resolveDeviceTimezoneIana()` | Uses existing `assertIanaTimezone()`; invalid or empty → `Asia/Kolkata` |
| `hasDeviceTimezoneInput()` | Sync runs only when client sends the field (including `""`) |
| Compare before write | `resolveProfileTimezone(stored)` vs resolved device TZ; skip update when equal |

Invalid values are **not** rejected with HTTP 400 — they fall back to `Asia/Kolkata` per requirements.

---

## Database updates performed

On sync when values differ:

```sql
UPDATE team_table
SET timezone_iana = @resolvedIana
WHERE "UserId" = @userId;
```

- Only `timezone_iana` is updated.
- `CreatedAt`, `UpdatedAt`, `LastActiveAt`, and all other columns are untouched.
- No-op when effective stored timezone already matches device timezone.

---

## Logging

When timezone actually changes:

```
[INFO] User timezone changed {"userId":123,"from":"Asia/Kolkata","to":"America/New_York"}
```

No log when values match (including repeated auth/lookup calls).

---

## Acceptance criteria

| Criterion | Status |
|---|---|
| Existing `Asia/Kolkata` users auto-switch to real TZ on next login | ✅ |
| Indian users remain `Asia/Kolkata` | ✅ (device reports `Asia/Kolkata`) |
| US users → `America/New_York`, `America/Chicago`, etc. | ✅ |
| UK users → `Europe/London` | ✅ |
| Australia → `Australia/Sydney` | ✅ |
| No repository changes | ✅ |
| No UTC filtering changes | ✅ |
| No business logic changes | ✅ |

---

## Testing checklist

### Automated

- [ ] `node --test backend/features/user/__tests__/deviceTimezone.test.js`
- [ ] `node --test backend/features/user/__tests__/timezone.test.js`

### Manual

- [ ] OTP login from US browser — `team_table.timezone_iana` updates from default to `America/*`
- [ ] Google sign-in from UK — updates to `Europe/London`
- [ ] Indian user login — remains `Asia/Kolkata`, no spurious log
- [ ] App reopen (Firebase session restore) — lookup syncs if device TZ changed (e.g. travel)
- [ ] Invalid `timezoneIana` in request — stores `Asia/Kolkata`, no 400 error
- [ ] Verify discipline/meal day boundaries unchanged for a synced user

---

## Review note

This phase is **ready for review**. No further phases were started per instruction to wait before continuing.
