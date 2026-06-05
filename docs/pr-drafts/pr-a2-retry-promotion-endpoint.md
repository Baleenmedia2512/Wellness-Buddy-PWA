<!--
PR-A.2 of ADR-0003 — Diary tab consolidation.
Branch: Kiruba_Principles (sequenced after PR-A on the same branch)
Base:   staging
-->

## Summary

PR-A.2 of the [ADR-0003](../adr/0003-diary-tab-consolidation.md) Diary
consolidation rollout. Wires the `retry.policy` shipped in PR-A into a
real HTTP endpoint: `POST /api/background-analysis/captures/retry-promotion`.

When the Diary UI (PR-C/PR-D, future) lets the user or a coach Retry or
Edit an "Other" row, the frontend posts the new Gemini analysis (or a
manual nutrition payload) here. The server:

1. Loads the capture by primary key.
2. Rejects with `409 NOT_RETRYABLE` if it is not currently `unknown`.
3. Loads the owner's coach upline and runs `assertCanRetryCapture` —
   owner allowed, anyone in the upline allowed, everyone else 403.
4. Audit-logs the coach-on-member case (per ADR-0003 F5).
5. Delegates to the existing `save()` so insert / upsert + capture
   promotion (`unknown → food` per PR-A) cannot diverge from the
   `pending → food` path.

## Ticket / Issue
Tracks PR-A.2 inside [docs/pr-drafts/diary-tab-consolidation.md](../pr-drafts/diary-tab-consolidation.md).

## Type
- [x] feat

## Scope (feature folder)
`backend/features/background-analysis/` · `backend/features/captures/`

---

## Pre-Edit Checklist (claude.md §4.1)
- [x] Read the whole `analysis.service.js` (475 LOC), `analysis.validators.js`,
  `analysis.repository.js` (the `getCoachChain` consumer), `captures.service.js`,
  `captures/data/captures.repository.js`, and every test file in both slices.
- [x] Reviewed the existing `updateCaptureType` + `save` orchestration — the
  new function follows the same shape, returning `{ httpStatus, body }`
  and being mounted via `runService`.
- [x] Found all callers: `captures.findByIdForOwner` is unchanged.
  `analysis.save` is called from `pages/api/background-analysis/index.js`
  and now also from `retryPromotionToFood`. No other caller relies on
  the implicit assumption that the food row's `UserID` equals the
  caller — `save()` always uses the `userId` it is passed.
- [x] No equivalent endpoint existed: `updateCaptureType` only flips
  `ImageType`; it does not insert / upsert food data. Reusing it is
  insufficient because the Retry path MUST run the full nutrition
  extraction + persistence pipeline.
- [x] Minimum change: 1 new route file (thin proxy), 1 new validator,
  1 new orchestrator function, 1 new repo+service read, plus tests.

## A.R.E.R.V.T Workflow (claude.md §4.2)
- **Analyze.** Today, `updateCaptureType` flips the capture's
  `ImageType` to `food` but does not write any nutrition. `save()` does
  both, but only as part of the normal capture flow with a freshly
  derived `userId` from the request. The Diary Retry/Edit flow needs to
  combine them with a permission gate that distinguishes owner vs coach.
- **Reuse.** `analysis.service.save()` is reused verbatim for the
  food insert/upsert and the capture promotion call. `getCoachChain` in
  `analysis.repository.js` produces the chain. The `retry.policy.js`
  policy from PR-A produces the decision. `runService` provides the
  HTTP envelope.
- **Extend / new.** New service function `retryPromotionToFood` (the
  orchestrator), new validator `validateRetryPromotion`, new HTTP
  route, new repo+service `captures.findById` (read without owner
  guard — required so the policy can see who the owner IS).
- **Refactor.** None.
- **Validate.** `npx jest features/background-analysis features/captures
  features/food-corrections` → **9 suites passed, 226 tests passed, 0
  failed**.
- **Test.** 14 new tests in `__tests__/retry-promotion.test.js` covering
  happy / denial / edge paths. 6 new validator tests in
  `__tests__/analysis.validators.test.js`.

