# ADR-0002 — Create VSA feature layers for orphaned backend API routes

- **Status:** Proposed
- **Date:** 2026-05-18
- **Authors:** @ai-assisted
- **Approvers:** @principal-eng

## Context

24 backend API route handlers under `backend/pages/api/` directly import
`backend/utils/supabaseClient.js`, bypassing the VSA feature layer (`api/` →
`domain/` → `data/`). This violates the `no-pages-api-bypass-feature-layer`
rule (`claude.md §2.2`, §3.1).

Affected route groups (each requires its own feature layer):

| Route prefix | Missing feature folder |
|---|---|
| `/api/wellness-university/*` (3 files) | `backend/features/wellness-university/` |
| `/api/upline/*` (3 files) | `backend/features/upline/` |
| `/api/counselling/*` (3 files) | `backend/features/counselling/` |
| `/api/leaderboard/*` (2 files) | `backend/features/leaderboard/` |
| `/api/coach/*` (8 files) | `backend/features/coach/` (or extend existing) |
| `/api/team/*` (2 files) | `backend/features/team/` |
| `/api/users/search.js` (1 file) | extend `backend/features/user/` |
| `/api/admin/*` (2 files) | `backend/features/admin/` |

## Considered options

1. **Create proper VSA feature layers** — for each domain above, create
   `backend/features/<domain>/{api,domain,data,validation}/` and move the DB
   logic into `data/*.repo.js`, business rules into `domain/*.rules.js`, and
   thin the handler to orchestration only.

2. **Allow direct supabaseClient usage in pages/api** — violates §3.1 and
   makes testing and policy enforcement impossible.

3. **Consolidate into existing features** — some routes (`/api/coach/*`,
   `/api/admin/*`) may belong to existing feature folders; move there.

## Decision

**Option 1** is accepted. Implementation is split by priority:

**Phase 1** (unblocking CI, lower risk — domains with ≤ 3 files):
- `wellness-university`, `upline`, `counselling`, `leaderboard`
- Create the VSA skeleton, move DB queries to `data/` repos, extract any rules
  to `domain/`, thin the handler.

**Phase 2** (larger domains):
- `coach` (8 files), `admin` (2 files), `team` (2 files), `user/search`

## Consequences

- Positive: removes 24 architecture errors; enables proper unit-testing of
  domain logic; enables RLS policy enforcement at the data layer.
- Negative: significant implementation effort (~40–60 files to create/modify).
- Follow-ups:
  - File one ticket per phase.
  - Each feature folder needs `README.md` and `__tests__/MATRIX.md`.
  - Migrations for any schema changes go through `backend/migrations/`.

## References

- claude.md §2.1, §2.2, §3.1, §3.2
- `.dependency-cruiser.cjs` rule `no-pages-api-bypass-feature-layer`
- Governance check output: 24 errors (as of 2026-05-18)
