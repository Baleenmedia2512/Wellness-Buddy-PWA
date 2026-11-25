# ADR-0018 — Unified profile-change sponsor OTP on Save

**Status:** Accepted  
**Date:** 2026-11-24  
**Owners:** @principal-eng  
**Flag:** `ff.profile-change-sponsor-otp`

## Context

Profile already had separate coach/sponsor OTP flows for height, Community ID, and Community Position (plus self email KYC). Product needs one approval model:

1. First fill of a gated field (empty → value) saves with no OTP.
2. Later changes to gated fields require coach (`CoachId`) approval.
3. OTP is requested only when the member taps **Save** (or Save Photo for an existing avatar).
4. Multiple gated changes in one Save share **one** OTP.

Gated fields: phone, height, health issues, community ID, community position, event translation languages, professional title, date of joining, about me, qualification, profile photo. Email remains on self-ownership KYC for now (proving the new address); sponsor gate for email can be added later without changing this ADR’s Save batch pattern.

## Decision

1. New table `profile_change_requests_table` stores `PendingPayload` JSON + OTP hash (24h, max 5 attempts).
2. APIs: `POST /api/user/profile-change/request-otp` and `verify-otp`.
3. **Version routing (§5.1):**
   - `appVersion < 3.5.8` or missing → legacy (per-field OTP / immediate save).
   - `appVersion >= 3.5.8` with flag ON → unified Save OTP; per-field height/Community ID/position OTP UIs are disabled.
4. On `POST /api/user/profile` for 3.5.8+: first fills apply; locked-field **changes** are stripped and require the unified OTP. Response may include `needsProfileChangeOtp` / `deferredProfileChangeKeys`.
5. Flag is a kill switch; Play activation is automatic via `X-App-Version` `3.5.8+`.

### Legacy removal

Remove per-field height / community-id / community-position OTP paths only after `APP_VERSION_MIN_REQUIRED ≥ 3.5.8`, no supported client still uses those endpoints, and unified traffic is verified. Propose cleanup for human review — do not auto-delete by date.

## Consequences

- Backend can ship before Play lists 3.5.8; older binaries keep current behaviour.
- Community ID **first create** on 3.5.8+ is free (product change vs ADR-0013 for this version line only); later Community ID changes use the unified OTP.
- Large `profileImage` payloads use the same 10mb profile body limit on request-otp.
