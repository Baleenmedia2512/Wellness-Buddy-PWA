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
| `createPendingCapture` (new row) | **PR 6** — Inserts `captures_table` ONLY. No speculative food-row pre-insert. Returns `{ id, token }` where `id` IS the `CaptureID`. Failure throws. |
| `updateCaptureType` (existing row) | **PR 6** — `id` is the `CaptureID` (round-tripped from `createPendingCapture`). Delegates directly to `captures.updateTypeById`. Returns **404** (`CAPTURE_NOT_FOUND`) when the captures slice reports `NOT_FOUND_OR_NOT_OWNER`. |
| `analysis.service.save()` | **PR 6** — When called with a `captureId`, upserts the food row keyed by `CaptureID` (find-then-update-or-insert via `findFoodByCaptureId`) and promotes the capture `pending → food` best-effort. Without `captureId`, falls back to plain insert (Android background-service path). |
| Share-link resolve (`/share/:token`, `/api/captures/resolve/:token`) | Reads `captures_table` first for owner / expiry / type; then joins `food_nutrition_data_table` by `CaptureID` for nutrition. Pre-PR-2 historical rows **404** by design. **TODO(share-viewer-polling):** in-app viewers must now poll until `AnalysisData` lands, because the food row no longer exists at capture time. |
| `listAnalyses` (food dashboard) | Filters on `AnalysisData IS NOT NULL`. `fetchMealsForDate` (food-corrections) added the same defensive filter in PR 6. |

**Historical breakage:** any food share link generated before PR 2 still 404s.
Existing orphan `Unknown Food / 0 kcal` rows from before PR 6 are left in
place by design — the user accepted them as historical noise. PR 6 only
prevents *new* orphans from being created.

### `captures.service.js`

| Function | Description |
|---|---|
| `recordPending(input)` | Insert a `pending` capture row keyed by the supplied token. Returns `{ id, publicShareToken }`. |
| `updateType({ publicShareToken, userId, toType })` | Promote `pending` to a terminal type by token, enforcing the state machine. |
| `updateTypeById({ captureId, userId, toType })` | Same as `updateType` but keyed by `CaptureID`. Primary path post-PR-6: called by `background-analysis.updateCaptureType` AND by every vertical save (`food`, `weight`, `education`) when a `captureId` is supplied. |

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
