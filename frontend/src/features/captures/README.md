# Captures (frontend slice)

**Owner:** @principal-eng
**Status:** Active — introduced in the "Unknown image type" bugfix series (PR 3).

## Purpose

The frontend captures slice owns UI for handling the **unknown** image-type
case: when the Gemini detector cannot confidently classify a user-uploaded
photo as food / weight / education / smartwatch.

Before PR 3, such images silently saved into `food_nutrition_data_table` as
"Unknown Food / 0 kcal" rows, polluting the nutrition feed and producing
broken share links. PR 3 introduces a disambiguation modal so the user picks
the correct type, and the pending capture row is re-tagged accordingly.

## Public API

| Export                  | Kind      | Purpose                                                                |
| ----------------------- | --------- | ---------------------------------------------------------------------- |
| `UnknownCaptureModal`   | Component | Modal asking the user "What's in this photo?" with three picker rows.  |

Imported via:

```js
import { UnknownCaptureModal } from './features/captures';
```

## Dependencies

- `shared/constants/imageTypes` — single source of truth for the image-type enum.
- `shared/lib/is-low-confidence-food` — gating predicate that decides when to open this modal.
- `shared/lib/tab-by-image-type`     — used by the App.js share-link router to resolve a tab once the user has picked a type.

No direct backend coupling. The modal calls back into the parent (App.js)
which owns the `updatePendingCaptureType` helper and the existing manual-entry
modal state (food / weight / education).

## Threat model

- **Spoofed capture ID:** the PATCH that re-tags a capture is gated by the
  capture's own `RecordID` plus the authenticated session — same auth posture
  as PR 2's backend route.
- **Unbounded storage:** captures (including `unknown`) are retained
  indefinitely. Retention will be revisited once production storage growth
  data is available (see backend captures README).
- **UI denial-of-action:** the modal is dismissible; dismissing leaves the
  capture row tagged `unknown` and does NOT write to any vertical's table.

## Tests

See [`__tests__/MATRIX.md`](./__tests__/MATRIX.md).
