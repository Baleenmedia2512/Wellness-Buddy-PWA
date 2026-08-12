const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  // ============================================================
  // Test directory
  // ============================================================

  testDir: './tests',

  // ============================================================
  // Global timeout
  // ============================================================

  timeout: 60 * 1000,

  // ============================================================
  // Assertion timeout
  // ============================================================

  expect: {
    timeout: 10 * 1000,
  },

  // ============================================================
  // Run tests sequentially
  // ============================================================

  // Authentication tests depend on OTP/login state and
  // external services, so keep CI execution stable.
  fullyParallel: false,

  // ============================================================
  // Prevent test.only from accidentally being committed
  // ============================================================

  forbidOnly: !!process.env.CI,

  // ============================================================
  // Retry failed tests in CI
  // ============================================================

  retries: process.env.CI ? 2 : 0,

  // ============================================================
  // Workers
  // ============================================================

  workers: process.env.CI ? 1 : undefined,

  // ============================================================
  // Reporters
  // ============================================================

  reporter: [
    ['list'],
    ['html', {
      open: 'never',
    }],
  ],

  // ============================================================
  // Common settings
  // ============================================================

  use: {
    // Frontend runs on port 3001
    baseURL: 'http://127.0.0.1:3001',

    // CI runs headless
    headless: true,

    // Capture screenshot only when test fails
    screenshot: 'only-on-failure',

    // Keep video when test fails
    video: 'retain-on-failure',

    // Keep trace when test fails
    trace: 'retain-on-failure',

    // Browser language
    locale: 'en-US',
  },

  // ============================================================
  // Projects
  // ============================================================

  projects: [

    // ------------------------------------------------------------
    // Frontend tests
    // ------------------------------------------------------------

    {
      name: 'frontend',

      testMatch: 'frontend/**/*.spec.js',

      use: {
        ...devices['Desktop Chrome'],

        baseURL: 'http://127.0.0.1:3001',
      },
    },

    // ------------------------------------------------------------
    // Backend tests
    // ------------------------------------------------------------

    {
      name: 'backend',

      testMatch: 'backend/**/*.spec.js',

      use: {
        ...devices['Desktop Chrome'],

        baseURL: 'http://127.0.0.1:3000',
      },
    },
  ],

  // ============================================================
  // IMPORTANT:
  //
  // Do NOT put webServer here.
  //
  // GitHub Actions starts the backend and frontend itself.
  // ============================================================
});