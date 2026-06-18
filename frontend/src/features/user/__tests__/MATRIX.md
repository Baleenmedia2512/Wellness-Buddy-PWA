# Test Matrix — user

Reference: [claude.md §9.3](../../../../claude.md#93-feature-testing-matrix-template).

| Capability | Unit | Integration | E2E | Permissions | Edge cases |
|------------|------|-------------|-----|-------------|------------|
| Email/mobile entry shown immediately (no intro panel) | ✅ `Login.test.js` | ⬜ | ⬜ | N/A | ✅ (no "Continue with Email" gate) |
| Send OTP (success / server error / network error) | ✅ `useAuthFlow.test.js` | ⬜ | ⬜ | N/A | ✅ (loading state, error messages) |
| OTP verify (success / invalid / network error) | ✅ `useAuthFlow.test.js` | ⬜ | ⬜ | N/A | ✅ (isNewUser, localStorage, 1.5s timeout) |
| OTP input — digit entry, paste, keypad, reset, fillAll | ✅ `useOtpInput.test.js` | N/A | ⬜ | N/A | ✅ (non-digit ignored, overflow, empty backspace, partial fill) |
| WebOTP auto-read (Android SMS Retriever equiv.) | ✅ `useWebOtp.test.js` | N/A | ⬜ | N/A | ✅ (abort, NotSupported, null credential, empty code) |
| iOS autofill — multi-char onChange fills all cells | ✅ `useOtpInput.test.js` (fillAll) | N/A | ⬜ | N/A | ✅ (strip non-digits, truncate overflow) |
| Auto-verify when OTP complete — no button click | ✅ `useAuthFlow.test.js` | ⬜ | ⬜ | N/A | ✅ (all paths: web onChange, keypad, paste) |
| Resend countdown — decrement, canResend, start() | ✅ `useResendCountdown.test.js` | N/A | ⬜ | N/A | ✅ (active=false, start(0), reset) |
| Legal links (Terms / Privacy Policy) | ✅ `Login.test.js` | N/A | ⬜ | N/A | ⬜ |
| resetOtpScreen | ✅ `useAuthFlow.test.js` | N/A | N/A | N/A | ✅ (idempotent call) |
| CompleteProfilePage — form render when fields missing | ✅ `CompleteProfilePage.test.js` | ⬜ | ⬜ | N/A | ✅ (all-missing, all-present → onComplete) |
| CompleteProfilePage — form validation | ✅ `CompleteProfilePage.test.js` | ⬜ | ⬜ | N/A | ✅ (disabled until valid, height out-of-range) |
| CompleteProfilePage — picture section visibility | ✅ `CompleteProfilePage.test.js` | ⬜ | ⬜ | N/A | ✅ (hidden by default, shown with prop) |
| CompleteProfilePage — camera/gallery race condition | ✅ `CompleteProfilePage.test.js` | ⬜ | ⬜ | N/A | ✅ (unmount-remount clears form; App.js guard prevents unmount) |

Legend: ✅ covered · ⚠️ partial · ❌ missing · ⬜ not yet assessed.

## User journeys (claude.md §9.4)

1. **New user phone sign-in** — enters mobile number → OTP sent via SMS → Android auto-reads via WebOTP / iOS autofill suggestion → OTP auto-verified → routed to onboarding.
2. **New user email sign-in** — enters email → receives OTP → pastes / types code → auto-verified → routed to onboarding.
3. **Returning user sign-in** — same as above → routed to dashboard.
4. **OTP resend** — user doesn't receive code → waits 60s → resend button unlocks → new code sent.
5. **Invalid OTP** — wrong code entered → error shown → can resend or go back to entry step.

E2E tests: ⬜ not yet implemented (target: next sprint).

## Known gaps

- **Integration tests** — no supertest-level tests for `backend/features/auth/`. Deferred; auth routes are guarded and covered by existing E2E smoke tests.
- **E2E journeys** — all 5 journeys above need Playwright coverage (see `e2e/` folder).
- **LoginEmailEntry / LoginOtpEntry component tests** — covered indirectly via hook tests. Target: next sprint.
- **WebOTP + DLT SMS**: The MDT DLT-approved template is fixed and does not contain the `@<domain> #<code>` line required by the WebOTP API. WebOTP will silently no-op until the SMS provider supports the format. iOS autofill via `autoComplete="one-time-code"` works regardless.