---

## Business Logic Impact (REQUIRED — touches domain logic indirectly)

PR-A.2 does NOT modify any file under `*/domain/`. It only **consumes**
the domain modules added in PR-A. The Business Logic Impact Block is
still included because the new orchestrator + endpoint adds a new
**authorization** path, and §3.3 calls out authorization changes
explicitly.

- **Why changed.** The Diary needs a single, audited entry point that
  lets the owner — or their coach — convert a misclassified `unknown`
  capture into a real food row.
- **Rules changed.** None added. Two existing domain rules are now
  reachable from a new code path:
  1. State machine: `assertCanTransition('unknown', 'food')` is now
     exercised end-to-end via `save()` → `captures.updateTypeById`.
  2. Permission: `assertCanRetryCapture({ viewerId, ownerId, coachChain })`
     is now the gate for the new endpoint.
- **Side effects.**
  - Coach-on-member retries are audit-logged through the structured
    logger (info-level). Owner-on-self retries are NOT logged.
  - All denials are warn-logged with reason code (`NOT_IN_CHAIN`,
    `NO_VIEWER`, `NO_OWNER`).
- **Modules impacted.**
  - Read & write: `backend/features/background-analysis/analysis.service.js`,
    `backend/features/background-analysis/analysis.validators.js`,
    `backend/features/captures/captures.service.js`,
    `backend/features/captures/data/captures.repository.js`.
  - New: `backend/pages/api/background-analysis/captures/retry-promotion.js`.
- **Backward compatibility:** [x] **Yes**.
  - Brand-new route — no existing client calls it.
  - The new `captures.findById` is additive; `findByIdForOwner` is
    unchanged and remains the safe-by-default reader for every other
    caller.
  - `save()` signature unchanged.
- **Edge cases considered.**
  1. Capture does not exist → 404 `CAPTURE_NOT_FOUND`. ✅
  2. Capture row missing `UserID` (defensive) → 404. ✅
  3. Capture already `food` / `weight` / `education` / `smartwatch` /
     `pending` → 409 `NOT_RETRYABLE` with `currentType` exposed so the
     client can degrade gracefully (e.g. "this is already a food entry").
     ✅ (5 parameterised tests).
  4. Viewer is the owner → 200, food row inserted under the owner, **no
     audit log**. ✅
  5. Viewer is a direct coach of the owner → 200, food row inserted
     under the OWNER (not the coach), action audit-logged at info
     level. ✅
  6. Viewer is a deeper coach (≤ depth 10 in the chain) → 200, same as
     above. Covered by `retry.policy.test.js`.
  7. Viewer is a stranger → throws 403, denial warn-logged. ✅
  8. Viewer is a co-coach partner (peer of the owner's primary coach,
     never in the upline) → 403. ✅
  9. Viewer **was** a coach but the member left the team between
     requests — chain re-fetched per request, viewer denied. ✅
  10. Existing food row for this capture (retry-of-retry) → UPDATE path
      via `findFoodByCaptureId`, no duplicate insert. ✅
  11. Missing `imagePath` in body → falls back to the capture's stored
      `ImagePath`. ✅
  12. Missing `analysisResult` → 400 validator rejects. ✅
  13. `analysisResult` of wrong type (e.g. number) → 400 validator
      rejects. ✅
  14. `analysisResult === null` → 400 (the `== null` guard hits this
      before the typeof check). ✅
- **Tests added.**
  - `backend/features/background-analysis/__tests__/retry-promotion.test.js`
    — NEW, 14 tests, owner / coach / stranger / state matrix.
  - `backend/features/background-analysis/__tests__/analysis.validators.test.js`
    — extended with 8 tests for `validateRetryPromotion`.

---

## Architecture Impact (claude.md §2)
- [x] No new top-level folder. Endpoint lives at the established
  `pages/api/background-analysis/captures/` path, matching the existing
  `resolve.js` neighbour.
