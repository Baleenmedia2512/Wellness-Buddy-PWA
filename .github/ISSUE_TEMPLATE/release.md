---
name: Release
about: Cut a new release of Wellness Valley PWA
title: "Release v"
labels: release
assignees: ''
---

# Release v<x.y.z>

**Release manager:** @
**Cut from:** `main` @ <sha>
**Target environments:** staging → pre-prod → production
**Mobile builds:** [ ] iOS  [ ] Android  [ ] None

## Scope
<!-- Bullet list of features/fixes in this release. Link PRs. -->

## Pre-Prod Gate (claude.md §10.1)
- [ ] Unit + integration suites green
- [ ] `@regression` E2E suite green
- [ ] `npm run smoke:prod` (staging URL) green
- [ ] Lighthouse Performance ≥ 85, TTI ≤ 3s
- [ ] Bundle size delta ≤ +5%
- [ ] Migration dry-run on prod clone — no errors
- [ ] Security scans (semgrep, osv) — no high severity
- [ ] QA Bot report attached: `reports/qa-bot-<sha>.json`

## Manual QA Checklist (claude.md §10.3)
- [ ] iOS device — login + 3 core flows
- [ ] Android device — login + 3 core flows
- [ ] PWA — installable + offline shell
- [ ] Push notifications received
- [ ] 1h error-sink soak < 5 errors
- [ ] Canary user DB rows match expected

## Rollback Plan (claude.md §11.6)
- Vercel rollback target deploy:
- Mobile previous build references:
- Compensating migrations (if any):

## Sign-off
- [ ] Principal Engineer
- [ ] Security
- [ ] Product
- [ ] Release manager (final cut)
