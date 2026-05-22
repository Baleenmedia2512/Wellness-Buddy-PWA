# Test Matrix — user

Reference: [claude.md §9.3](../../../../claude.md#93-feature-testing-matrix-template).

| Capability | Unit | Integration | E2E | Permissions | Edge cases |
|------------|------|-------------|-----|-------------|------------|
| Google sign-in button renders / forwards props | ✅ `LoginIntroPanel.test.js` | ⬜ | ⬜ | N/A | ✅ (loading, disabled, no-onSignIn, mobile notice) |
| Email sign-in button — navigate to email entry | ✅ `Login.test.js` | ⬜ | ⬜ | N/A | ✅ (hides intro panel after click) |
| OTP send (success / server error / network error) | ✅ `useAuthFlow.test.js` | ⬜ | ⬜ | N/A | ✅ (loading state, error messages) |
| OTP verify (success / invalid / network error) | ✅ `useAuthFlow.test.js` | ⬜ | ⬜ | N/A | ✅ (isNewUser, localStorage, 1.5s timeout) |
| OTP input — digit entry, paste, keypad, reset | ✅ `useOtpInput.test.js` | N/A | ⬜ | N/A | ✅ (non-digit ignored, overflow, empty backspace) |
| Resend countdown — decrement, canResend, start() | ✅ `useResendCountdown.test.js` | N/A | ⬜ | N/A | ✅ (active=false, start(0), reset) |
| Error display with role="alert" | ✅ `LoginIntroPanel.test.js` | ⬜ | ⬜ | N/A | ✅ (absent when empty) |
| Legal links (Terms / Privacy Policy) | ✅ `Login.test.js` | N/A | ⬜ | N/A | ⬜ |
| resetOtpScreen | ✅ `useAuthFlow.test.js` | N/A | N/A | N/A | ✅ (idempotent call) |

Legend: ✅ covered · ⚠️ partial · ❌ missing · ⬜ not yet assessed.

## User journeys (claude.md §9.4)

1. **New user email sign-in** — lands on intro → chooses email → types address → receives OTP → enters code → routed to onboarding.
2. **Returning user email sign-in** — same flow → routed to dashboard.
3. **Google sign-in (web)** — intro → clicks Google → popup completes → onSignIn callback fires.
4. **OTP resend** — user doesn't receive code → waits 60s → resend button unlocks → new code sent.
5. **Invalid OTP** — user enters wrong code → error shown → can retry or go back to email entry.

E2E tests: ⬜ not yet implemented (target: next sprint).

## Known gaps

- **Integration tests** — no supertest-level tests for `backend/features/auth/`. Deferred; auth routes are guarded and covered by existing E2E smoke tests.
- **E2E journeys** — all 5 journeys above need Playwright coverage (see `e2e/` folder).
- **LoginEmailEntry / LoginOtpEntry component tests** — not added in this pass; covered indirectly via hook tests. Target: next sprint.
