# Test Matrix — background-analysis

Reference: [claude.md §9.3](../../../../claude.md#93-feature-testing-matrix-template).

| Capability | Unit | Integration | E2E | Permissions | Edge cases |
|------------|------|-------------|-----|-------------|------------|
| `createPendingCapture` — validates + inserts pending row | ✅ | ⬜ | ⬜ | ⬜ | ✅ (invalid userId, missing base64) |
| `getPublicCapture` — returns pending/enriched state | ✅ | ⬜ | ⬜ | ✅ (expired token) | ✅ (no expiry, pending) |
| `save` — extracts sugar/sodium/cholesterol (migration 0009 regression) | ✅ | ⬜ | ⬜ | N/A | ✅ (foods+total, nutrition, foods-only, pre-fix null, explicit-zero) |
| `getPublicCapture` — exposes sugar/sodium/cholesterol in nutrition response | ✅ | ⬜ | ⬜ | N/A | ✅ (populated values, NULL legacy rows) |
| `list` — returns enriched captures with pagination | ✅ | ⬜ | ⬜ | ⬜ | ✅ (empty set, hasMore, userId forwarding) |
| Orphan-row guard — pending captures (null AnalysisData) excluded from list | ✅ (service contract) | ⬜ (needs pg-mem or Supabase test project) | ⬜ | N/A | ✅ (all-orphan case returns empty) |
| `retryPromotionToFood` — Diary Other → Retry/Edit promotion (PR-A.2 / ADR-0003) | ✅ | ⬜ | ⬜ | ✅ (owner allowed, coach-of-owner allowed + audit-logged, stranger 403, co-coach 403, member-left-team 403) | ✅ (NOT_RETRYABLE for every non-unknown state, CAPTURE_NOT_FOUND, missing UserID, insert vs update path, imagePath fallback) |
| `validateRetryPromotion` — input schema | ✅ | N/A | N/A | N/A | ✅ (missing fields, wrong types, null analysis, JSON-string vs object) |
| `listDiaryEntries` — joined feed read-model (PR-B / ADR-0003) | ✅ | ⬜ | ⬜ | ✅ (owner allowed + not audited, coach-of-owner allowed + audit-logged, stranger 403, anonymous 401) | ✅ (4-stream join + sort, flag OFF excludes unknown without querying, flag ON includes unknown, per-vertical read failure degrades gracefully, empty day, watch kcal parse with malformed Topic) |
| `validateDiaryList` — input schema | ✅ | N/A | N/A | N/A | ✅ (missing fields, malformed date, impossible calendar date, future date rejected, today accepted) |
| `toDiaryEntry` — pure projection | ✅ | N/A | N/A | N/A | ✅ (food / weight / education / watch / unknown shapes, food without CaptureID, watch parser, unknown kind throws) |
| `feature-flags` registry (`isEnabled`, `findStaleFlags`) | ✅ | N/A | N/A | N/A | ✅ (defaults, env override true/false/case-insensitive, garbage env, unknown flag fails closed, stale detection) |

Legend: ✅ covered · ⚠️ partial · ❌ missing · ⬜ not yet assessed.

## User journeys (claude.md §9.4)

1. **Food photo captured** — user takes a photo of food; instant-share URL is created in parallel; nutrition analysis completes and the row appears in the dashboard.
2. **Weight scale photo captured** — user takes a photo of a weight scale; the pre-created pending capture row is soft-deleted; the row does **not** appear in the nutrition dashboard.
3. **Education screenshot captured** — user takes a screenshot of a meeting; pending capture is soft-deleted; does not pollute the nutrition dashboard.
4. **Smartwatch screenshot captured** — pending capture is soft-deleted; calorie burn is recorded separately; nutrition dashboard unaffected.
5. **Public share link opened** — visitor opens the share URL; sees nutrition data if analysis complete, "pending" state if not yet enriched.
6. **Diary "Other" row Retry/Edit** (PR-A.2 → PR-C/D for UI) — user (or their coach) opens an `unknown` capture in the Diary, supplies a new Gemini analysis (Retry) or a manual nutrition payload (Edit), and the capture is promoted to `food` in place. Auth gate: owner or anyone in the owner's upline.
7. **Diary feed list** (PR-B → PR-C for UI) — user (or their coach) opens the Diary view for a specific day; sees food + weight + education + watch entries merged and sorted newest-first; the unknown-row inclusion is server-gated by `ff.diary-feed` so the legacy "food-only feed" behaviour is preserved when the flag is OFF.

## Known gaps

- Integration tests (`⬜`) require a test Supabase project or `pg-mem` setup. The orphan-row filter (`.not('"AnalysisData"', 'is', null)`) is verified at the unit level by testing service contracts; a DB-level integration test would give higher confidence.
- E2E coverage is not yet written for this feature. Target: next sprint.
- `retryPromotionToFood` integration (live HTTP → DB) lands with the cross-feature integration suite once `pg-mem` ships per `governance/ROLLOUT.md`.
- `listDiaryEntries` integration (live HTTP → DB join) lands with the same cross-feature integration suite.


