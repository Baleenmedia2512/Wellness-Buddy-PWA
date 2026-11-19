# ADR-0006 — User Consent Gate

**Status:** Accepted  
**Date:** 2026-07-31  
**Owners:** @principal-eng, @security  
**Flag:** `ff.consent-gate`

## Context

Wellness Valley collects personal and health information. Account rows were previously created at OTP verify / Google save with no binding consent step. Legal copy now requires Agree / Do Not Agree before the product may be used, and declining must not create a user record.

## Amendment (signup checkbox)

New app versions ask **before** the account is created, on the mobile-number screen:

- Required checkbox: “By Signing up, I accept the Terms of Service and acknowledge the Privacy Policy.”
- Those words open the existing Terms and Privacy screens.
- OTP is blocked until the box is checked.
- `verify-otp` stores acceptance when the request includes `consentAccepted: true` and the current consent version. `consentRequired` is then false, so the long Agree / Don’t Agree page is not shown.
- Requests that omit acceptance (older apps) stay on the previous path: account created without consent, post-login form until `POST /api/user/consent`.

The post-login consent page is not shown. Acceptance on the signup screen is the only ask.

## Decision

**Enterprise order: identify → consent → use app.** For the current app, consent is the signup checkbox sent with OTP verify.

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