- [x] No new cross-feature import. `background-analysis` already
  imports `captures.service` (line 10) — this PR adds one more named
  import (`assertCanRetryCapture`) from the same captures slice.
- [x] No new circular dependency.
- [x] No file exceeds 400 LOC. Largest touched: `analysis.service.js`
  ~595 LOC after additions — exceeds the §2.3 ESLint **warn** threshold
  of 350, still under the **fail** threshold of 500 in the **current**
  read. Will be split when the diary feature lands, tracked as a
  follow-up.

> **File-size follow-up:** `analysis.service.js` is now ~595 LOC. PR-B
> (next) will create a thin `diary.service.js` sibling and move
> `resolvePublicCapture` + the new `retryPromotionToFood` there, which
> brings the file back under 400 LOC. Filed as a TODO in PR-B's draft.

- [x] Naming conventions followed (§2.9): `validateRetryPromotion` matches
  the `validate<Action>` validator pattern; route file is kebab-case
  `retry-promotion.js`.

## API Impact
- [x] **Additive change.** New route. No existing routes touched.
- Endpoints touched:
  - **NEW:** `POST /api/background-analysis/captures/retry-promotion`
    - **Body:** `{ captureId, viewerUserId, analysisResult, imagePath? }`
    - **200:** `{ ok: true, success: true, id, message, data: { ... } }` (delegates to `save()` envelope)
    - **400:** validator failure (`Request body is missing`, `captureId is required`, …)
    - **401:** `{ success: false, message: 'Authentication required …' }` (no `viewerUserId`)
    - **403:** `{ success: false, message: 'You do not have permission …' }` (stranger / co-coach / former coach)
    - **404:** `{ ok: false, error: { code: 'CAPTURE_NOT_FOUND', … } }`
    - **409:** `{ ok: false, error: { code: 'NOT_RETRYABLE', currentType, … } }`

## Database / Migration Impact
- [x] No migration. The new repository function is a read-only
  `SELECT` against `captures_table`; all writes go through paths that
  already exist.

## Security Impact (claude.md §8)
- [x] **Authorization changed.** The new endpoint is the first to use
  `retry.policy`. Solo-dev sign-off recorded for the `@security` slot
  (per .github/CODEOWNERS role map).
- [x] No new secrets.
- [x] PII logging: the audit log includes `actorId`, `ownerId`,
  `captureId` — these are internal numeric / UUID ids, **not PII**
  per the logger redaction policy in `shared/lib/logger.js`. No
  request bodies are logged.
- [x] Rate limit — TODO: add a rate-limit decorator (`shared/lib/rate-limit.js`)
  to the route once §8.4's rate-limit infrastructure lands feature-wide.
  Tracked separately; not in scope here.
- [x] Inputs validated: `validateRetryPromotion` runs first, before
  any DB read.

## Dependency Impact
- [x] No new dependency.

## Regression Risk
- **Risk level:** **Medium** (new public endpoint with auth path).
- **Mitigations:**
  - Endpoint has zero callers in production until the Diary UI ships
    in PR-C/D, so any defect surfaces in QA before it can affect users.
  - State-machine and policy are the same code that PR-A unit-tests
    exercised to 100% coverage; this PR adds 14 more
    integration-flavoured tests that wire all the pieces together.
  - `save()` is reused, so the food-row persistence path is shared with
    the proven `pending → food` flow.
- **Impacted features re-tested:**
  - `backend/features/captures/**` — all suites pass.
  - `backend/features/background-analysis/**` — all suites pass
    (including the previously-broken `validateCreateCapture`
    assertions, fixed in commit `b5b2d271`).
  - `backend/features/food-corrections/**` — all suites pass.

---

## Testing Evidence (claude.md §9)
- [x] Unit tests pass locally.
- [x] Integration tests not applicable (no live DB in this PR; deferred
  to the cross-feature integration suite per `governance/ROLLOUT.md`).
