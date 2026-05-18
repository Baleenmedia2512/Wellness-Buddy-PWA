# Release Manager Runbook

Reference: [claude.md §12](../claude.md#12-release--rollback-governance).

## Pre-release (Tuesday EOD)

1. Cut `release/x.y.z` from `main`.
2. Open release issue from `.github/ISSUE_TEMPLATE/release.md`.
3. Trigger `preprod-gate.yml` against the new branch.
4. Triage any failures; cherry-pick fixes from `main`.

## QA (Wednesday)

1. Coordinate manual QA — checklist in the release issue.
2. Capture iOS + Android device test evidence.
3. Confirm Slack `#releases` thread.

## Release (Thursday)

1. Sign tag `vX.Y.Z` on `main`.
2. `deploy-prod.yml` fires automatically.
3. Watch dashboards for 2 h post-deploy.
4. Post release notes in `#releases` and to `CHANGELOG.md`.

## Hotfix

1. Branch `hotfix/<ticket>` from `main`.
2. Minimal change + reproduction test.
3. PR into `main` + active `release/*`.
4. Fast-track approval; tag patch version; deploy; smoke.

## Rollback

1. From GitHub Actions: run `rollback.yml`.
2. Provide previous deployment ID and reason.
3. Smoke runs automatically.
4. Open incident issue; post-mortem within 48 h.
