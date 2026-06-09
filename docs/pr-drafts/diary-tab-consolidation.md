# PR plan — Diary tab consolidation

Drives [ADR-0003](../adr/0003-diary-tab-consolidation.md). Each row below is a
**separate PR** sized within claude.md §4.4 (feature: ≤25 files / ≤800 LOC
excl. tests). Tests ship in the same diff as the behaviour change they cover
(§1.1 #5). Every PR touching `domain/` MUST carry a §3.3 Business Logic Impact
Block in its description.

Feature flag: `ff.diary-feed`, owner `@principal-eng`, removal target
**90 days after PR-C merges** (§3.5).

---

## PR-A — Domain: state-machine + dedup + retry endpoint (backend-only)

**Branch:** `feat/diary-a-domain-foundations`
**Approvers:** `@principal-eng` (§5.4 sensitive file) + 1 feature owner (food-corrections / captures).
**Risk:** medium (state-machine loosening + dedup policy flip).

### Files (est.)

| File | Change | Reason |
|---|---|---|
| `backend/features/captures/domain/image-types.js` | Add one allowed transition: `unknown → food`. Keep all other terminals immutable. | Requirement #3. Sensitive — §5.4 review. |
| `backend/features/captures/captures.service.js` | Honour the new transition in `updateTypeById`. No behaviour change for the existing four transitions. | Wire-up only. |
| `backend/features/captures/__tests__/image-types.test.js` | Add cases: `unknown→food` allowed; `unknown→weight/education/smartwatch` still rejected; `food→anything` still rejected. | §9.1 95% domain coverage floor. |
| `backend/features/food-corrections/food-corrections.service.js` | Flip `dedupItems` from first-wins to last-wins (`searchUserMeals` returns ordered by `CreatedAt DESC`, so we keep the latest). | Requirement #4. |
| `backend/features/food-corrections/__tests__/food-corrections.service.test.js` | Replace the dedup-keeps-first assertion; add explicit "two rows same name → latest nutrition wins" case. | §3.3 disclosure pairs with test. |
| `backend/features/background-analysis/analysis.service.js` | New entry-point `reanalyzeCapture({ captureId, userId })` that re-runs the Gemini detector on the existing image and upserts the food row, then promotes the capture via the new transition. | Requirement #3 (Retry). |
| `backend/features/background-analysis/__tests__/reanalyze.test.js` | Happy path + "still low-confidence on retry → leave as unknown, return 200 with `success:false, fallback:'manual'`". | Behaviour contract. |
| `backend/pages/api/captures/retry-analysis.js` (thin proxy ≤4 LOC) | New route `POST /api/captures/retry-analysis` → delegates to `reanalyzeCapture`. | §2.6 verb+resource naming. |
| `backend/features/captures/domain/permissions/retry.policy.js` | New: `canRetryCapture({ viewerId, ownerId })` → allowed when `viewerId === ownerId` OR `hierarchyHelpers.isCoachOf(viewerId, ownerId)` returns true. Admin role inherits the coach branch. | §3.2 permissions live in `domain/permissions/`. |
| `backend/features/captures/__tests__/retry.policy.test.js` | Owner allowed; non-coach user 403; coach-of-owner allowed; admin allowed; coach-of-different-team 403. | Pure domain coverage (§9.1 95% floor). |
| `backend/features/background-analysis/__tests__/retry-permissions.test.js` | Integration: owner allowed; coach-of-owner allowed (and audit-logged per F5); stranger 403; anonymous 401. | §8.1 authz at domain. |

**LOC budget:** ~250 production + ~250 tests. ✅ within feature cap.

**Required PR description sections (per claude.md §3.3 + .github template):**

- **Business Logic Impact Block** — yes (two domain files touched).
- **Backward compatibility:** YES. The new transition is *additive*; the
  dedup flip changes search **response ordering** only (`SmartFoodSearchModal`
  already treats the first match as canonical, so the UX is "you get the
  newer entry first" — no broken consumers).
- **Migration plan:** none — no schema change.
- **Edge cases (min 5):** retry on already-promoted food capture (idempotent
  return); retry when image was deleted from storage (404); retry on
  smartwatch capture (rejected by policy); search where user has no own meals
  but community does (latest community wins); search with 0 results (empty
  arrays, not 500); coach retries on a member who has since left the team
  (re-check `isCoachOf` at request time, not from cached membership).

---

## PR-B — Backend read-model: `listDiaryEntries` (no UI)

**Branch:** `feat/diary-b-read-model`
**Depends on:** PR-A merged.
**Approvers:** 1 feature owner (background-analysis or new `diary` slice if we
add one — TBD in PR-B kickoff comment).
**Risk:** low (read-only).

### Files (est.)

| File | Change |
|---|---|
| `backend/features/background-analysis/diary.repository.js` (new) | Joins `captures_table` ⇢ `food_nutrition_data_table` / `weight_records_table` / `education_logs_table` for a `{ userId, date }` window. Returns a normalised `{ kind, capturedAt, capture, payload }[]`. |
| `backend/features/background-analysis/diary.service.js` (new) | Validates input, paginates, applies permission check (own data or coach-of-user). |
| `backend/features/background-analysis/validation/diary.schema.js` (new) | `{ userId, date (YYYY-MM-DD), tz }`. |
| `backend/features/background-analysis/__tests__/diary.service.test.js` | Happy path per kind; unknown captures included (gate on flag — see below); empty day; future date rejected. |
| `backend/pages/api/diary/list.js` (thin proxy) | `GET /api/diary/list?userId&date&tz`. |
| `backend/shared/lib/feature-flags.js` | Register `ff.diary-feed` per §3.5 (owner, creation date, removal target). |

**Flag behaviour in PR-B:** the route is *always* live; the *include
`unknown` rows* behaviour is gated on `ff.diary-feed` server-side so the
flag protects the policy reversal explicitly noted in ADR-0003.

**LOC budget:** ~300 production + ~250 tests. ✅

---

## PR-C — Frontend Diary shell

**Branch:** `feat/diary-c-ui-shell`
**Depends on:** PR-A + PR-B merged. **Also depends on F1** (move `Dashboard.js`
to `src/shell/` per ADR-0001) — file that PR-C-prep first if F1 hasn't shipped.
**Approvers:** 1 feature owner from each touched slice (nutrition, weight,
education).
**Risk:** medium-high (large UI surface; protected by flag).

### Files (est.)

| File | Change |
|---|---|
| `frontend/src/shell/components/Dashboard.js` (post-F1 location) | Add 4th tab "Diary" when `ff.diary-feed` ON. Existing 3 tabs stay rendered while the flag is OFF or per-user opt-out. **No removal of legacy tabs in this PR.** |
| `frontend/src/features/diary/` *(NEW slice — composition; allowed because it has its own components/hooks/api/domain, see §2.1)* | New folder. README declares ownership, public API, threat model (per §2.3). |
| `frontend/src/features/diary/components/DiaryFeed.jsx` | Presentational. Renders rows by `kind`: `FoodRow`, `WeightRow`, `EducationRow`, `WatchRow`, `OtherRow`. ≤350 LOC. |
| `frontend/src/features/diary/components/OtherRow.jsx` | Renders unknown captures with Retry + Manual edit buttons. |
| `frontend/src/features/diary/hooks/useDiary.js` | Data fetching against `/api/diary/list`, shared `selectedDate`. |
| `frontend/src/features/diary/api/diaryClient.js` | Axios client. |
| `frontend/src/features/diary/index.js` | Barrel. |
| `frontend/src/features/diary/__tests__/MATRIX.md` | §9.3 test matrix (filled before code per the prompt). |
| `frontend/src/features/diary/__tests__/DiaryFeed.test.jsx` | Render-by-kind, Retry click → calls client, Edit click → opens `SmartFoodSearchModal`. |
| `frontend/src/features/nutrition/hooks/useDayAnalyses.js` | **No change** — the legacy food tab keeps reading from `listAnalyses`. |
| `frontend/src/features/weight/components/WeightDashboard.js` | Add `selectedDate` prop respect (Diary will pass it). Behaviour-flag the date-filter so the legacy Weight tab stays untouched. |
| `frontend/src/features/education/components/EducationDashboard.js` | Same as Weight. |

**LOC budget:** new feature ~700 + tweaks ~80 + tests ~400. ✅ feature cap.

**Required:**
- `frontend/src/features/diary/README.md` (purpose, public API, owners, deps, threat model) per §2.3.
- §9.3 matrix filled.
- Coverage floors per layer (§9.1).

---

## PR-D — App.js image-analysis change (remove the modal-ask)

**Branch:** `feat/diary-d-app-flow`
**Depends on:** PR-C merged (so users with the flag ON have somewhere to see the row).
**Approvers:** 1 feature owner (App.js touches cross-feature glue — `@principal-eng` heads-up).
**Risk:** medium (visible UX change, easy revert via flag).

### Files (est.)

| File | Change |
|---|---|
| `frontend/src/App.js` | In the `isLowConfidenceFood(detectedType)` branch (currently lines ~4206–4221): when `ff.diary-feed` is ON, skip `setUnknownCaptureModal({open:true,…})`. The capture is still tagged `unknown` (no change), so the new Diary row appears immediately. When the flag is OFF, the existing PR-3 modal still opens. |
| `frontend/src/App.js` | Mount the Diary `SmartFoodSearchModal` consumer for the "promote unknown → food" save path (calls `PATCH /api/captures/:id` to update type via the new transition + reuses `saveNutritionAnalysis`). |
| `frontend/src/App.js __tests__` or e2e | E2E journey: capture blank-wall → row appears as Other → Retry → still Other → Edit → search "dosa" → pick latest → row becomes Food. Tagged `@regression`. |
| `frontend/src/features/captures/UnknownCaptureModal.jsx` | **Untouched** in this PR. Removed in a later cleanup PR after the flag is fully rolled out (F4). |

**LOC budget:** ~80 production + ~250 tests. ✅

---

## PR-E — Share-link viewer for `unknown` captures

**Branch:** `feat/diary-e-share-unknown`
**Depends on:** PR-A merged (reuses `canRetryCapture` policy + retry endpoint).
**Approvers:** 1 feature owner + `@principal-eng` (share-link surface is
public-facing).
**Risk:** low (additive UI path).

**Q4 resolution recap:** the viewer renders the **image** plus **Retry** and
**Edit** buttons. Buttons are visible only when the request is authenticated
AND `canRetryCapture({ viewerId, ownerId })` passes (owner or coach-of-owner
per Q6). Anonymous link recipients see image-only.

### Files (est.)

| File | Change |
|---|---|
| `backend/pages/api/captures/resolve/[token].js` | Stop 404-ing `unknown` rows; return `{ kind: 'unknown', capture, image, canMutate: boolean }` where `canMutate` is computed server-side from the session via `canRetryCapture`. |
| `backend/features/captures/__tests__/resolve.test.js` | Add cases: anonymous → `canMutate:false`; owner authed → `canMutate:true`; coach authed → `canMutate:true`; stranger authed → `canMutate:false`; keep historic-orphan 404 path. |
| `frontend/src/features/captures/components/UnknownShareViewer.jsx` | New. Image card layout (matches the food-card opened chrome minus nutrition rows). Renders `Retry` + `Edit` buttons gated on `canMutate`. Retry calls `POST /api/captures/retry-analysis`; Edit opens `SmartFoodSearchModal` and on save calls the same promote-to-food path used by PR-D. |
| `frontend/src/features/captures/__tests__/UnknownShareViewer.test.jsx` | Anonymous render hides buttons; authed-owner render shows both; Retry click → client call; Edit click → modal opens. |
| App.js share-link router (line ~963) | Route `imageType==='unknown'` to the new viewer instead of the existing 404 path. |

**LOC budget:** ~200 production + ~200 tests. ✅

---

## Cross-cutting checks (run on every PR above)

- §9.1 coverage floors per layer (domain ≥95%, validation ≥95%, api ≥85%).
- §9.5 impacted-tests script auto-runs dependent feature suites whenever
  `captures/domain/*` or `shared/*` is touched.
- §11.3 branch protection — PR-A and PR-E require 2 approvals because
  `@principal-eng` is mandatory.
- §10.2 QA-bot run on staging before PR-D rolls the flag on for >5% of users.
- §6.4 squash-merge only; CHANGELOG entry per PR.

## Confidence (claude.md §5.3)

| Artefact | Confidence | Notes |
|---|---|---|
| Feature folder mapping (Step 1.1) | 95 | Verified against the codebase. |
| Reuse-over-rewrite audit (Step 1.4) | 90 | Verified `SmartFoodSearchModal`, `searchFoodHistory`, `tabForImageType` all exist and are reusable. |
| PR-A scope (one-transition addition + dedup flip + coach-aware policy) | 90 | Coach permission adds a `hierarchyHelpers.isCoachOf` call; verified the helper exists per §3.4. |
| PR-B scope | 85 | Permission predicate reuses the same `isCoachOf` helper. |
| PR-C scope | 75 | F1 (Dashboard.js move to `src/shell/`) is a prerequisite I haven't sequenced — flag at PR-C kickoff. |
| PR-D scope | 90 | The `App.js` branch lines are known. |
| PR-E scope | 88 | Unblocked by Q4 + Q6. Remaining risk: confirming the existing share-link route's auth-detection path returns a usable session for `canMutate`. |

## Assumptions made

- The dedup flip keeps the *response shape* identical, so `SmartFoodSearchModal`
  needs no change beyond what PR-C already does. To verify in PR-A.
- Watch-only days (no food) should still show watch rows in Diary — confirmed
  by the chosen "date filters all read-models uniformly" answer.
- `unknown → food` is the **only** loosening the state machine needs; the
  other four terminals stay immutable. Confirmed by the product answers.

## Claude.md rules considered and how the plan satisfies each

- **§1.1 #1, #2** (no edit without understanding, reuse before rewrite) —
  Step 1 architecture analysis done; reuse audit (§1.4 in ADR-0003) cites
  existing helpers for every behaviour.
- **§1.1 #3** (business logic in one place) — domain edits land in
  `captures/domain` and `food-corrections.service`; no logic leaks to
  `pages/api` or React.
- **§1.1 #4, #5** (traceable, tested) — every PR ships tests + a
  CHANGELOG-eligible squash message.
- **§1.1 #6** (backward-compat) — see ADR-0003 Negative consequences; the
  flag-gated rollout preserves PR 3's behaviour for non-flagged users.
- **§2.4** (shared graduation) — `features/diary/` is a new slice, not a
  `shared/` graduation; satisfies the three-condition rule.
- **§3.3** — Business Logic Impact Blocks attached to PR-A (mandatory).
- **§3.4** — Single source of truth preserved: the diary read-model joins;
  it does not duplicate calculations.
- **§3.5** — `ff.diary-feed` registered with owner + removal target.
- **§4.4** — Each PR within the feature size cap.
- **§5.3** — Per-artefact confidence stated above.
- **§5.4** — PR-A flagged as touching a §5.4 sensitive file; requires
  `@principal-eng` mention.
- **§5.5** — PR-A explicitly requires human reviewer LGTM.
- **§9.1** / **§9.3** — Coverage floors and matrix obligations called out
  per PR.

## STOP-gates before this plan moves to code

1. `@principal-eng` LGTM on ADR-0003.
2. ~~Product answers Q4 (unknown share-link viewer shape) — blocks PR-E.~~ ✅ Resolved: Image + Retry/Edit buttons (auth-gated).
3. ~~Product answers Q6 (coach Retry permission) — blocks PR-A acceptance.~~ ✅ Resolved: owner OR coach-of-owner (admin inherits).
4. F1 status: confirm whether `Dashboard.js` ships to `src/shell/` before
   PR-C or as the first commit of PR-C.
