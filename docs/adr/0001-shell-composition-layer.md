# ADR-0001 — Introduce a `src/shell/` composition layer for cross-feature UI

- **Status:** Proposed
- **Date:** 2026-05-18
- **Authors:** @ai-assisted
- **Approvers:** @principal-eng

## Context

Several files currently live in `frontend/src/shared/` but must import from
`frontend/src/features/*`, which violates the `shared-cannot-import-features`
dependency rule (`claude.md §2.2`).

Affected files:
- `frontend/src/shared/components/Dashboard.js` → weight, team, nutrition, education features
- `frontend/src/shared/components/Header.js` → user feature
- `frontend/src/shared/services/geminiService.js` → nutrition feature
- `frontend/src/shared/services/imageTypeDetector.js` → weight, nutrition features

These are **composition roots** / **application-level orchestrators** — they
wire together multiple features. By VSA definition they do not belong in
`shared/` (which must have zero feature dependencies).

## Considered options

1. **Create `frontend/src/shell/`** — a new layer explicitly allowed to import from
   any feature. Move `Dashboard.js`, `Header.js` there. Decouple
   `geminiService` and `imageTypeDetector` via dependency injection so they can
   remain in `shared/` as pure services.

2. **Move everything to `pages/`** — simpler, but mixes routing and composition
   concerns.

3. **Allow exceptions in `.dependency-cruiser.cjs`** — quick fix, but encodes
   bad architecture into the ruleset.

4. **Do nothing** — dependency violations remain, blocking CI gate.

## Decision

**Option 1** is accepted in principle. Implementation split into two tracks:

**Track A** (lower risk):
- Introduce `frontend/src/shell/` with its own `README.md` and add it to
  `dependency-cruiser` as a layer allowed to import features.
- Move `Dashboard.js` and `Header.js` into `shell/`.
- Update all import sites.

**Track B** (requires careful DI refactor):
- Remove feature imports from `geminiService.js` and `imageTypeDetector.js`
  by injecting feature-specific callbacks at call sites (e.g. via
  `GeminiService.registerPostProcessor(fn)` called from the nutrition feature
  or App.js during startup).

## Consequences

- Positive: eliminates 8 `shared-cannot-import-features` errors; makes the
  dependency graph acyclic for those modules.
- Negative: requires moving files (import site updates across codebase);
  Track B requires careful wiring of injection points.
- Follow-ups:
  - File a ticket for Track A (move Dashboard + Header)
  - File a ticket for Track B (DI refactor of geminiService + imageTypeDetector)
  - Update `FOLDER-STRUCTURE.md` once shell/ exists

## References

- claude.md §2.1, §2.2, §2.3
- `.dependency-cruiser.cjs` rule `shared-cannot-import-features`
- Governance check output: 8 errors (as of 2026-05-18)
