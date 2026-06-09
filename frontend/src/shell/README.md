# `frontend/src/shell/` — composition layer

> **Status:** Introduced 2026-06-05 in F1 of ADR-0003, executing
> [ADR-0001](../../../docs/adr/0001-shell-composition-layer.md).
> **Owner:** `@principal-eng` (per `.github/CODEOWNERS`).

## Purpose

`shell/` is the in-app **composition root** — the layer that legitimately
wires multiple feature slices into a single user-facing surface. It exists
because three files (Dashboard, Header, and future routers) genuinely need
to import from `features/*` to do their job, which the `shared/` layer is
forbidden from doing (claude.md §2.2 `shared-cannot-import-features`).

Before this folder existed, those files lived in `shared/components/` and
were producing dependency-cruiser errors. ADR-0001 accepted Option 1 —
create a real composition layer rather than annotating exceptions.

## Charter

| `shell/` MAY import from … | `shell/` MUST NOT import from … |
|---|---|
| any `features/*` slice (this is its whole reason for existing) | another `shell/` file that creates a circular tab dependency |
| `shared/*` (always allowed) | any DB client (use a feature's `api/` entrypoint) |
| `config/*`                                                    | route handlers under `pages/api/*` |

## Current residents

| File | Role | Imports features |
|---|---|---|
| `components/Dashboard.js` | The unified tab shell that mounts NutritionDashboard / WeightDashboard / EducationDashboard (and, after PR-C, DiaryFeed). Owns the in-shell date state and the `TeamMemberSearch` header. | `team`, `nutrition`, `weight`, `education`, `diary` (post-PR-C) |

## Planned residents

| File | When |
|---|---|
| `components/Header.js` | When `shared/components/Header.js`'s feature dependencies are audited (ADR-0001 Track A finalisation). |
| `components/AppRouter.jsx` | If/when the homemade `show*` router in `App.js` is replaced by a real router (deferred per `App.js` policy banner). |

## What NOT to put here

- Generic UI primitives (`Button`, `Modal`, `Spinner`) — those belong in `shared/components/`.
- Anything that does NOT span ≥ 2 features — that lives inside the owning feature.
- DI helpers for service injection — those land in `shared/lib/` or the feature itself.

## Test policy

A file moved to `shell/` retains its existing test location. New shell-level
tests live in `shell/__tests__/`. Coverage target inherits the `shared/`
floor (§9.1: 90% lines / 80% branches) because shell is composition logic
with the same risk profile.
