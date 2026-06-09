# ADR-0003 — Consolidate Food / Weight / Education / Watch dashboard tabs into a unified Diary feed, and let manual edit promote `unknown` captures

- **Status:** Proposed
- **Date:** 2026-06-05
- **Authors:** @ai-assisted (drafted under PROMPT 1 — Feature Development)
- **Approvers:** @principal-eng (required: §5.4 unsafe-edit gate on `captures/domain/image-types.js`; §3.3 Business Logic Impact Block on `food-corrections.service.js` dedup policy and on the capture state machine).

## Context

Today the in-app `Dashboard` (`frontend/src/shared/components/Dashboard.js`)
exposes three top-level tabs — **Food**, **Weight**, **Education** — backed by
three independent slice orchestrators (`NutritionDashboard`, `WeightDashboard`,
`EducationDashboard`) with their own date pickers, summary cards and history
lists. Smartwatch screenshots are not a tab at all — they surface as
`WatchActivityCard` on the home page and as the burn-to-balance widget inside
the Food tab; the underlying rows are stored in `education_logs_table` with
`Topic LIKE 'Calories Burned:%'`.

When the Gemini detector cannot confidently classify an upload, PR 3 added a
disambiguation modal (`UnknownCaptureModal`) and tags the capture
`ImageType = 'unknown'`; the capture state machine
(`backend/features/captures/domain/image-types.js`) declares terminal types
**immutable**. Unknown captures are deliberately filtered out of the food
feed (`listAnalyses` requires `AnalysisData IS NOT NULL`).

Product wants:

1. A single **Diary** tab that merges all four record types, with one shared
   date picker and the existing coach search / summary cards preserved.
2. AI detection failures must **not** prompt the user — they should land in
   the Diary as **"Other"** rows.
3. Each Other row gets a **Retry** button (re-runs Gemini) and a **Manual
   edit** path that opens the existing `SmartFoodSearchModal` and, on save,
   **promotes the capture `unknown → food`** with the chosen nutrition.
4. The food-name DB search must prefer the **most recent** record per name
   when duplicates exist (today it keeps the first).
5. Share-link viewers for `unknown` captures must show the image card in its
   "opened" layout instead of 404 / blank.

This change touches:

- Capture domain (state-machine loosening) — §3.4 single-source-of-truth.
- Food-corrections domain (dedup policy flip first→latest) — §3.3 disclosure.
- Cross-feature UI composition (Dashboard tabs → Diary feed) — §2.4 shared
  graduation policy, and ADR-0001's pending `src/shell/` layer.
- App.js image-analysis branch (removal of the `UnknownCaptureModal` open
  call) — §1.1 #6 backward-compat.

This is well past the §4.4 size cap for a single feature PR (25 files /
800 LOC) and must be split into the sequenced plan in
[`docs/pr-drafts/diary-tab-consolidation.md`](../pr-drafts/diary-tab-consolidation.md).

## Considered options

1. **Single mega-PR** — touch the captures domain, food-corrections dedup,
   four dashboards, App.js, share-link viewer and tests in one diff. Rejected:
   blows §4.4 and concentrates blast radius on `image-types.js` (a §5.4
   restricted file) with no incremental rollback path.

2. **Composition-only Diary, leave domains alone** — render the existing
   three tabs side-by-side in one scroll feed without changing the capture
   state machine or the dedup policy. Rejected: cannot deliver requirements
   #3 (promote `unknown → food`) or #4 (latest-wins) without the domain edits.

3. **Sequenced 5-PR rollout behind a `ff.diary-feed` flag** *(chosen)*:
   - PR-A: domain-only — dedup policy flip + retry endpoint + state-machine
     `unknown → food` transition. Backend, fully revertible, feature-flagged.
   - PR-B: backend read-model — `listDiaryEntries` that joins food + weight +
     education + watch rows under one shared date.
   - PR-C: frontend Diary shell — new `DiaryFeed` presentation component
     mounted in `Dashboard.js` under the flag; legacy tabs stay alive while
     the flag is off.
   - PR-D: App.js image-analysis flow change — remove
     `UnknownCaptureModal.open` call, gated by the same flag.
   - PR-E: share-link viewer for `unknown` captures.

