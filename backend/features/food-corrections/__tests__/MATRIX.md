# Test Matrix — food-corrections

Reference: [claude.md §9.3](../../../../claude.md#93-feature-testing-matrix-template).

| Capability | Unit | Integration | E2E | Permissions | Edge cases |
|------------|------|-------------|-----|-------------|------------|
| Validators (`validateSearch`, `validateSaveCorrection`, `validateUpdateAnalysis`, …) | ✅ | ⬜ | ⬜ | N/A | ✅ (missing fields, empty strings, type mismatches) |
| `searchFoodHistory` — latest-wins dedup invariant (PR-A / ADR-0003) | ✅ | ⬜ | ⬜ | N/A | ✅ (5+: duplicate names, mixed user+community, case-insensitive keying, malformed JSON, no matches) |
| `saveCorrection`, `updateAnalysis`, `getStats` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |

Legend: ✅ covered · ⚠️ partial · ❌ missing · ⬜ not yet assessed.

## User journeys (claude.md §9.4)

1. User opens the manual food picker, types "dosa", sees the latest nutrition
   they previously logged for that name (covered indirectly by the
   `latest-wins dedup invariant` test; full E2E lands with PR-C).
2. TODO — coach edits a member's meal correction.
3. TODO — global correction propagation.

## Known gaps

- No integration coverage against a live Supabase project (cross-feature
  integration suite, per claude.md §9.6).
- `saveCorrection` / `updateAnalysis` still untested at the service layer.
  Target: PR-A.2 (when the new retry endpoint also exercises updateAnalysis).
