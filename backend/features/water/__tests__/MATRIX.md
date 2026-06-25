# Test Matrix — water (backend)

Reference: [claude.md §9.3](../../../../claude.md#93-feature-testing-matrix-template).

| Capability                              | Unit | Integration | E2E | Permissions | Edge cases |
|-----------------------------------------|:----:|:-----------:|:---:|:-----------:|:----------:|
| Compute required ml from weight         |  ✅  |     ⬜      | ⬜  |     n/a     |     ✅     |
| Parse AnalysisData (object / string)    |  ✅  |     ⬜      | ⬜  |     n/a     |     ✅     |
| Extract water ml from a food record     |  ✅  |     ⬜      | ⬜  |     n/a     |     ✅     |
| Aggregate daily intake                  |  ✅  |     ⬜      | ⬜  |     n/a     |     ✅     |
| Validate query (`validateGetIntake`)    |  ⬜  |     ⬜      | ⬜  |     ⬜      |     ⬜     |
| GET `/api/water/intake` happy path      |  n/a |     ⬜      | ⬜  |     ⬜      |     ⬜     |
| GET `/api/water/intake` no weight       |  n/a |     ⬜      | ⬜  |     ⬜      |     ⬜     |

Legend: ✅ covered · ⚠️ partial · ❌ missing · ⬜ not yet assessed.

## User journeys (claude.md §9.4)
1. New user with no weight logged opens the Water tab → sees 2500 ml target,
   0 ml drunk, 0 % progress.
2. User with weight 70 kg logs 1 L of water via food scanner → tab shows
   1000 / 3500 ml, 29 %, not achieved.
3. User crosses the target → tab shows "achieved", 100 % progress, remaining
   clamps to 0.

## Known gaps
- No integration test against a real Supabase test project yet. Planned: use
  `pg-mem` seeded with the two relevant tables.
- No permissions test — feature still trusts the `userId` query param
  (see threat-model section in `README.md`). Hard requirement before the
  release that adds Wellness Counselling roles.
- No rate-limit test — feature is not yet rate-limited.
