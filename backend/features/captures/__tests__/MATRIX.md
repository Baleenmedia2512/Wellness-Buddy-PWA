# Test Matrix — captures

Reference: [claude.md §9.3](../../../../claude.md#93-feature-testing-matrix-template).

| Capability | Unit | Integration | E2E | Permissions | Edge cases |
|------------|------|-------------|-----|-------------|------------|
| `image-types` state machine (pending → terminals) | ✅ | N/A | N/A | N/A | ✅ (every transition + invalid inputs) |
| `image-types` `unknown → food` cross-state (PR-A / ADR-0003) | ✅ | ⬜ | ⬜ | N/A | ✅ (rejects unknown→weight/education/smartwatch, rejects food→unknown) |
| `captures.service.recordPending` | ✅ | ⬜ | ⬜ | N/A | ✅ (missing token, missing userId) |
| `captures.service.updateType` | ✅ | ⬜ | ⬜ | ✅ (wrong owner returns NOT_FOUND) | ✅ (illegal transition, already-terminal, same-state no-op, PR-A unknown→food) |
| `domain/permissions/retry.policy` (PR-A) | ✅ | ⬜ | ⬜ | ✅ (owner / coach allowed; stranger / co-coach / anonymous denied) | ✅ (mixed-type ids, deep chain, empty chain, member-left-team) |
| Dual-write from `background-analysis` → captures | ✅ (service-level mock) | ⬜ | ⬜ | N/A | ✅ (captures write failure does NOT fail user request) |

Legend: ✅ covered · ⚠️ partial · ❌ missing · ⬜ deferred (needs pg-mem / test Supabase project).

## User journeys (claude.md §9.4)

The captures slice is plumbing — it has no direct user journeys in PR 2.
Frontend journeys are covered by `frontend/src/features/*/__tests__/MATRIX.md`
after PR 3. The PR-A additions (state-machine loosening and retry policy)
become user-visible in PR-D (App.js unknown-flow change) and PR-E (share-link
viewer for unknown captures) — see [ADR-0003](../../../../docs/adr/0003-diary-tab-consolidation.md).

## Known gaps

- Integration tests against a live Postgres/Supabase project are deferred
  to the cross-feature integration suite per claude.md §9.6.
- The Vercel cron endpoint is unit-tested but its scheduled execution is
  validated manually in staging until the perf suite covers crons.
- `retry.policy` is shipped without a consumer endpoint in PR-A; the
  integration test against an HTTP handler lands in PR-A.2 alongside the
  new `POST /api/captures/retry-promotion` route.

