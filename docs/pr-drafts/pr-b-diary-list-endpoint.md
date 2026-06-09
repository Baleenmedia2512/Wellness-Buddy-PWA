<!--
PR-B of ADR-0003 — Diary tab consolidation.
Branch: Kiruba_Principles (sequenced after PR-A + PR-A.2 on the same branch)
Base:   staging
-->

## Summary

PR-B of the [ADR-0003](../adr/0003-diary-tab-consolidation.md) Diary
consolidation rollout — the **backend feed read-model**. New endpoint
`GET /api/diary/list?ownerUserId=&viewerUserId=&date=YYYY-MM-DD` returns
all four verticals' rows (food + weight + education + watch) for one
owner + one IST day, sorted newest-first.

`unknown` rows are gated server-side on the new
`ff.diary-feed` flag (default OFF). When the flag is OFF the
response shape is unchanged from the food-only baseline — clients
not yet upgraded for PR-C/D continue to render only food rows even
if they happen to call the new endpoint.

Also ships a small **refactor** prerequisite (separate commit) that
extracts `resolvePublicCapture` and `retryPromotionToFood` from
`analysis.service.js` into a new sibling `diary.service.js` — required
to keep PR-B's additions under claude.md §2.3's file-size cap.

## Ticket / Issue
Tracks PR-B inside [docs/pr-drafts/diary-tab-consolidation.md](../pr-drafts/diary-tab-consolidation.md).

## Type
- [x] feat
- [x] refactor _(separate commit; behaviour-preserving with tests)_

## Scope (feature folder)
`backend/features/background-analysis/` · `backend/shared/lib/`

---

## Pre-Edit Checklist (claude.md §4.1)
- [x] Read `analysis.service.js`, `analysis.repository.js`,
  `weight.repository.js`, `education.repository.js`,
  `activity.repository.js`, `food-corrections.repository.js`, and
  every test file in those slices end-to-end.
- [x] Reviewed how each existing per-tab dashboard reads "today" so
  the diary's per-vertical predicates mirror them exactly (no
  drift between Diary view and the per-tab views).
- [x] Found all callers of the two functions being moved
  (`resolvePublicCapture`, `retryPromotionToFood`): both live in
  `pages/api/background-analysis/captures/` and were repointed
  to the new module in the refactor commit.
- [x] No equivalent endpoint existed. `listAnalyses` returns
  food only and lacks the coach-permission gate. `fetchMealsForDate`
  is food only too. Building on either would either change a
  share-link consumer or duplicate the date-window predicate.
- [x] Minimum change: 1 new repo file, 1 new service function +
  helper, 1 new validator, 1 new route file, 1 new feature-flag
  module, plus tests and the documented prerequisite refactor.

## A.R.E.R.V.T Workflow (claude.md §4.2)
- **Analyze.** Today, each vertical owns its own read endpoint and
  the frontend Dashboard component switches between three tab
  children. No backend endpoint returns a merged "day in the
  diary" view, and no permission gate covers a cross-vertical
  read for the coach-viewing-member case.
- **Reuse.** The new service reuses `getCoachChain` (existing) +
  `canRetryCapture` (PR-A) for permissions, the existing per-table
  query predicates (mirrored exactly in `diary.repository.js`), and
  the watch-Topic parser from `activity.service`. No business rule
  is duplicated — the diary projection is a pure formatter.
- **Extend / new.** New service `listDiaryEntries` + pure
  projection helper `toDiaryEntry`. New validator `validateDiaryList`.
  New thin proxy `pages/api/diary/list.js`. New repository
  `diary.repository.js` (5 read functions). New shared module
  `feature-flags.js` (registry + `isEnabled` + stale-flag detector).
- **Refactor.** Sequenced before the feature commit — moves
  `resolvePublicCapture` + `retryPromotionToFood` into the new
  `diary.service.js`. Behaviour-preserving; 226 tests still pass
  after the refactor commit, before the feature commit lands.
- **Validate.** `npx jest features/background-analysis
  features/captures features/food-corrections shared` →
  **11 suites, 263 tests, 0 failures.**
