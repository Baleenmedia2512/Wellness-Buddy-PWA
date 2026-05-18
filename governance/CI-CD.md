# CI/CD Runbook

Reference: [claude.md §11](../claude.md#11-cicd-governance).

## 1. Workflow inventory

| File | Trigger | Purpose |
|---|---|---|
| `.github/workflows/ci.yml` | PR + push | Lint, types, arch, unit, integration, build, coverage |
| `.github/workflows/pr-validator.yml` | PR events | Title + template + AI disclosure + commitlint |
| `.github/workflows/security.yml` | PR + nightly | semgrep, osv, npm audit, gitleaks |
| `.github/workflows/architecture.yml` | PR + push | VSA + dep-cruiser + duplicates + ADR |
| `.github/workflows/e2e.yml` | PR to staging/release | Playwright matrix + a11y |
| `.github/workflows/preprod-gate.yml` | push to `release/**` | Full pre-prod gate |
| `.github/workflows/deploy-prod.yml` | push to `main`, tags | Vercel deploy + smoke + Slack |
| `.github/workflows/rollback.yml` | manual | Promote previous deployment |

## 2. Required status checks on `main`

(applied by `scripts/setup-branch-protection.js`)

- Lint
- Typecheck (jsconfig)
- Architecture (VSA + dep-cruiser)
- Secrets scan
- Unit tests (all matrix entries)
- Integration tests
- Coverage gate
- Build backend
- Build frontend
- PR title, template, AI tag
- Semgrep (OWASP)
- OSV scanner

Plus: ≥ 2 approving reviews, ≥ 1 CODEOWNER, linear history, signed commits.

## 3. Required status checks on `staging`

Same as `main` minus mobile/perf gates; 1 CODEOWNER review.

## 4. Required status checks on `release/*`

All of `main` PLUS `Playwright (chromium)`, `Playwright (webkit)`, `Pre-Prod Readiness Gate`.

## 5. Secrets required in GitHub

| Secret | Used by |
|---|---|
| `VERCEL_TOKEN`, `VERCEL_ORG` | deploy-prod, rollback |
| `SLACK_RELEASES_WEBHOOK` | deploy-prod |
| `PROD_CLONE_DATABASE_URL` | preprod-gate (migration dry-run) |
| `STAGING_BASE_URL` | preprod-gate |
| `QA_BOT_USER`, `QA_BOT_PASS` | preprod-gate |

## 6. Cache strategy

- `node_modules` keyed on `package-lock.json` per directory.
- `.next/cache` keyed on lockfile + js hash.
- Playwright browsers keyed on lockfile.
- Test sharding: 4× unit, 4× E2E per browser.

Target wall-clock: PR feedback < 8 min (unit), full pre-prod gate < 35 min.

## 7. Deployments

- **Web/backend (Vercel):** every PR gets a preview URL; only `main` deploys to prod. Promotion is gated by `deploy-prod.yml`.
- **Mobile:** tag `v*.*.*` triggers a separate workflow (not included here — Apple/Play credentials live in OS keychain on a dedicated runner).

## 8. Rollback drill (perform monthly)

1. From GitHub UI → Actions → "Rollback Production" → Run workflow.
2. Provide `target_deployment` (a known-good Vercel deployment ID) and `reason: "drill"`.
3. Confirm smoke passes and Slack received the notice.
4. Promote forward again afterwards.
