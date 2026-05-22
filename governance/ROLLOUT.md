# Rollout Plan — Engineering Governance

Owner: Principal Engineer. Review weekly in the Eng standup.

## Guiding principles
- Ship governance like a feature: increments, measure, iterate.
- Never block product delivery for > 1 day during rollout.
- Every gate added has an off-switch (env-var or label) for the first 2 weeks.

---

## Week 1 — Quick wins (visibility, no enforcement)

| Day | Task | Owner | Acceptance |
|---|---|---|---|
| Mon | Merge `claude.md` + `/governance/` + PR template | Principal Eng | Renders on GitHub |
| Mon | Add CODEOWNERS (placeholder handles) | Principal Eng | GitHub recognises ownership |
| Tue | Add `.github/workflows/ci.yml` in **report-only** mode (warnings, no blocking) | DevOps | Pipeline green on a sample PR |
| Tue | Add `.github/workflows/pr-validator.yml` in advisory mode | DevOps | PR comments visible |
| Wed | Add `.dependency-cruiser.cjs`, run on existing code, file `governance/ARCH_BASELINE.md` | Principal Eng | Baseline tracked |
| Wed | Add `.gitleaks.toml`, `.semgrep/`, run nightly | Security | First findings triaged |
| Thu | Train team on PR template + 3 AI prompts (1h session) | Principal Eng | Recording posted |
| Fri | Tag week-1 readout in `#eng` | Principal Eng | Notes posted |

Exit criteria: every developer has opened ≥ 1 PR using the new template.

---

## Week 2 — Enforcement: lint, types, secrets, PR template

- Flip `lint`, `typecheck`, `secrets`, `pr-validator` to **required** on `staging`.
- Add `forbidden-patterns.js` blocking on `console.log`, empty catch, TODO-without-id (existing offences allow-listed in a baseline file).
- Add `find-duplicates.js` in advisory mode; produce baseline.
- Configure branch protection on `staging` via `scripts/setup-branch-protection.js`.

Exit criteria: 0 PRs merged to `staging` without lint+template green.

---

## Week 3 — Architecture + business-logic gates

- Flip `architecture` workflow (dep-cruiser, VSA, file-size) to required on `staging`.
- Enforce `business-logic-block-check.js` for `domain/` PRs.
- Add `ADR` requirement for new feature folders.
- Add CODEOWNERS reviewer requirement (1 approval).
- Migrate top-3 existing features into strict VSA shape: `auth`, `water`, `weight`.

Exit criteria: dep-cruiser passes on `staging`. ADR template used at least once.

---

## Week 4 — Testing rollout

- Set Jest `--coverageThreshold` per-path (warn-only for first 3 days, then enforce).
- Add `coverage-gate.js` to CI.
- Add `e2e/` Playwright project, port at least 5 `@journey` tests covering: login, log water, log weight, view dashboard, coach views team.
- Run E2E nightly + on PRs to `staging`.
- Adopt `__tests__/MATRIX.md` per feature folder.

Exit criteria: overall coverage ≥ 80%, top-5 journeys green in nightly.

---

## Week 5 — Security + pre-prod automation

- Make `security.yml` blocking on high-severity OSV / semgrep.
- Stand up `release/*` workflow: cut a candidate, run `preprod-gate.yml`.
- Run `qa-bot.js` as part of pre-prod gate.
- Connect Slack webhook for deploy/rollback notifications.
- Drill: perform a fake rollback to validate `rollback.yml`.

Exit criteria: at least one release goes through the full pre-prod gate and reaches production via `deploy-prod.yml`.

---

## Week 6 — AI governance + audit hardening

- Enforce `ai-disclosure-check.js` (block if missing).
- Require GPG-signed commits on `main`.
- Add `commit-msg` hook that auto-tags `[ai-assisted]` if the diff contains a known AI signature comment.
- Quarterly architecture review scheduled; run `vsa-diagnostic.js` and file `governance/ARCH_REPORT_<date>.md`.
- Make `claude.md` change protected by `cto-approved` label (see `claude-md-guard.js`).

Exit criteria: every PR for the week has AI disclosure populated; main is fully protected.

---

## Post-rollout (continuous)
- Monthly: review `find-duplicates.js` baseline; eliminate any new clusters.
- Monthly: feature-owner attestation that their `__tests__/MATRIX.md` is current.
- Quarterly: refresh `claude.md` version, run blameless retro on any incident, update prompts based on AI behaviour observed.
- Annually: external security review.
