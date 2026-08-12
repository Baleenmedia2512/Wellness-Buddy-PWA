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

  workers: process.env.CI ? 1 : undefined,

  reporter: [
    ['list'],
    [
      'html',
      {
        open: 'never',
      },
    ],
  ],

  use: {
    baseURL: 'http://127.0.0.1:3001',

    headless: true,

    screenshot: 'only-on-failure',

    video: 'retain-on-failure',

    trace: 'retain-on-failure',

    locale: 'en-US',
  },

  projects: [

    {
      name: 'frontend',

      testMatch: 'frontend/**/*.spec.js',

      use: {
        ...devices['Desktop Chrome'],

        baseURL: 'http://127.0.0.1:3001',
      },
    },

    {
      name: 'backend',

      testMatch: 'backend/**/*.spec.js',

      use: {
        ...devices['Desktop Chrome'],

        baseURL: 'http://127.0.0.1:3000',
      },
    },
  ],
});