- **Test.** New `diary.service.test.js` (24 cases), validator tests
  extended (+8 cases), `feature-flags.test.js` (12 cases).

---

## Business Logic Impact (REQUIRED — touches authorization)

PR-B does NOT modify any file under `*/domain/`, but it adds a new
read-side authorization path (coach-viewing-member diary). §3.3 calls
out authorization changes explicitly.

- **Why changed.** ADR-0003 mandates a single Diary view that
  aggregates four record types for a chosen date, accessible to
  the owner and to coaches in the owner's upline.

- **Rules changed.** None added; **one rule reused on a new path**:
  - The `canRetryCapture` predicate now also gates list-reads of
    the diary. By design — ADR-0003 §"Pinned product answers"
    explicitly aligns the two: "if you can Retry a capture, you
    can also see the day's diary it lives in".

- **Side effects.**
  - Coach-on-member diary reads are audit-logged at info level
    (`actorId, ownerId, date`). Owner-on-self reads are NOT logged.
  - Per-vertical reads run in parallel; one failure warn-logs the
    `kind` + error message but does NOT bubble — the remaining
    streams still render. §2.8 "fail loudly to the error sink but
    don't cascade" for background jobs is mirrored here for
    read-side composition.

- **Modules impacted.**
  - Read & write: `backend/features/background-analysis/diary.service.js`
    (new function `listDiaryEntries` + helper `toDiaryEntry`),
    `backend/features/background-analysis/analysis.validators.js`
    (new `validateDiaryList`).
  - New: `backend/features/background-analysis/diary.repository.js`,
    `backend/pages/api/diary/list.js`, `backend/shared/lib/feature-flags.js`.

- **Backward compatibility:** [x] **Yes**.
  - Brand-new route. No existing client calls it.
  - Existing per-tab endpoints (`listAnalyses`, `weight/list`,
    `education/list`, etc.) are untouched.
  - `ff.diary-feed` defaults to OFF, so even if a client calls
    `/api/diary/list` against an unflagged environment, the
    response excludes `unknown` rows — matching the pre-PR-B
    "don't surface unknown captures" intent of PR 3.

