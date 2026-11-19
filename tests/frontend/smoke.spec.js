/**
 * tests/frontend/smoke.spec.js
 * E2E test suite for Smoke Module.
 * 
 *
 * Requirements Covered:
 * - application loads successfully
 */

const { test, expect } = require('@playwright/test');

test.describe('Frontend Smoke Test', () => {

  test('application loads successfully', async ({ page }) => {

    await page.goto('/');

    await expect(page).toHaveTitle(/Wellness/i);

  });

});