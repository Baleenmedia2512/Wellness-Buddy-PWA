# ADR-0016 — Community Position coach OTP

**Status:** Accepted  
**Date:** 2026-11-11  
**Owners:** @principal-eng  
**Flag:** `ff.community-position-otp`

## Context

Profile stored Community Position inside Event registration details and saved it immediately with the rest of the profile. The role should sit under Community ID, and a change should be confirmed the same way as Community ID: the member chooses a role, the coach receives a 24-hour code, and the role is saved only after the member enters that code.

## Decision

1. Community Position is rendered directly under Community ID on Profile. The event box keeps Translation and Your City only.
2. Choosing a role does not email anyone. **Send verification code** emails the member's coach (`CoachId`). The role is written to `team_table.EventLevel` only after OTP verify.
3. Roles come from `community_positions_table`. The nine released codes stay as the fallback list. New roles are catalog rows, not new hard-coded options.
4. **Legacy (not breaking):** `appVersion < 3.5.6` or a missing version still applies `eventLevel` on profile POST. `3.5.6+` with the flag ON ignores that field and uses `POST /api/user/community-position/request` and `verify-otp`. This web build sends the OTP path whenever the flag is on, and omits `eventLevel` from profile save.
5. GET `/api/user/profile` may include additive `communityPosition` and `communityPositionRequest`. Old clients ignore them.
6. The flag is a kill switch. Version routing is the Play activation path. This change does not bump the app version.

### Legacy removal

Remove the profile-save apply path only after `APP_VERSION_MIN_REQUIRED ≥ 3.5.6` and no supported client still saves Community Position on profile POST. Verify no meaningful legacy traffic, then propose cleanup.

## Consequences

- Backend can ship before Play lists 3.5.6: released apps that still send `eventLevel` keep the immediate save.
- Requires `backend/migrations/create_community_positions.sql` before the new endpoints are used.
