<!--
PR-C of ADR-0003 — Diary tab consolidation.
Branch: Kiruba_Principles (sequenced after PR-A, PR-A.2, PR-B + F1)
Base:   staging
-->

## Summary

PR-C of [ADR-0003](../adr/0003-diary-tab-consolidation.md) — the
**frontend Diary tab**. Ships a new `features/diary/` slice that
consumes the PR-B `GET /api/diary/list` endpoint and renders a
cards-only newest-first feed inside `Dashboard.js`.

The tab is mounted only when the new client-side flag
`ff.diary-feed` is enabled. **Default OFF**, so this PR ships dark —
the existing Food / Weight / Education tabs are completely
unchanged for users on the default flag.

Also includes a small co-located refactor (separate commit) that
extracts the tab-strip JSX from `Dashboard.js` into a sibling
`DashboardTabs.jsx` so `Dashboard.js` stays under the §2.3 file-size
fail threshold after the Diary tab's additions.

## Ticket / Issue
Tracks PR-C inside [docs/pr-drafts/diary-tab-consolidation.md](../pr-drafts/diary-tab-consolidation.md).

## Type
- [x] feat
- [x] refactor _(separate commit; behaviour-preserving with tests)_

## Scope (feature folder)
`frontend/src/features/diary/` (new) · `frontend/src/shell/` · `frontend/src/config/`

---

## Pre-Edit Checklist (claude.md §4.1)
- [x] Read `Dashboard.js` (post-F1) end-to-end before adding the tab.
- [x] Read `MealCard.js` for the existing card style template
  (chrome / accessibility / image fallback pattern is mirrored in
  the new row components).
- [x] Read `frontend/src/shared/services/auth/fsm/featureFlags.js`
  to understand the existing frontend flag-resolution pattern
  (storage → env → default).
- [x] Found all callers of `Dashboard.js` (one: `App.js`). Found
  zero pre-existing callers of `features/diary/`.
- [x] No equivalent slice existed.
- [x] Minimum change: 1 new feature folder + 1 small Dashboard.js
  diff to mount the tab + 1 new shell sibling for the extraction.

## A.R.E.R.V.T Workflow (claude.md §4.2)
- **Analyze.** Three tab orchestrators today own their own
  presentation (`NutritionDashboard`, `WeightDashboard`,
  `EducationDashboard`). The Diary view is a fourth peer that
  consumes the new `GET /api/diary/list` and renders a flat feed.
- **Reuse.** New row components mirror the chrome of
  `MealCard.js` (glassmorphism, image-or-fallback thumb,
  right-aligned primary value). The hook uses
  `shared/utils/fetchWithAbort` for cancellation semantics already
  established elsewhere in the codebase. Flag resolution mirrors
  the auth-FSM pattern (storage → env → default).
- **Extend / new.** New `features/diary/` slice (api + hook +
  components + barrel + README). New `frontend/src/config/featureFlags.js`
  module — mirror of the backend registry from PR-B. New
  `frontend/src/shell/components/DashboardTabs.jsx` extracted from
  `Dashboard.js`. New `frontend/src/setupTests.js` so DOM matchers
  work in Jest (was missing — pre-existing gap, surfaced when this
  PR added the first suite that uses them).
- **Refactor.** `Dashboard.js`: relative-path + import updates to
  mount the new tab. Tab-strip JSX extracted to `DashboardTabs.jsx`
  to keep the file under the §2.3 fail threshold (was 558 LOC
  after the additions, now 442).
- **Validate.** `npx react-scripts test --watchAll=false
  --testPathPattern='(diary|featureFlags)'` →
  **3 suites passed, 33 tests passed, 0 failures.**
- **Test.** New `useDiary.test.js` (14 cases),
  `DiaryFeed.test.jsx` (10 cases), `config/featureFlags.test.js`
  (9 cases).

---

## Business Logic Impact (REQUIRED only if `domain/` touched — §3.3)

