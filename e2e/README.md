# E2E Test Suite

Playwright-driven journey tests for the Wellness Valley PWA. Owned per
[claude.md §9.2 / §9.4](../claude.md) and [governance/TESTING.md](../governance/TESTING.md).

## Quick start

```bash
# from repo root
npm run e2e              # all tests, headless, against PLAYWRIGHT_BASE_URL || http://localhost:3000
npm run e2e:headed       # same, with visible browser
npm run e2e:smoke        # only @smoke tagged tests (unauthenticated, safe vs prod)
npm run e2e:journey      # only @journey tagged tests (require credentials)
npm run e2e:ui           # interactive Playwright UI
```

Default base URL is `http://localhost:3000`. To target a deployed env:

```bash
PLAYWRIGHT_BASE_URL=https://wellness-buddy-pwa.vercel.app npm run e2e:smoke
```

> **Never run the `@journey` suite against prod.** Those tests mutate data
> (log water, log weight). They are for staging or local only.

## Credentials

Create `e2e/.env.local` (gitignored). Two roles are required:

```
E2E_USER_EMAIL=qa.user@example.com
E2E_USER_PASSWORD=<set me>
E2E_COACH_EMAIL=qa.coach@example.com
E2E_COACH_PASSWORD=<set me>
```

Load it before running:

```bash
# PowerShell
$env:E2E_USER_EMAIL="..."; $env:E2E_USER_PASSWORD="..."; npm run e2e
```

Or use a `.env` loader of your choice. Do not commit the file.

## Tags

- `@smoke` — read-only, safe against any environment.
- `@journey` — full user journey, may mutate data. Staging/local only.
- `@regression` — must run on every release per claude.md §9.4.

## Layout

```
e2e/
  helpers/
    auth.js               # login helpers, env-var guard
  journeys/
    app-loads.spec.js     # @smoke @regression
    log-water.spec.js     # @journey @regression  (skipped until creds)
    log-weight.spec.js    # @journey @regression  (skipped until creds)
    view-dashboard.spec.js# @journey @regression  (skipped until creds)
    coach-views-team.spec.js # @journey @regression (skipped until creds)
```

## Adding a new journey

1. Pick the right tag(s).
2. Use `getByRole`/`getByLabel`/`getByText` — avoid CSS selectors.
3. Assert backend state via the API after every mutation (see claude.md §9.4).
4. Add an entry to your feature's `__tests__/MATRIX.md`.
