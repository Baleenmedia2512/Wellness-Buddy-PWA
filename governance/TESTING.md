# Testing Strategy (operational)

Reference: [claude.md §9](../claude.md#9-testing-governance).

## 1. Tooling

| Layer | Tool | Location |
|---|---|---|
| Unit / integration | Jest | colocated `__tests__/` |
| Contract | Pact (consumer) + JSON-schema diff | `backend/features/*/__tests__/contract/` |
| E2E web | Playwright | `e2e/` |
| E2E mobile | Detox | `frontend/e2e-detox/` (post-week-6) |
| Smoke | Node script | `scripts/smoke-test.js` |
| Performance | k6 + Lighthouse CI | `perf/`, `.lighthouserc.json` |
| Visual | Playwright snapshots | `e2e/visual/` |
| Security | semgrep + osv | CI |
| Accessibility | @axe-core/playwright | `e2e/` tagged `@a11y` |

## 2. Coverage floors

Per-path Jest threshold (configure in each `jest.config.js`):

```js
module.exports = {
  coverageThreshold: {
    global:                                  { lines: 80, branches: 70 },
    'backend/features/*/domain/**/*.js':     { lines: 95, branches: 90 },
    'backend/features/*/validation/**/*.js': { lines: 95, branches: 90 },
    'backend/features/*/api/**/*.js':        { lines: 85, branches: 75 },
    'backend/features/*/data/**/*.js':       { lines: 70, branches: 60 },
    'frontend/src/features/*/hooks/**/*.js': { lines: 85, branches: 75 },
    'frontend/src/features/*/components/**/*.js': { lines: 70, branches: 60 },
    'shared/**/*.js':                        { lines: 90, branches: 80 }
  }
};
```

CI additionally runs `scripts/coverage-gate.js` for path-level enforcement.

## 3. Feature MATRIX template

Save as `backend/features/<x>/__tests__/MATRIX.md`:

```markdown
# <Feature> — Test Matrix
Owner: @
Last updated:

| Capability | Unit | Integration | E2E | Permissions | Edge cases (#) |
|------------|------|-------------|-----|-------------|----------------|
| <capability> | ✅ | ✅ | ✅ | ✅ | 5 |

## Journeys (E2E)
1. <happy path>
2. <permission denial>
3. <data edge>
4. <network edge>
5. <concurrency>

## Known gaps
- <list>
```

## 4. Test categories (do/don't)

| Category | Do | Don't |
|---|---|---|
| Unit (domain) | Pure I/O-free, fast, exhaustive | Mock anything; no I/O to mock |
| Integration (api) | Real handler + real DB + mocked external HTTP | Mock the handler under test |
| E2E | Real backend, seeded DB, real browser | Assert on data-testids only — also assert on visible text |
| Performance | Measure p50, p95, p99; budget per route | Run on dev laptop and call it a baseline |
| Visual | Snapshot only stable, intentional UI states | Snapshot dynamic timestamps / random IDs |

## 5. Impacted tests on PR

```
git diff --name-only origin/main...HEAD > /tmp/changed
node scripts/impacted-tests.js origin/main HEAD
# CI runs the union of impacted features' suites
```

## 6. Test data

- Test DB seeded via `e2e/fixtures/seed.sql`.
- Factories in `shared/test/factory/<entity>.js`.
- Faker seeded: `faker.seed(<file-hash>)`.

## 7. Bug → test discipline

Every bugfix PR MUST:
1. Add a failing test that reproduces the bug (commit it failing in a separate commit if helpful).
2. Then add the fix.
3. Confirm the test passes.

Reviewers reject bugfixes without reproduction tests.
