# Test Matrix — nutrition-centers

Reference: [claude.md §9.3](../../../../claude.md#93-feature-testing-matrix-template).

| Capability | Unit | Integration | E2E | Permissions | Edge cases |
|------------|------|-------------|-----|-------------|------------|
| Register centre | ✅ (validators) | ⬜ | ⬜ | ⬜ | ✅ (dup name) |
| Unregister centre | ✅ (validators) | ⬜ | ⬜ | ✅ (owner/admin) | ⬜ |
| List centres | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| **Edit centre** | ✅ `centers.update.test.js` + validators | ⬜ | ⬜ | ✅ (owner, admin, non-owner→403, deleted→404) | ✅ (same name skip-self, no-field 400, bad coords) |

Legend: ✅ covered · ⚠️ partial · ❌ missing · ⬜ not yet assessed.

## User journeys (claude.md §9.4)

1. Coach registers a new centre → appears in "My Registered Centres" list.
2. Coach taps ✏️ Edit on a centre → form pre-fills with existing data; map marker repositions → saves → list refreshes with new name.
3. Coach tries to rename centre to an already-taken name → blocked with duplicate error.
4. Admin edits a centre they don't own → allowed (403 guard passes for admin role).
5. Non-owner member tries to edit another coach's centre → API returns 403.

## Known gaps
- Integration (supertest) tests for `PATCH /api/nutrition-centers` — target next sprint.
- E2E Playwright journey for edit flow — target next sprint.
