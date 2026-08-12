const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({

  // ============================================================
  // TEST DIRECTORY
  // ============================================================

  testDir: './tests',


  // ============================================================
  // GLOBAL TEST TIMEOUT
  // ============================================================

  timeout: 60 * 1000,


  // ============================================================
  // EXPECT / ASSERTION TIMEOUT
  // ============================================================

  expect: {
    timeout: 10 * 1000,
  },


  // ============================================================
  // PARALLEL EXECUTION
  //
  // Authentication tests use OTP/API/database state.
  // Therefore keep them sequential for stability.
  // ============================================================

  fullyParallel: false,


  // ============================================================
  // PREVENT test.only IN CI
  // ============================================================

  forbidOnly: !!process.env.CI,


  // ============================================================
  // RETRIES
  //
  // Local:
  //   0 retries
  //
  // GitHub Actions:
  //   2 retries
  // ============================================================

  retries: process.env.CI ? 2 : 0,


  // ============================================================
  // WORKERS
  //
  // CI:
  //   1 worker
  //
  // Local:
  //   Playwright default
  // ============================================================

  workers: process.env.CI ? 1 : undefined,


  // ============================================================
  // REPORTERS
  // ============================================================

  reporter: [
    ['list'],

    [
      'html',
      {
        open: 'never',
      },
    ],
  ],


  // ============================================================
  // COMMON PLAYWRIGHT SETTINGS
  // ============================================================

  use: {

    // Frontend application
    baseURL: 'http://127.0.0.1:3001',

    // GitHub Actions runs headless
    headless: true,

    // Take screenshot only when test fails
    screenshot: 'only-on-failure',

    // Keep video when test fails
    video: 'retain-on-failure',

    // Keep trace when test fails
    trace: 'retain-on-failure',

    // Browser language
    locale: 'en-US',
  },


  // ============================================================
  // PROJECTS
  // ============================================================

  projects: [

    // ==========================================================
    // FRONTEND PROJECT
    // ==========================================================

    {
      name: 'frontend',

      testMatch: 'frontend/**/*.spec.js',

      use: {
        ...devices['Desktop Chrome'],

        baseURL: 'http://127.0.0.1:3001',
      },
    },


    // ==========================================================
    // BACKEND PROJECT
    // ==========================================================

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
  // IMPORTANT
  //
  // There is intentionally NO webServer section here.
  //
  // GitHub Actions starts:
  //
  // Backend  -> port 3000
  // Frontend -> port 3001
  //
  // before Playwright starts.
  // ============================================================
});