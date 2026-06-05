<!-- Draft PR description — copy into GitHub PR body when opening -->

## Summary
Adds phone-number login/signup alongside email. The existing single text box now accepts either an email or a phone number; we auto-detect the contact type, show a country-dial dropdown when a number is entered, send the OTP via Firebase Phone Auth (SMS) for phones or via the existing email transport for emails, and verify both through the same OTP screen. The backend exchanges the Firebase ID token for our standard session and creates the user on first login.

## Ticket / Issue
Closes #<TBD>

## Type
- [x] feat
- [ ] fix
- [ ] refactor
- [ ] perf
- [ ] test
- [ ] docs
- [ ] chore
- [ ] sec
- [ ] infra

## Scope (feature folder)
`backend/features/auth`, `frontend/src/features/user`

---

## Pre-Edit Checklist (claude.md §4.1)
- [x] I read the entire target file(s) end-to-end.
- [x] I reviewed `git log -p` for the last 5 changes to the touched files.
- [x] I found all callers of every modified export (`findUserByPhone`, `firebasePhoneLogin`, `useAuthFlow`).
- [x] I confirmed no equivalent helper already exists — there was no contact-type detector, no phone normaliser, and no Firebase admin wrapper.
- [x] Minimum change: reuse the same OTP screen / session shape; only add a phone branch and one new endpoint.

## A.R.E.R.V.T Workflow (claude.md §4.2)
- **Analyze:** `useAuthFlow.sendOtp` previously called `/api/auth/send-otp` unconditionally with an email; `LoginEmailEntry` rendered a single email input; `auth.service.js` had `sendOtp` / `verifyOtp` for email only.
- **Reuse:** Existing OTP screen (`LoginOtpEntry`), session shape returned by `verifyOtp`, `runService` wrapper, `team_table` user repo, `nodemailer` transport — all reused. The existing `autoComplete="one-time-code"` attribute on the OTP field already handles iOS/Android auto-fill.
- **Extend / new:** Extended `useAuthFlow` with a phone branch (channel state + Firebase confirmation ref). New domain helpers (`contactIdentifier.js` mirrored on both sides), new Firebase admin wrapper, new endpoint `/api/auth/firebase-phone-login`, new repo method `findUserByPhone`, new `phoneAuthService` on the client.
- **Refactor:** None — behaviour-preserving for the email path.
- **Validate:** Backend `auth|firebase` suite **37/37 passing**; frontend `contactIdentifier` + `useAuthFlow` suites passing. Pre-existing failures in `Login.test.js` / `LoginIntroPanel.test.js` reproduced on baseline (`git stash`) — not introduced by this PR.
- **Test:** Added
  - `backend/features/auth/__tests__/contactIdentifier.test.js`
  - `backend/features/auth/__tests__/firebasePhoneLogin.validators.test.js`
  - `backend/features/auth/__tests__/firebasePhoneLogin.service.test.js`
  - `frontend/src/features/user/__tests__/contactIdentifier.test.js`
  - Extended `frontend/src/features/user/__tests__/useAuthFlow.test.js` with `setEmail` calls.

---

