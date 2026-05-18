/**
 * Playwright configuration — Wellness Valley PWA
 *
 * Per claude.md §9.2 (E2E web → Playwright) and governance/ROLLOUT.md Week 4
 * (≥ 5 @journey tests for: login, log water, log weight, view dashboard,
 * coach views team).
 *
 * Target environments:
 *   - default:   http://localhost:3000           (CRA dev server)
 *   - staging:   PLAYWRIGHT_BASE_URL=https://... npx playwright test
 *   - prod:      reserve for the @smoke tag only (read-only journeys)
 *
 * Credentials are read from env at run time. NEVER commit creds:
 *   - E2E_USER_EMAIL
 *   - E2E_USER_PASSWORD
 *   - E2E_COACH_EMAIL
 *   - E2E_COACH_PASSWORD
 * See `e2e/README.md` for the env-file template (gitignored).
 */
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
