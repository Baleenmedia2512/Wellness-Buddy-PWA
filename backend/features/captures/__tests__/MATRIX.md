# Test Matrix — captures

Reference: [claude.md §9.3](../../../../claude.md#93-feature-testing-matrix-template).

| Capability | Unit | Integration | E2E | Permissions | Edge cases |
|------------|------|-------------|-----|-------------|------------|
| `image-types` state machine | ✅ | N/A | N/A | N/A | ✅ (every transition + invalid inputs) |
| `captures.service.recordPending` | ✅ | ⬜ | ⬜ | N/A | ✅ (missing token, missing userId) |
| `captures.service.updateType` | ✅ | ⬜ | ⬜ | ✅ (wrong owner returns NOT_FOUND) | ✅ (illegal transition, already-terminal, same-state no-op) |
| Dual-write from `background-analysis` → captures | ✅ (service-level mock) | ⬜ | ⬜ | N/A | ✅ (captures write failure does NOT fail user request) |

Legend: ✅ covered · ⚠️ partial · ❌ missing · ⬜ deferred (needs pg-mem / test Supabase project).

## User journeys (claude.md §9.4)

The captures slice is plumbing — it has no direct user journeys in PR 2.
Frontend journeys are covered by `frontend/src/features/*/__tests__/MATRIX.md`
after PR 3.

## Known gaps

- Integration tests against a live Postgres/Supabase project are deferred
  to the cross-feature integration suite per claude.md §9.6.
- The Vercel cron endpoint is unit-tested but its scheduled execution is
  validated manually in staging until the perf suite covers crons.