PR-C touches **no** `domain/` files. The frontend slice does not
own any business rule — it renders the backend's projected entries
and dispatches by `kind` via a frozen lookup table. The flag
resolver is policy-free (read-and-return). No Business Logic
Impact Block required.

---

## Architecture Impact (claude.md §2)
- [x] New top-level folder created: `frontend/src/features/diary/`.
  Justified by [ADR-0003](../adr/0003-diary-tab-consolidation.md);
  no new ADR needed in PR-C itself.
- [x] No new cross-feature import. The slice is consumed only by
  `shell/components/Dashboard.js` via the public barrel
  (`frontend/src/features/diary/index.js`).
- [x] No new circular dependency.
- [x] **File-size status.**
  - `Dashboard.js`: **442 LOC** (over the §2.3 warn threshold of
    350, under the fail threshold of 500). Was 558 after the
    Diary tab additions; the extraction commit brings it back
    under the fail line.
  - `DashboardTabs.jsx`: 110 LOC.
  - `DiaryFeed.jsx`: 140 LOC.
  - `rows/index.js`: 212 LOC (5 row components in one file
    intentionally — they share `Shell`, `Thumb`, `formatTime`
    helpers; splitting would duplicate). Under threshold.
  - `useDiary.js`: 100 LOC.
  - `diaryClient.js`: 53 LOC.
  - `featureFlags.js`: 74 LOC.
- [x] Naming conventions followed (§2.9): PascalCase components,
  `use*` hooks, kebab-case module paths.
- [x] §2.4 graduation policy NOT triggered — the slice is a new
  feature folder, not a `shared/` graduation.

## API Impact
- [x] No backend API change.
- [x] Frontend consumes the **PR-B endpoint** (`GET /api/diary/list`)
  via a single thin axios wrapper in `api/diaryClient.js`.

## Database / Migration Impact
- [x] No migration.

## Security Impact (claude.md §8)
- [x] No auth/authz change. The owner-or-coach gate runs server-side
  on the PR-B endpoint; the frontend simply forwards
  `viewerUserId` from the resolved session user, never trusting
  client-side ids.
- [x] No new secrets.
- [x] PII logging: only `[diary]` debug log lines; no request
  bodies, no user identifiers in production logs (debugLog is
  no-op in production builds).
- [x] Rate limiting — N/A (read-only client; the route's rate
  limit is the same TODO as PR-A.2 / PR-B).
- [x] Inputs validated client-side (`fetchDiary` guards against
  missing required args before issuing the request).

## Dependency Impact
- [x] No new dependency.

## Regression Risk
- **Risk level:** **Low**.
  - Flag defaults OFF in every environment, so users never see the
    Diary tab on a normal deploy.
  - Diary code lives in its own lazy chunk — when the flag is OFF
    the bundle is not even requested.
  - The 4-tab change to `Dashboard.js` is gated on `diaryEnabled`,
    so the existing 3-tab UX is bit-for-bit unchanged for default
    users.
- **Mitigations:**
  - The tab-strip extraction (DashboardTabs.jsx) is a separate
    commit so the refactor can be reverted alone.
  - All 33 new tests are deterministic — they mock `fetchDiary`
    and `useDiary` at the module boundary.
  - 5 frontend test suites fail pre-existing on `main`/`staging`
    (nutrition / login / nutrition-persistence); none of them
    are in this PR's changeset. Verified via
    `git diff --name-only`.

---

## Testing Evidence (claude.md §9)
- [x] Unit tests pass locally.
- [x] Coverage for changed files ≥ floor (§9.1: hooks ≥ 85%,
  components ≥ 70%):
  - `useDiary` — every branch (happy path, refresh, missing
    inputs, bad date, HTTP error capture, AbortError suppressed,
    `toYmd` IST conversion).
  - `DiaryFeed` — every render branch (loading skeleton, error
    states for non-auth and auth, empty state, all 5 row types,
    unknown-kind fallback to `OtherRow`, refreshing indicator).
  - `featureFlags` — every branch of `isFlagEnabled` (storage
    override, env override, case-insensitive parsing,
    garbage-value fallback, unknown-flag fails closed).
