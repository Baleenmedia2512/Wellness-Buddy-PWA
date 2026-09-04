const { defineConfig, devices } = require("@playwright/test");

module.exports = defineConfig({
  // ============================================================
  // TEST DIRECTORY
  // ============================================================

  testDir: "./tests",

  // ============================================================
  // GLOBAL TEST TIMEOUT
  // ============================================================

  timeout: 60 * 1000,

  // ============================================================
  // EXPECT ASSERTION TIMEOUT
  // ============================================================

  expect: {
    timeout: 10 * 1000,
  },

  // ============================================================
  // RUN TESTS IN PARALLEL
  // ============================================================

  fullyParallel: true,

  // Keep workers = 1 for deterministic debugging.
  workers: 1,

  // ============================================================
  // RETRIES
  // ============================================================

  retries: 0,

  // ============================================================
  // FAIL IF test.only IS USED IN CI
  // ============================================================

  forbidOnly: !!process.env.CI,

  // ============================================================
  // REPORTERS
  // ============================================================

  reporter: [
    ["list"],

    [
      "json",
      {
        outputFile: "test-results/results.json",
      },
    ],

    [
      "html",
      {
        outputFolder: "playwright-report",
        open: "never",
      },
    ],
  ],

  // ============================================================
  // GLOBAL USE SETTINGS
  // ============================================================

  use: {
    // Frontend URL
    baseURL: "http://127.0.0.1:3001",

    // Headless
    headless: true,

    // Screenshot
    screenshot: "only-on-failure",

    // Video
    video: "retain-on-failure",

    // Trace
    trace: "retain-on-failure",

    // Prevent individual actions from waiting indefinitely.
    actionTimeout: 15 * 1000,
  },

  // ============================================================
  // PROJECTS
  // ============================================================

  projects: [
    // ==========================================================
    // SETUP
    // ==========================================================

    {
      name: "setup",

      testMatch:
        /.*\.setup\.js/,

      use: {
        ...devices["Desktop Chrome"],
      },
    },

    // ==========================================================
    // FRONTEND
    // ==========================================================

    {
      name: "frontend",

      testMatch:
        /tests\/frontend\/.*\.spec\.js/,

      use: {
        ...devices["Desktop Chrome"],

        baseURL:
          "http://127.0.0.1:3001",
      },

      dependencies: [
        "setup",
      ],
    },
  ],
});