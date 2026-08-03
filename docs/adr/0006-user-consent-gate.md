# ADR-0006 — User Consent Gate

**Status:** Accepted  
**Date:** 2026-07-31  
**Owners:** @principal-eng, @security  
**Flag:** `ff.consent-gate`

## Context

Wellness Valley collects personal and health information. Account rows were previously created at OTP verify / Google save with no binding consent step. Legal copy now requires Agree / Do Not Agree before the product may be used, and declining must not create a user record.

## Decision

**Enterprise order: identify → consent → use app.**

1. Phone / OTP (or Google) first — create or find `team_table` user so identity is known (`UserId` + phone/email).
2. If `ConsentAcceptedAt` is null, block the app with the Consent Form showing **Signed in as &lt;phone/email&gt;**.
3. **I Agree** → `POST /api/user/consent` stamps `ConsentAcceptedAt`, `ConsentVersion`, `ConsentIpAddress`, `ConsentDeviceInfo` on that `UserId`.
4. **I Do Not Agree** → `DELETE /api/user/consent` removes the account **only if** consent was never recorded; then sign out. Already-consented users cannot be discarded this way.
5. Logout after consent does **not** re-prompt; only missing DB consent prompts again.
6. Never trust a client-posted IP — extract on the API route from `x-forwarded-for` / `x-real-ip` / socket.

## Consequences

- Cross-feature: `auth` (OTP) + `user` (Google, profile, consent API) + Login UI
- Migration required before enabling in production
- Coach-provisioned leads still get a row from BPC; those members must accept at first login