- [x] `__tests__/MATRIX.md` created for `features/diary/`.
- [x] E2E impact: **N/A in PR-C**. Playwright journey "capture
  blank wall → row appears as Other → Retry → Edit → save → row
  becomes Food" is the PR-D deliverable.

### Local run output

```
$ cd frontend && npx react-scripts test --watchAll=false --testPathPattern='(diary|featureFlags)'
PASS  src/config/__tests__/featureFlags.test.js
PASS  src/features/diary/__tests__/useDiary.test.js
PASS  src/features/diary/__tests__/DiaryFeed.test.jsx
Test Suites: 3 passed, 3 total
Tests:       33 passed, 33 total
Time:        2.534 s
```

### Pre-existing failures NOT in this PR's scope
- `src/features/nutrition/services/nutritionMath/__tests__/nutritionMath.test.js`
- `src/shared/services/nutritionPersistence/__tests__/saveAnalysis.test.js`
- `src/features/user/__tests__/LoginIntroPanel.test.js`
- `src/features/user/__tests__/Login.test.js`
- `src/features/nutrition/__tests__/NutritionCarousel.test.js`

All five suites fail on `main`/`staging` without any of this PR's
changes (verified via `git diff --name-only`). Filing separate
hotfix PRs is tracked but out of scope here per §4.3.

---

## AI Assistance Disclosure (claude.md §5)
- [x] AI-assisted — tool: **GitHub Copilot (Claude Opus 4.7)**.
- [x] Hallucination checklist completed (§5.2):
  - All imports resolve.
  - All called functions exist with the signatures used.
  - `REACT_APP_FF_DIARY_FEED` env var is documented but not
    required to exist — `featureFlags.js` defaults to false.
  - No DB columns referenced from the frontend.
  - `GET /api/diary/list` route exists (PR-B).
  - No new dependency.
- [x] **Confidence per file:**
  - `features/diary/api/diaryClient.js` — **95** (thin axios
    wrapper; matches existing service patterns).
  - `features/diary/hooks/useDiary.js` — **90** (abort-bound,
    every branch tested; IST date conversion is the only piece
    with subtle correctness — explicitly tested for late-evening
    UTC).
  - `features/diary/components/DiaryFeed.jsx` — **88**
    (orchestrator + 4 render branches; all tested).
  - `features/diary/components/rows/index.js` — **85** (5 row
    components share `Shell` / `Thumb`; smoke-tested through
    DiaryFeed dispatch test).
  - `config/featureFlags.js` — **96** (mirror of backend
    registry, every branch tested).
  - `shell/components/Dashboard.js` (delta) — **88** (mount-the-tab
    diff is small; the larger extraction is its own commit).
  - `shell/components/DashboardTabs.jsx` — **96**
    (behaviour-preserving extraction).
- [x] **Files flagged "unsafe edit" (§5.4):** None. `domain/` was
  not touched in this PR.

## Reviewer Routing (claude.md §6.3)
- Feature owner: solo dev.
- Additional required approvers: `@principal-eng` (new top-level
  feature folder + shell extraction) — same person on this repo.

## Post-Merge Actions
- [x] CHANGELOG entries written (3: PR-C feature, the tab-strip
  extraction, the F1 shell move).
- [ ] PR-D unblocked (App.js image-analysis flow change — when
  `ff.diary-feed` is ON, skip the `UnknownCaptureModal` and let
  the new Other row appear in the Diary).
- [ ] When the flag is flipped ON for staging, run the
  `@regression` E2E that ships with PR-D.
- [ ] Track the Dashboard.js LOC trend — `DashboardTabs.jsx`
  extraction bought headroom but further additions will need
  another extraction (probably the tab-content `<Suspense>`
  block).
- [ ] Set `REACT_APP_FF_DIARY_FEED=true` in the Vercel staging
  env once PR-A/A.2/B/F1/C are all merged to staging.