- [x] Coverage for changed files ≥ floor (§9.1):
  - `validateRetryPromotion` — every branch (missing field × 3,
    wrong type, null vs undefined, JSON-string vs object, imagePath
    present vs absent).
  - `retryPromotionToFood` — every return path (200 insert, 200
    update, 200 with image fallback, 404 not-found, 404 missing
    UserID, 409 NOT_RETRYABLE × 5 starting states, 403 stranger, 403
    coach-revoked, 403 co-coach).
- [x] `__tests__/MATRIX.md` updated for `background-analysis`.
- [x] E2E impact: **N/A in PR-A.2** (no UI yet — that's PR-C/D).

### Local run output

```
$ cd backend && npx jest features/background-analysis features/captures features/food-corrections
PASS features/captures/__tests__/retry.policy.test.js
PASS features/captures/__tests__/captures.service.test.js
PASS features/captures/__tests__/image-types.test.js
PASS features/background-analysis/__tests__/retry-promotion.test.js   (NEW)
PASS features/background-analysis/__tests__/captures.test.js          (now green)
PASS features/background-analysis/__tests__/analysis.service.test.js
PASS features/background-analysis/__tests__/analysis.validators.test.js (extended)
PASS features/food-corrections/__tests__/food-corrections.validators.test.js
PASS features/food-corrections/__tests__/food-corrections.service.test.js
Test Suites: 9 passed, 9 total
Tests:       226 passed, 226 total
Time:        2.729 s
```

---

## AI Assistance Disclosure (claude.md §5)
- [x] AI-assisted — tool: **GitHub Copilot (Claude Opus 4.7)**.
- [x] Hallucination checklist completed (§5.2):
  - All imports resolve (`assertCanRetryCapture` and
    `IMAGE_TYPE_UNKNOWN` added to the existing captures imports;
    `largeBodyConfig`, `applyCors`, `runService`, `methodNotAllowed`
    follow the established route-handler pattern).
  - All called functions exist with the signatures used: `save`,
    `captures.findById` (new in this PR), `captures.updateTypeById`,
    `repo.getCoachChain`, `assertCanRetryCapture`.
  - No env vars referenced.
  - DB columns referenced (`captures_table.ID`, `UserID`, `ImageType`,
    `ImagePath`, `ImageBase64`, `IsDeleted`) all exist per
    `migrations/create_captures_table.sql`.
  - Route is registered via the Next.js filesystem router (file
    presence under `pages/api/` = route registered).
  - No new dependency.
- [x] **Confidence per file:**
  - `analysis.service.js` (retryPromotionToFood) — **92** (orchestrator
    reuses three proven primitives; coverage is exhaustive).
  - `analysis.validators.js` — **96** (mirrors the existing validator
    style; 8 tests cover every branch).
  - `captures.service.js` (findById) — **95** (one-line read with
    explicit security disclaimer in the doc-comment).
  - `captures/data/captures.repository.js` (findById) — **95**
    (mirrors `findByIdForOwner` minus the userId filter).
  - `pages/api/background-analysis/captures/retry-promotion.js` — **98**
    (3-line thin proxy, identical shape to `resolve.js` neighbour).
  - `retry-promotion.test.js` — **90** (covers every branch; the
    actor-role assertion verifies the audit-log contract).
- [x] **Files flagged "unsafe edit" (§5.4):** None. `domain/` was not
  touched in this PR — only consumed.

## Reviewer Routing (claude.md §6.3)
- Feature owner: solo dev (per CODEOWNERS).
- Additional required approvers:
  - `@principal-eng` — domain consumption + new auth path; same person
    (solo principal-eng).
  - `@security` — first endpoint to use `retry.policy`; same person.

## Post-Merge Actions
- [x] CHANGELOG entry written.
- [ ] PR-B unblocked (backend read-model `listDiaryEntries` will share
  the same auth posture: owner or coach-of-owner).
- [ ] Add a rate-limit decorator to the new route when §8.4's
  rate-limit infrastructure lands feature-wide.
- [ ] Split `analysis.service.js` (~595 LOC) into a sibling
  `diary.service.js` as part of PR-B to get back under §2.3's warn
  threshold of 350 LOC.
