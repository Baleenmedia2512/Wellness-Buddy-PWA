# captures

Owner: `@principal-eng` (interim — assign on next CODEOWNERS update).

## Purpose

Single source of truth for **photo captures** — the raw image the user takes
before any feature claims it. Each capture is identified by a `PublicShareToken`
(UUID) and has exactly one `ImageType` from the enum:

```
pending → food | weight | education | smartwatch | unknown
```

Terminal types are immutable. A misclassification is corrected by creating a
new capture, not by mutating the existing one.

## Public API

This slice exposes **no HTTP routes yet**. It is consumed by
`backend/features/background-analysis/analysis.service.js` during the
dual-write phase. PR 3 added the frontend low-confidence picker.

### PR 5 — captures_table is CANONICAL (current)

`captures_table` is now the single source of truth for:
- the public share token (`PublicShareToken`)
- the share expiry (`ShareExpiresAt`)
- the image-type discriminator (`ImageType`)

The legacy columns of the same name were **dropped** from
`food_nutrition_data_table` in
[`migrations/drop_legacy_share_columns_from_food.sql`](../../migrations/drop_legacy_share_columns_from_food.sql).
`food_nutrition_data_table` now carries only the food-specific nutrition payload
plus a nullable `CaptureID` FK back to its capture.

| Path | Behaviour |
|---|---|
| `createPendingCapture` (new row) | Inserts `captures_table` **first**, then the food row with `CaptureID` set. Failure aborts the whole request. |
| `updateCaptureType` (existing row) | Looks up `CaptureID` from the food row, then calls `captures.updateTypeById` — no more legacy column write, no more dual-write swallow. A food row with no `CaptureID` (pre-PR-2 historical) returns **404** (`CAPTURE_NOT_FOUND`). |
| Share-link resolve (`/share/:token`, `/api/captures/resolve/:token`) | Reads `captures_table` first for owner / expiry / type; then joins `food_nutrition_data_table` by `CaptureID` for nutrition. Pre-PR-2 historical rows **404** by design. |
| `listAnalyses` (food dashboard) | Filters on `AnalysisData IS NOT NULL` (the legacy `ImageType='food'` filter was removed with the column). Orphan re-tagged rows are excluded automatically. |
| `save()` else-branch (Android background-service direct insert) | **Out of scope for PR 5** — still writes legacy-only and bypasses captures_table. Tracked as a follow-up. |

**Historical breakage:** any food share link generated before PR 2
(create_captures_table.sql) now 404s. This was an explicit product decision —
no backfill migration was written.

### `captures.service.js`

| Function | Description |
|---|---|
| `recordPending(input)` | Insert a `pending` capture row keyed by the supplied token. Returns `{ id, publicShareToken }`. |
| `updateType({ publicShareToken, userId, toType })` | Promote `pending` to a terminal type by token, enforcing the state machine. |
| `updateTypeById({ captureId, userId, toType })` | PR 5 — same as `updateType` but keyed by `CaptureID`. Used by `background-analysis.updateCaptureType` after `findCaptureIdForOwner`. |

## Dependencies

- `backend/utils/supabaseClient.js` (DB)
- `backend/shared/lib/logger.js` (structured logs)

## Test matrix

See [`__tests__/MATRIX.md`](./__tests__/MATRIX.md).

## Threat model

- **Spoofed UserID on update:** mitigated by app-layer ownership filter in
  `updateImageTypeByToken` (`WHERE "UserID" = $userId`). No JWT/RLS in this
  release — matches the rest of the schema; covered by the cross-table RLS
  follow-up referenced in `migrations/create_captures_table.sql`.
- **Token enumeration:** UUID v4 generated via `crypto.randomUUID()` →
  122 bits of entropy. No enumeration risk.
- **Unbounded image storage:** captures (including `unknown`) are retained
  indefinitely. Retention/cleanup policy will be reviewed once real storage
  growth data is available; track via a follow-up ticket.
