# Diary (frontend slice)

**Owner:** `@principal-eng` (per `.github/CODEOWNERS`).
**Status:** Active — introduced in PR-C of
[ADR-0003](../../../../docs/adr/0003-diary-tab-consolidation.md).

## Purpose

The Diary slice is the **read surface** for the consolidated day view
introduced in ADR-0003. It renders a single cards-only feed that
merges Food / Weight / Education / Watch entries (plus the `unknown`
"Other" rows when `ff.diary-feed` is ON) for one owner + one IST day,
newest-first.

PR-C ships the slice **dark by default**: the `Dashboard.js` shell
only mounts the Diary tab when `isFlagEnabled('ff.diary-feed')` is
true. The existing Food / Weight / Education tabs remain unchanged
while the flag is OFF.

## Public API

| Export       | Kind      | Purpose                                                        |
| ------------ | --------- | -------------------------------------------------------------- |
| `DiaryFeed`  | Component | The cards feed. Owns no async; consumes `useDiary` internally. |
| `useDiary`   | Hook      | Subscribes to `GET /api/diary/list`. Returns `{ loading, error, data, refresh }`. |

Imported via:

```js
import { DiaryFeed, useDiary } from './features/diary';
```

## Folder shape

```
diary/
├── api/
│   └── diaryClient.js       # ONLY file allowed to talk to the network
├── components/
│   ├── DiaryFeed.jsx        # orchestrator + loading/error/empty states
│   └── rows/
│       └── index.js         # FoodRow, WeightRow, EducationRow, WatchRow, OtherRow
├── hooks/
│   └── useDiary.js          # data fetching + abort handling
├── __tests__/
│   └── MATRIX.md
├── index.js                 # barrel
└── README.md
```

## Dependencies

- `frontend/src/config/api.config` — base URL.
- `frontend/src/config/featureFlags` — `ff.diary-feed` mirror.
- `frontend/src/shared/utils/fetchWithAbort` — abort-error detector.
- `frontend/src/shared/utils/logger`        — debug logging.
- **Backend:** `GET /api/diary/list` (PR-B of ADR-0003).

No cross-feature imports. Row components consume the projected
`payload` shape from the backend `toDiaryEntry` — there is no
schema duplication on the frontend (per claude.md §3.4).

## Threat model

- **Owner forging / capture-id forging:** the endpoint enforces
  owner-or-coach permissions server-side (see PR-A.2 audit notes).
  The frontend never trusts `ownerUserId` from the URL — it is
  always passed in by the parent shell from the resolved session
  user (self) or from `TeamMemberSearch` (coach picking a member).
- **PII leakage in row rendering:** rows display only the projected
  `payload` fields — image base64, calendar values, and the watch
  `Topic` string. No emails / phone numbers / tokens are ever in
  the response.
- **Click-to-open without permission:** `onEntryOpen` is wired by
  the shell; permission for the resulting modal (delete / edit /
  retry) is enforced server-side by the existing per-vertical
  endpoints. The Diary row click itself opens read-only modals
  in PR-C.
- **Cancellation safety:** every fetch is bound to an `AbortController`
  and the hook checks `isAbortError` before surfacing failure.

## Tests

See [`__tests__/MATRIX.md`](./__tests__/MATRIX.md). Coverage floors per
claude.md §9.1 — hooks ≥ 85 %, components ≥ 70 %.
