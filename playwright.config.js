const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',

  timeout: 60 * 1000,

  expect: {
    timeout: 10 * 1000,
  },

  fullyParallel: true,

  forbidOnly: !!process.env.CI,

  retries: process.env.CI ? 2 : 0,

  workers: process.env.CI ? 2 : undefined,

  reporter: [
    ['list'],
    ['html'],
  ],

  use: {
    headless: true,

    screenshot: 'only-on-failure',

    video: 'retain-on-failure',

    trace: 'retain-on-failure',
  },

  projects: [

    // ==========================================
    // AUTHENTICATION SETUP
    // ==========================================
    {
      name: 'setup',

      testMatch: 'auth.setup.js',

      use: {
        baseURL: 'http://localhost:3001',
      },
    },


    // ==========================================
    // FRONTEND - GUEST USERS
    // Login / Signup / Public Pages
    // ==========================================
    {
      name: 'frontend-guest',

      testMatch: 'frontend/auth/**/*.spec.js',

      use: {
        ...devices['Desktop Chrome'],

        baseURL: 'http://localhost:3001',
      },
    },


    // ==========================================
    // FRONTEND - AUTHENTICATED USERS
    // Chat / Dashboard / Profile / Logout etc.
    // ==========================================
    {
      name: 'frontend-authenticated',

      testMatch: [
        'frontend/chat/**/*.spec.js',
        'frontend/dashboard/**/*.spec.js',
        'frontend/profile/**/*.spec.js',
        'frontend/logout/**/*.spec.js',
        'frontend/authenticated/**/*.spec.js',
      ],

      use: {
        ...devices['Desktop Chrome'],

        baseURL: 'http://localhost:3001',

        storageState: 'playwright/.auth/user.json',
      },

      dependencies: ['setup'],
    },


    // ==========================================
    // BACKEND
    // Next.js API Tests
    // ==========================================
    {
      name: 'backend',

      testMatch: 'backend/**/*.spec.js',

      use: {
        baseURL: 'http://localhost:3000',
      },
    },
  ],


  // ==========================================
  // FRONTEND WEBSERVER
  // ==========================================
  webServer: [
    {
      command: 'npm start -- --port 3001',

      cwd: './frontend',

      url: 'http://localhost:3001',

      reuseExistingServer: true,

      timeout: 120 * 1000,

      env: {
        PORT: '3001',
      },
    },
  ],
});