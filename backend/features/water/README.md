# Feature: water (backend)

> **Reference implementation** for Vertical Slice Architecture. Other
> features should mirror this folder layout when migrated.
> Reference: [claude.md §2](../../../claude.md#2-architecture-governance).

## Purpose
Reports a user's daily water intake (in millilitres) against a personalised
target derived from their latest recorded body weight. Water is detected
indirectly: rows in `food_nutrition_data_table` whose `AnalysisData` contains
only exempted beverages (water, tea, coffee, etc.) are summed.

UI: Screen 13 (Main Dashboard – Water Tab) and Screen 33 (Water Tracker).

## Owners
- CODEOWNER: see [`.github/CODEOWNERS`](../../../.github/CODEOWNERS)
- Domain expert: TODO
- On-call: TODO

## Public API
| Method | Route                  | Handler                             |
|--------|------------------------|-------------------------------------|
| GET    | `/api/water/intake`    | `api/intake.handler.js → getIntake` |

Query params: `userId` (required, integer), `date` (optional, `YYYY-MM-DD`,
defaults to today in IST).

Response envelope: `{ httpStatus, body }` shaped by `shared/lib/handler.runService`.
Body shape is documented in the JSDoc on `domain/intake.rules.js → computeDailyIntake`.

## Internal layout (strict VSA)
```
api/intake.handler.js         orchestration only
domain/intake.rules.js        pure calc — NO I/O, NO Date.now in business path
validation/intake.schema.js   ValidationError on bad input
data/water.repo.js            ONLY file that talks to Supabase
__tests__/intake.rules.test.js
```

## Dependencies
- Internal pure helpers: `backend/utils/foodTypeDetection.js` (used by domain).
- Data sources: Supabase tables `weight_records_table`, `food_nutrition_data_table`.
- Shared: `shared/lib/logger.js`, `shared/lib/ValidationError.js`, `shared/lib/handler.js`.
- Env vars: whatever `supabaseClient.js` consumes (no new vars in this feature).

## Threat model (claude.md §8.5)
- **Auth:** TODO — currently the handler trusts the `userId` query param. This
  is a known gap; tracked for migration to session-derived user id.
- **Authorization:** none — anyone with a valid `userId` can read that user's
  daily intake. To be replaced with a policy module in `domain/permissions/`.
- **PII handled:** weight (kg), per-day water intake totals. Logged via the
  redacting logger.
- **Rate limits:** TODO — add `shared/lib/rate-limit.js` decorator (60/min/user).

## Feature flags
- None today. Future: `ff.water.streak-bonus`.

## Related ADRs
- ADR-0001 (planned) — VSA reference layout, using `water` as the exemplar.

## Tests
See [`__tests__/MATRIX.md`](./__tests__/MATRIX.md). Domain unit tests live in
`__tests__/intake.rules.test.js` and require no I/O mocks.