## Business Logic Impact (claude.md §3.3)
- **Why changed:** Users on shared devices / coaches in the field don't always have an email — we need phone-number login so onboarding doesn't get blocked.
- **Rules changed:**
  - A user identifier is now `email` OR `phone (E.164)` — detected by `detectContactType()` in `domain/contactIdentifier.js`.
  - Phone OTP is delegated to Firebase (we don't issue/persist the SMS OTP); email OTP path is unchanged.
  - A user created via phone is assigned a synthetic username `user_<digits>` if no name is supplied.
  - `team_table.Phone` is unique (partial index excluding NULLs) — one account per phone number.
- **Side effects:** First-time phone login auto-creates a `team_table` row (mirrors the email flow).
- **Modules impacted:** `backend/features/auth/*`, `frontend/src/features/user/*`. No other feature folder reads the auth response shape differently.
- **Backward compatibility:** [x] Yes — email flow unchanged, session response shape unchanged, all existing API routes intact.
- **Edge cases considered:**
  1. Empty input → validation rejects before any network call.
  2. Phone digits typed with spaces / hyphens / leading 0 → `normalizePhone()` strips and prepends dial code.
  3. Existing email user adds phone later → still resolved by `findUserByEmail`; phone path creates a separate user only if no phone match.
  4. Firebase token revoked / expired → `verifyFirebaseIdToken(checkRevoked=true)` throws → 401.
  5. Firebase decoded token missing `phone_number` claim → service returns 400 (defensive).
  6. Two users racing on the same phone number → unique partial index on `"Phone"` prevents duplicates.
  7. Recaptcha verifier reused across attempts → `resetPhoneAuth()` clears the singleton + DOM container.
- **Tests added:** see paths in A.R.E.R.V.T → Test above.

---

## Architecture Impact (claude.md §2)
- [x] No new top-level folder.
- [x] No new cross-feature import (helpers live inside each side's own `domain/`).
- [x] No new circular dependency.
- [x] No file exceeds 400 LOC.
- [x] Naming conventions followed.

## API Impact
- [x] Backward-compatible additive change.
- Endpoints touched: **new** `POST /api/auth/firebase-phone-login` → `{ ok, data: { token, user } }`.

## Database / Migration Impact
- [x] New migration: `backend/migrations/0012_add_phone_to_team_table.sql`
- [x] Forward-only.
- [ ] Dry-run output on staging clone attached — **TODO before merge**.
- [x] RLS — `team_table` RLS unchanged (no new table); existing policies cover the new column.
- **Compensating migration plan:** if rollback is required, add `0013_drop_phone_from_team_table.sql` that drops the unique index then the column.

## Security Impact (claude.md §8)
- [x] Auth/authz change — **`@security` review requested**.
- [x] No new secrets in code. New env vars: `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` (Vercel encrypted; `\n` rehydrated at runtime).
- [x] No PII logged — only the masked recipient flows through the existing logger.
- [x] Rate limit: endpoint inherits the global `/api/auth/*` limit; recommend confirming `shared/lib/rate-limit.js` covers the new route before merge.
- [x] Inputs validated via `validateFirebasePhoneLogin` (idToken string, ≥20 chars, trimmed/capped name).
- Notes: `verifyFirebaseIdToken` runs with `checkRevoked=true`; phone uniqueness enforced at DB level.

## Dependency Impact
- [x] New dependency justified:
  - **`firebase-admin@^12.7.0`** (backend) — Google-maintained, Apache-2.0, required to verify Firebase ID tokens server-side. No alternative without re-implementing JWKS verification.
  - **`firebase@^11.10.0`** (frontend) — already present.
- [x] `npm audit` clean for the new package at install time.

## Regression Risk
- **Risk level:** Medium (auth surface).
- **Mitigations:** email path code paths untouched at the API/service boundary; added unit tests for the new service; existing email tests still pass; feature is additive.
- **Impacted features re-tested:** `backend/features/auth` full suite (37/37). Frontend `useAuthFlow` + `contactIdentifier`.

---

## Testing Evidence (claude.md §9)
- [x] Unit tests pass locally (backend auth, frontend domain + hook).
- [x] Integration tests pass locally (backend service tests mock Firebase admin + repo).
- [ ] Coverage for changed files ≥ floor — **TODO: run `npm run test -- --coverage` and paste delta before merge**.
- [ ] `__tests__/MATRIX.md` updated for `auth` — **TODO before merge**.
- [ ] E2E impact: add a phone-login journey under `e2e/journeys/auth/` — **TODO**.

```
backend: Test Suites: 4 passed, 4 total | Tests: 37 passed, 37 total (auth|firebase pattern)
frontend: contactIdentifier ✓  useAuthFlow ✓
```

---

## AI Assistance Disclosure (claude.md §5)
- [x] AI-assisted — tool: `copilot` (Claude Opus 4.7).
- [x] Hallucination checklist completed (§5.2): imports resolve, `firebase-admin` installed, env vars listed in deployment notes below, DB column added via migration, route registered under `pages/api/auth/`.
- [x] Confidence score per file:
  - `backend/features/auth/domain/contactIdentifier.js` — **95** (pure, fully tested)
  - `backend/features/auth/firebaseAdmin.js` — **90** (standard admin init pattern)
  - `backend/features/auth/auth.repository.js` (`findUserByPhone`) — **92**
  - `backend/features/auth/auth.validators.js` (`validateFirebasePhoneLogin`) — **95**
  - `backend/features/auth/auth.service.js` (`firebasePhoneLogin`) — **88** (mirrors existing email service)
  - `backend/pages/api/auth/firebase-phone-login.js` — **95**
  - `backend/migrations/0012_add_phone_to_team_table.sql` — **90**
  - `frontend/src/features/user/domain/contactIdentifier.js` — **95**
  - `frontend/src/features/user/services/phoneAuthService.js` — **85** (recaptcha lifecycle on web is the riskiest piece)
  - `frontend/src/features/user/hooks/useAuthFlow.js` — **88**
  - `frontend/src/features/user/components/login/LoginEmailEntry.js` — **90**
  - `frontend/src/features/user/components/Login.js` — **92**
- [x] Files flagged "unsafe edit" (§5.4): `backend/features/auth/*` and a migration — **explicit human approval obtained** in the request; `@principal-eng` review still required per §6.3.

## Reviewer Routing (claude.md §6.3)
- Feature owner: `@auth-owner` (`backend/features/auth`)
- Additional required approvers: `@principal-eng`, `@security`, `@dba` (for the migration).

## Post-Merge Actions
- [x] CHANGELOG entry: `feat(auth): add phone-number login via Firebase Phone Auth`
- [ ] No feature flag — this is a permanent capability. (Consider gating behind `ff.auth.phone-login` if a staged rollout is preferred — flag scaffolding not added.)
- [ ] Docs updated: add a section to `backend/features/auth/README.md` describing the phone path and env vars.
- [x] Smoke test will be run on the deploy (login with email + login with a Firebase test phone number).

---

## Deployment Notes (must complete before promoting to prod)

1. **Install backend dep** (already done locally): `cd backend && npm install`.
2. **Apply migration** `0012_add_phone_to_team_table.sql` to staging, verify, then prod.
3. **Vercel env vars** (backend project):
   - `FIREBASE_PROJECT_ID` = service account `project_id`
   - `FIREBASE_CLIENT_EMAIL` = service account `client_email`
   - `FIREBASE_PRIVATE_KEY` = service account `private_key` (paste with literal `\n`; code rehydrates)
4. **Firebase Console**:
   - Authentication → Sign-in method → **enable Phone**.
   - Authentication → Settings → **Authorized domains**: add prod + staging hostnames.
   - Project Settings → Android app → add **SHA-256** fingerprint (`cd frontend/android; ./gradlew signingReport`) for SMS-Retriever auto-fill.
   - Authentication → **Phone numbers for testing** → add a test number for QA.
5. **Mobile rebuild**: `cd frontend && npm run build && npx cap sync` then re-archive iOS/Android.
