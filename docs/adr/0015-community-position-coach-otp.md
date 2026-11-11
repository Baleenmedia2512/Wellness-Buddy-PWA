# ADR-0015 — Community Position coach OTP

**Status:** Accepted
**Date:** 2026-11-11
**Owners:** @principal-eng
**Flag:** `ff.community-position-otp`

## Context

Profile stored Community Position inside event registration details as a fixed list (`PC`, `ASSOCIATE`, `SV`, and the rest) and saved it immediately on profile POST (`team_table.EventLevel`).

The position is a profile role. Each role is used by a different feature, and new roles must be addable without a code change. Taking a role needs the member's coach to approve, the same way Community ID does.

## Decision

1. `community_positions_table` is the catalog. Each row has a stable `Code`, a display `Label`, a unique `FeatureKey`, and a `UsageNote`. Features check `featureKey`. Add or change a role with an `INSERT` or `UPDATE` on that table.
2. `community_position_requests_table` holds the 24-hour OTP hash. The approver is the member's coach (`team_table.CoachId`). `EventLevel` is written only after the member enters the code the coach shares.
3. **Legacy (not breaking):** `appVersion < 3.5.6` or a missing version still applies Community Position on profile save, and only the original nine codes are accepted there. `3.5.6+` with the flag ON ignores `eventLevel` on profile POST and uses `POST /api/user/community-position/request` plus `verify-otp`.
4. GET `/api/user/profile` adds `communityPosition` and `communityPositionRequest`. Old clients ignore them and still read `eventLevel`.
5. Event registration accepts any active catalog code. If the catalog table is missing, it keeps the original nine codes.
6. The flag is a kill switch. Version routing is what turns the OTP path on. No manual flag step after Play approval.

### Legacy removal

Remove the profile-save apply path and this flag only after `APP_VERSION_MIN_REQUIRED ≥ 3.5.6` and no supported client still saves Community Position on profile POST. Verify no meaningful legacy traffic, then propose cleanup.

## Consequences

- Backend can ship before Play lists 3.5.6. Released 3.5.5 binaries keep immediate save of the original list.
- This client sends `X-App-Version` `3.5.6` and omits `eventLevel` from profile save while the flag is on.
- Run `backend/migrations/create_community_positions.sql` before the new endpoints are used in an environment.
