# Test Matrix — background-analysis

Reference: [claude.md §9.3](../../../../claude.md#93-feature-testing-matrix-template).

| Capability | Unit | Integration | E2E | Permissions | Edge cases |
|------------|------|-------------|-----|-------------|------------|
| `createPendingCapture` — validates + inserts pending row | ✅ | ⬜ | ⬜ | ⬜ | ✅ (invalid userId, missing base64) |
| `getPublicCapture` — returns pending/enriched state | ✅ | ⬜ | ⬜ | ✅ (expired token) | ✅ (no expiry, pending) |
| `list` — returns enriched captures with pagination | ✅ | ⬜ | ⬜ | ⬜ | ✅ (empty set, hasMore, userId forwarding) |
| Orphan-row guard — pending captures (null AnalysisData) excluded from list | ✅ (service contract) | ⬜ (needs pg-mem or Supabase test project) | ⬜ | N/A | ✅ (all-orphan case returns empty) |

Legend: ✅ covered · ⚠️ partial · ❌ missing · ⬜ not yet assessed.

## User journeys (claude.md §9.4)

1. **Food photo captured** — user takes a photo of food; instant-share URL is created in parallel; nutrition analysis completes and the row appears in the dashboard.
2. **Weight scale photo captured** — user takes a photo of a weight scale; the pre-created pending capture row is soft-deleted; the row does **not** appear in the nutrition dashboard.
3. **Education screenshot captured** — user takes a screenshot of a meeting; pending capture is soft-deleted; does not pollute the nutrition dashboard.
4. **Smartwatch screenshot captured** — pending capture is soft-deleted; calorie burn is recorded separately; nutrition dashboard unaffected.
5. **Public share link opened** — visitor opens the share URL; sees nutrition data if analysis complete, "pending" state if not yet enriched.

## Known gaps

- Integration tests (`⬜`) require a test Supabase project or `pg-mem` setup. The orphan-row filter (`.not('"AnalysisData"', 'is', null)`) is verified at the unit level by testing service contracts; a DB-level integration test would give higher confidence.
- E2E coverage is not yet written for this feature. Target: next sprint.

