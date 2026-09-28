# ADR-0013 — Community ID sponsor OTP (create + co-sponsor)

**Status:** Accepted  
**Date:** 2026-09-18  
**Owners:** @principal-eng  
**Flag:** `ff.community-id-otp`

## Context

Home → Profile already let a member type a Community ID and save it immediately (`POST /api/user/profile`). That assigned Sponsor / Co-Sponsor seats with no coach approval.

Product now needs:

1. Member types a Community ID they want to **create**. It is not confirmed until their **sponsor** (`team_table.CoachId`) approves a 24-hour OTP.
2. After confirmation they may share that code with a co-partner. When the co-partner enters the **same** Community ID, the co-partner's sponsor receives mail: this user is requesting to become co-sponsor **with {main sponsor name}**, plus an approval code.

## Decision

1. New table `community_id_requests_table` holds pending OTP hashes. `team_table.CommunityId` / `TeamId` / `CoachTeamId` and `coach_teams_table` seats are written **only after OTP verify**.
2. Approver is always the **requester's sponsor** (`CoachId`). Co-sponsor mail names the community's main sponsor (`coach_teams_table.CoachId` or first TeamId owner).
3. **Legacy (not breaking):** `appVersion < 3.5.0` or missing version still applies Community ID immediately on profile save (live 3.4.9). `3.5.0+` with the flag ON skips that apply and uses `POST /api/user/community-id/request` + `verify-otp`.
4. GET `/api/user/profile` may include additive `communityIdRequest` (pending). Old clients ignore it.
5. Confirmed Community ID can be changed from Profile via Change → new code → sponsor OTP again (previous lead seat is released on verify). Flag is a kill switch; version routing is the Play activation path.

### Legacy removal

Remove the profile-save apply path and this flag only after `APP_VERSION_MIN_REQUIRED ≥ 3.5.0` and no supported client still saves Community ID on profile POST. Verify no meaningful legacy traffic, then propose cleanup.

## Consequences

- Backend can ship before Play lists 3.5.0: live 3.4.9 binaries keep immediate save.
- New Profile UI must send `X-App-Version` `3.5.0+` and omit `communityId` from profile save.
- Requires the SQL migration before the new endpoints are used in an environment.
