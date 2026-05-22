# Baselines

Machine-generated snapshots of the architecture, dependency, and
duplicate-logic state at the moment governance was introduced. CI compares
new PRs against these files and fails only on **new** violations.

Files (populated during Week 1 of [../ROLLOUT.md](../ROLLOUT.md)):

- `vsa.json` — output of `scripts/vsa-diagnostic.js`
- `dep-cruise.json` — output of `dependency-cruiser`
- `duplicates.txt` — output of `scripts/find-duplicates.js`

Do **not** edit by hand. Regenerate via the steps in
[../ARCH_BASELINE.md](../ARCH_BASELINE.md).