4. **Do nothing** — fails the product brief.

## Decision

Adopt option 3. Each PR ships with its own tests, its own Business Logic
Impact Block where it touches `domain/`, and stays within §4.4. The
`ff.diary-feed` flag (registered per §3.5 with owner + removal-target date)
gates PR-B onwards so PR-A is independently shippable.

### Pinned product answers (clarification rounds, 2026-06-05)

| Question | Resolution |
|---|---|
| What is the "smartwatch tab"? | The current Food-tab burn-to-balance widget. Watch entries become standalone Diary rows; the widget reads from the same rows. |
| "Latest record's nutrition for all" scope | Search-picker only. Flip `dedupItems` from first-wins to last-wins. **No** retroactive writes to prior unknown rows. |
| Manual edit on `unknown` row | Promote the capture `unknown → food`. Requires loosening `image-types.js` to allow exactly this one extra transition. |
| Date picker scope | Drives every Diary vertical (food, weight, education, watch) uniformly. |
| **Q4** — Unknown share-link viewer layout | **Image + Retry + Edit buttons.** Same chrome as an opened food card minus the nutrition rows. Buttons render only when the viewer is opened by an authenticated user who passes the Retry/Edit permission check (see Q6); for anonymous link recipients, only the image is shown. |
| **Q6** — Retry / Edit permissions | **Owner OR a coach in the owner's upline.** Resolved via `backend/utils/hierarchyHelpers.js` (`isCoachOf(viewerId, ownerId)`). Admin role inherits coach permissions. Anonymous viewers (share-link recipients without auth) cannot Retry/Edit. |

## Consequences

- **Positive**
  - Single Diary surface matches product intent and removes per-tab date
    drift.
  - Capture state-machine change is **monotonic** (one new transition added,
    no existing ones removed), so existing tests keep passing.
  - Each PR is independently revertible behind the flag.
  - No new top-level folder needed — Diary is composition over existing
    slices (§2.4 not triggered).

- **Negative**
  - Partially reverses PR 3's "don't pollute the food feed" intent. Mitigated
    by: (a) Other rows are visually distinct, (b) the feed read-model is the
    new `listDiaryEntries`, not the existing food `listAnalyses` (no
    regression to the feed shared with share-link resolution).
  - `image-types.js` is touched, which is a §5.4 sensitive edit and requires
    `@principal-eng` review on PR-A.
  - Five PRs and a feature flag means coordination overhead — see release
    plan in `docs/pr-drafts/diary-tab-consolidation.md`.

- **Follow-ups (issues to file)**
  - **F1.** Migrate `Dashboard.js` to `src/shell/` per ADR-0001 *before* PR-C
    so the new `DiaryFeed` doesn't inherit the dependency violation.
  - **F2.** Decide retention policy for permanently-`unknown` captures
    (still tracked from PR 2's captures README).
  - **F3.** ~~Resolve open Q4 / Q6 above and amend this ADR.~~ ✅ Resolved 2026-06-05.
  - **F4.** Once the flag is fully rolled out and legacy tabs removed, file
    a cleanup PR per §3.5 stale-flag rule (90-day target from PR-C merge).
  - **F5.** Audit-log every Retry/Edit performed by a coach on a member's
    capture (own action by owner stays unlogged) — feed into the existing
    structured logger with `{ actorId, ownerId, captureId, action }`.
    Compliance/observability requirement implied by Q6.

## References

- claude.md sections: §1.1 #6 (backward-compat), §2.4 (shared graduation),
  §3.3 (Business Logic Impact Block), §3.4 (single source of truth), §3.5
  (feature flags), §4.4 (PR size), §5.4 (unsafe-edit detection), §5.5
  (mandatory human review).
- Related ADRs: ADR-0001 (shell composition layer — F1 above depends on it).
- Related code: `backend/features/captures/`, `backend/features/food-corrections/`,
  `backend/features/background-analysis/`, `frontend/src/shared/components/Dashboard.js`,
  `frontend/src/features/{nutrition,weight,education,activity,captures}/`,
  `frontend/src/App.js` (image-analysis branch).
- Tickets: TODO — link the diary-consolidation epic when filed.
