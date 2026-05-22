# Architecture Deep-Dive

Authoritative reference for [claude.md §2](../claude.md#2-architecture-governance).

## 1. Vertical Slice Architecture (VSA)

```
backend/features/<domain>/
├── api/             # Next.js handler entrypoints (orchestration only)
│   └── *.handler.js
├── domain/          # Pure business rules. No I/O. Fully unit-tested.
│   ├── *.rules.js
│   └── permissions/*.policy.js
├── validation/      # zod / joi schemas. Pure.
│   └── *.schema.js
├── data/            # Repository pattern over Supabase / Postgres.
│   └── *.repo.js
├── __tests__/
│   ├── MATRIX.md
│   ├── unit/*.test.js
│   └── integration/*.test.js
└── README.md        # Purpose · Public API · Owners · Dependencies
```

Frontend mirror:
```
frontend/src/features/<domain>/
├── components/      # Presentational only. Props in, JSX out.
├── hooks/           # Data + side-effects. Owns API calls.
├── api/             # Axios clients (thin).
├── domain/          # Client-side rules (mirror server when needed).
├── __tests__/
└── README.md
```

## 2. Dependency rules (enforced by `dependency-cruiser`)

| From | OK | NOT OK |
|---|---|---|
| `features/A/*` | `features/A/*`, `shared/*` | `features/B/*` |
| `features/*/api/*` | own domain/validation/data | DB clients directly |
| `features/*/domain/*` | pure deps | axios, pg, supabase, react, next, firebase |
| `shared/*` | other shared | any feature |
| `backend/pages/api/*` | one feature `api/` entrypoint | DB or domain directly |

Run locally: `npx dependency-cruiser --config .dependency-cruiser.cjs backend frontend/src`

## 3. Cross-cutting concerns

- **Logging:** `backend/shared/lib/logger.js` (redacts PII). Frontend uses `frontend/src/shared/lib/logger.js` which batches to backend.
- **Time:** Server time only via `backend/utils/timezoneConverter.js`. Frontend uses `date-fns` + a clock injected in tests.
- **Storage:** Frontend never calls `localStorage` directly. Use `shared/lib/storage` (Capacitor `Preferences` + localStorage fallback).
- **HTTP:** All outbound from the frontend goes through `shared/lib/http` (axios instance with auth interceptor + retry).
- **Feature flags:** `backend/shared/lib/feature-flags.js`, registered with owner + sunset date.

## 4. ADR process

When you propose any of the following, write an ADR (`docs/adr/NNNN-title.md`):
- New top-level folder
- New runtime dependency
- New external integration
- Change to authentication / authorization model
- Change to data model that breaks a v1 contract
- New cross-feature module in `shared/`

Use [docs/adr/0000-template.md](../docs/adr/0000-template.md).