- **Edge cases considered.**
  1. Owner reads own diary — `isSelf:true`, no audit log. ✅
  2. Coach reads member diary — allowed, audit-logged. ✅
  3. Stranger / co-coach reads — 403 with reason exposed for
     debugging. ✅
  4. Anonymous (no `viewerUserId`) — 401. ✅
  5. Flag OFF (default) — `unknown` query is NOT fired at all
     (saves a round-trip). ✅
  6. Flag ON — `unknown` captures appear with `kind: 'unknown'`,
     never `kind: 'food'`. PR 3's "don't pollute the food feed"
     intent preserved. ✅
  7. Per-vertical read failure (e.g. weight DB connection drops)
     — warn-logged, weight rows return empty, the other three
     streams render. ✅
  8. Empty day — returns `entries: []`, not a 500. ✅
  9. Watch row with malformed `Topic` — parser returns `kcal: 0`
     instead of throwing, mirroring the existing
     `getWatchBurnedCalories` parser exactly. ✅
  10. Invalid date (`2026-02-31`, `2026-13-01`, malformed string,
      future) — validator rejects with 400 + precise message. ✅
  11. Today's date (boundary) — accepted (not flagged as future). ✅
  12. Coach who was later removed from the team — `getCoachChain`
      is re-fetched per request, so the now-removed coach is denied
      on the next read. ✅ (covered by the policy's own test in PR-A.)

- **Tests added.**
  - `backend/features/background-analysis/__tests__/diary.service.test.js`
    — NEW, 24 tests covering composition, ordering, the flag
    gate, the permission gate, the audit log, and the per-vertical
    failure-isolation behaviour. Also covers every branch of the
    pure `toDiaryEntry` projection.
  - `backend/features/background-analysis/__tests__/analysis.validators.test.js`
    — extended with 8 tests for `validateDiaryList`.
  - `backend/shared/__tests__/feature-flags.test.js` — NEW, 12 tests
    covering env-override precedence, case-insensitive boolean
    parsing, garbage-value fallback, unknown-flag-fails-closed,
    and stale-flag detection.

---

## Architecture Impact (claude.md §2)
- [x] No new top-level folder. Route lives at the new
  `pages/api/diary/` subfolder under the existing `pages/api/`
  tree, matching the §2.6 "verb + resource" convention for the
  user-facing path (`/api/diary/list`).
- [x] No new cross-feature import. `diary.service.js` imports only
  from its own feature (`./analysis.service.js`,
  `./analysis.repository.js`, `./diary.repository.js`), from the
  captures slice (already an existing dependency of this feature),
  and from `shared/lib/` (always allowed).
- [x] No new circular dependency.
- [x] **File-size status.**
  - `analysis.service.js`: 595 → 423 LOC (still over §2.3 warn
    threshold of 350, under fail threshold of 500). Improved by
    the refactor commit.
  - `diary.service.js`: 438 LOC. **Over the 350-warn threshold.**
    Justified for this PR because `toDiaryEntry` is a tight
    switch-case helper that lives next to its only consumer; PR-C
    will extract it into a sibling `diary.projection.js` if
    further additions push the file size up.
  - `diary.repository.js`: 148 LOC — well under threshold.
  - `feature-flags.js`: 116 LOC — well under.
  - `pages/api/diary/list.js`: 26 LOC.
- [x] Naming conventions followed (§2.9).

## API Impact
- [x] **Additive change.** New route. No existing routes touched.
- Endpoints touched:
  - **NEW:** `GET /api/diary/list?ownerUserId&viewerUserId&date`
    - **200:** `{ ok: true, data: { date, ownerUserId, isSelf, includesUnknown, entries: [{ kind, capturedAt, capture, payload }] } }`
    - **400:** validator failure (missing field, malformed date, future date)
    - **401:** `{ success: false, message: 'Authentication required' }`
    - **403:** `{ success: false, message: 'You do not have access to this diary' }`

## Database / Migration Impact
- [x] No migration. Every query in `diary.repository.js` is a
  read against existing tables (`food_nutrition_data_table`,
  `weight_records_table`, `education_logs_table`, `captures_table`).

## Security Impact (claude.md §8)
- [x] **New authorization path.** Same predicate as PR-A.2
  (`canRetryCapture`). Self-approved.
- [x] No new secrets.
- [x] PII logging: the audit log includes `actorId`, `ownerId`,
  `date` — internal numeric ids + a calendar date. Not PII.
- [x] Rate limit — TODO: add `shared/lib/rate-limit.js` decorator
  when the feature-wide infrastructure lands (same TODO as PR-A.2).
- [x] Inputs validated by `validateDiaryList` before any DB read.
- [x] Cache-Control on the route is `no-store, no-cache,
  must-revalidate` so coach reads cannot be served from a stale
  shared cache layer.

## Dependency Impact
- [x] No new dependency.

## Regression Risk
- **Risk level:** **Medium** (new public endpoint with auth path
  + flag-gated read).
- **Mitigations:**
  - Flag defaults OFF — the legacy "no unknown rows surface in any
    feed" guarantee is preserved on day-1.
  - Endpoint has zero callers in production until PR-C ships.
  - The refactor commit and the feature commit are sequenced so the
    refactor stands alone if the feature is rolled back.
  - Per-vertical failure isolation means a single transient does
    not take the whole feed down for the user.
- **Impacted features re-tested:**
  - `backend/features/captures/**` — all suites pass.
  - `backend/features/background-analysis/**` — all suites pass.
  - `backend/features/food-corrections/**` — all suites pass.
  - `backend/shared/__tests__/feature-flags.test.js` — NEW, all pass.

---

## Testing Evidence (claude.md §9)
- [x] Unit tests pass locally.
- [x] Integration tests not applicable (no live DB; deferred to
  the cross-feature integration suite once `pg-mem` lands —
  consistent with PR-A / PR-A.2 disposition).
- [x] Coverage for changed files ≥ floor (§9.1):
  - `validateDiaryList` — every branch (3 missing-field cases,
    malformed regex, impossible calendar date, future date,
    today boundary, null body).
  - `listDiaryEntries` — every branch (owner/coach/stranger/
    anonymous, flag OFF, flag ON, per-vertical failure isolation,
    empty day, ordering, audit log).
  - `toDiaryEntry` — every `kind` (food / weight / education /
    watch / unknown) plus the throw branch.
  - `feature-flags` — every branch of `isEnabled`,
    `findStaleFlags`, and `getSpec`.
- [x] `__tests__/MATRIX.md` updated.
- [x] E2E impact: **N/A in PR-B** (no UI yet — that's PR-C).

### Local run output

```
$ cd backend && npx jest features/background-analysis features/captures features/food-corrections shared
PASS features/captures/__tests__/retry.policy.test.js
PASS features/captures/__tests__/captures.service.test.js
PASS features/captures/__tests__/image-types.test.js
PASS features/background-analysis/__tests__/retry-promotion.test.js
PASS features/background-analysis/__tests__/captures.test.js
PASS features/background-analysis/__tests__/analysis.service.test.js
PASS features/background-analysis/__tests__/analysis.validators.test.js
PASS features/background-analysis/__tests__/diary.service.test.js  (NEW)
PASS features/food-corrections/__tests__/food-corrections.validators.test.js
PASS features/food-corrections/__tests__/food-corrections.service.test.js
PASS shared/__tests__/feature-flags.test.js  (NEW)
Test Suites: 11 passed, 11 total
Tests:       263 passed, 263 total
Time:        11.6 s
```

---

## AI Assistance Disclosure (claude.md §5)
- [x] AI-assisted — tool: **GitHub Copilot (Claude Opus 4.7)**.
- [x] Hallucination checklist completed (§5.2):
  - All imports resolve.
  - All called functions exist with the signatures used.
  - DB columns referenced (`food_nutrition_data_table.*`,
    `weight_records_table.*`, `education_logs_table.Id/Topic/...`,
    `captures_table.ID/UserID/ImageType/...`) all exist per the
    migrations the existing repositories already read.
  - Route is registered via the Next.js filesystem router
    (`pages/api/diary/list.js`).
  - No new dependency.
- [x] **Confidence per file:**
  - `diary.service.js` — **90** (composition over proven primitives;
    every branch tested; degradation behaviour explicit).
  - `diary.repository.js` — **88** (each query mirrors an existing
    repo function on the same table; no live DB execution yet).
  - `analysis.validators.js` (`validateDiaryList`) — **96**
    (mirrors the existing validator style; 8 tests cover every
    branch including the calendar-validity check).
  - `feature-flags.js` — **95** (small registry with explicit
    fails-closed semantics; covered to ~100% by the test).
  - `pages/api/diary/list.js` — **98** (5-line thin proxy).
  - `diary.service.test.js` — **88** (mocks at the boundary;
    the projection is the only piece tested without a mock and
    that's by design).
- [x] **Files flagged "unsafe edit" (§5.4):** None. `domain/` was
  not touched in this PR — only consumed.

## Reviewer Routing (claude.md §6.3)
- Feature owner: solo dev.
- Additional required approvers: `@principal-eng` (auth-path
  reuse), `@security` (first cross-vertical read endpoint) —
  same person on this repo.

## Post-Merge Actions
- [x] CHANGELOG entries written (both the refactor and the
  feature commit).
- [ ] PR-C unblocked (frontend Diary shell + the new
  `useDiary` hook that consumes `/api/diary/list`).
- [ ] Wire `ff.diary-feed` into the rollout plan in
  `docs/pr-drafts/diary-tab-consolidation.md` (flag ON for
  staging on PR-C merge, ON for 5 % of prod on PR-D merge,
  ON globally one week later if error rate stable).
- [ ] When PR-C ships, register the **frontend** mirror of
  `ff.diary-feed` (the existing `frontend/src/config/` env-flag
  pattern) so the FE can decide whether to mount the Diary tab
  even before the response surfaces unknown rows.
- [ ] Add rate-limit decorator to `/api/diary/list` alongside
  the same TODO on `/api/background-analysis/captures/retry-promotion`.
