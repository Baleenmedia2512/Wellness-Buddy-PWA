# Architecture Baseline

Reference: [claude.md §2](../claude.md#2-architecture-governance).

This file records pre-existing architecture violations that exist in `main` at
the moment governance was introduced. They are explicitly allow-listed so the
team can ship while paying down debt — but no **new** violation may be added.

CI compares current `dependency-cruiser` + `vsa-diagnostic` output against this
baseline and only fails on **new** violations.

## How to (re)generate

```bash
# 1. Architecture diagnostic
node scripts/vsa-diagnostic.js > reports/vsa-diagnostic.json

# 2. Dependency rules
npx dependency-cruiser --config .dependency-cruiser.cjs \
  --output-type json backend frontend/src > reports/dep-cruise.json

# 3. Duplicate-logic clusters
node scripts/find-duplicates.js > reports/duplicates.txt

# 4. Promote the current state to baseline (commit the resulting files)
cp reports/vsa-diagnostic.json   governance/baselines/vsa.json
cp reports/dep-cruise.json       governance/baselines/dep-cruise.json
cp reports/duplicates.txt        governance/baselines/duplicates.txt
```

## Current allow-listed violations

> Populate during Week 1 of [ROLLOUT.md](./ROLLOUT.md). Until then CI runs
> these checks in advisory mode (warnings only).

| # | Rule | File / Cluster | Owner | Target removal |
|---|------|----------------|-------|----------------|
| _example_ | `no-cross-feature-imports-backend` | `backend/features/water → backend/features/discipline` | @owner | 2026-Q3 |

## Debt paydown policy

- Every sprint, at least **one** baseline entry must be removed.
- A removed entry's line in CI flips from "advisory" to "blocking".
- A reintroduced violation is treated as a major architecture violation
  (claude.md §13.3) → revert + post-mortem.
