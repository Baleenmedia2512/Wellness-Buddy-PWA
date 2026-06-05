# Test Matrix — diary (frontend)

Reference: [claude.md §9.3](../../../../../claude.md#93-feature-testing-matrix-template).

| Capability | Unit | Integration | E2E | Permissions | Edge cases |
|------------|------|-------------|-----|-------------|------------|
| `useDiary` — fetch / abort / refresh | ✅ | ⬜ | ⬜ | N/A | ✅ (missing inputs, bad date, 401 / 403 / 500, abort on unmount, refresh bumps re-fetch) |
| `toYmd` — IST date normalisation | ✅ | N/A | N/A | N/A | ✅ (Date input, YYYY-MM-DD pass-through, invalid string → null, late-evening IST does NOT shift) |
| `DiaryFeed` — render-by-kind | ✅ | ⬜ | ⬜ | N/A | ✅ (loading skeleton, error state, empty state, 5 kinds dispatch to right row, unknown→OtherRow fallback) |
| Row components (Food/Weight/Education/Watch/Other) | ✅ (smoke) | ⬜ | ⬜ | N/A | ⚠️ (snapshots not used — assertions on visible text per §9.4) |
| Dashboard.js — Diary tab visible iff flag ON | ✅ (config test) | ⬜ | ⬜ | N/A | ✅ (env override, localStorage override, default OFF, unknown flag fails closed) |

Legend: ✅ covered · ⚠️ partial · ❌ missing · ⬜ deferred.

## User journeys (claude.md §9.4)

1. **Self diary, default day** — user opens Dashboard → taps the
   Diary tab (after enabling the flag) → today's food + weight +
   education entries render newest-first → tapping a card opens the
   per-vertical detail modal (PR-D wires the click handlers
   end-to-end).
2. **Coach views member diary** — coach selects a team member via
   `TeamMemberSearch` → tab switches to Diary → the same feed
   renders for the member, backed by a coach-authorised read
   (server-audited).
3. **Day with nothing logged** — empty state renders, suggests
   adding an entry; coaches see the "Try a different date" copy
   instead.
4. **Read fails (403 / 500)** — error state renders with a Retry
   button for transient failures; auth failures suppress the
   button.
5. **Flag OFF** — tab is not mounted; nothing under `features/diary/`
   is loaded into the user's bundle.

## Known gaps

- No live-backend integration test yet — `useDiary` is unit-tested
  against a mocked `fetchDiary`. Adds in the cross-feature
  integration suite when `msw` / live backend wiring lands per
  `governance/ROLLOUT.md`.
- E2E (Playwright) journey ships in PR-D alongside the App.js flow
  change — the journey is "capture blank wall → row appears as
  Other → Retry → still Other → Edit → save → row becomes Food".
- Cross-day pagination is intentionally NOT in PR-C scope; the
  feed is single-day. A "load older days" mode is tracked as a
  PR-C follow-up.
