const { test, expect } = require('@playwright/test');

test.describe('Frontend Smoke Test', () => {

  test('application loads successfully', async ({ page }) => {

    await page.goto('/');

    await expect(page).toHaveTitle(/Wellness/i);

  });

});