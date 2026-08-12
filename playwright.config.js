const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',

  timeout: 60 * 1000,

  expect: {
    timeout: 10 * 1000,
  },

  fullyParallel: false,

  forbidOnly: !!process.env.CI,

  retries: process.env.CI ? 2 : 0,

  workers: 1,

  reporter: [
    ['list'],
    ['html'],
  ],

  use: {
    baseURL: 'http://localhost:3001',

    headless: true,

    screenshot: 'only-on-failure',

    video: 'retain-on-failure',

    trace: 'retain-on-failure',
  },

  projects: [
    {
      name: 'frontend',

      testMatch: 'frontend/**/*.spec.js',

      use: {
        ...devices['Desktop Chrome'],
      },
    },

    {
      name: 'backend',

      testMatch: 'backend/**/*.spec.js',

      use: {
        baseURL: 'http://localhost:3000',
      },
    },
  ],

  webServer: [
    {
      command: 'npm run dev:local',

      cwd: './backend',

      url: 'http://127.0.0.1:3000',

      reuseExistingServer: true,

      timeout: 120 * 1000,
    },

    {
      command: 'npm start -- --port 3001',

      cwd: './frontend',

      url: 'http://127.0.0.1:3001',

      reuseExistingServer: true,

      timeout: 120 * 1000,

      env: {
        PORT: '3001',
      },
    },
  ],
});