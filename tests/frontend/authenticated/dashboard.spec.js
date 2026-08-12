const { test, expect } = require('@playwright/test');

test.describe('Authenticated Application', () => {

  test('AUTH-020 authenticated user can access application', async ({ page }) => {

    await page.goto('/');

    await expect(
      page.getByText(/Enter OTP/i)
    ).not.toBeVisible();

    console.log('Current URL:', page.url());

    console.log(
      'Authenticated page:',
      await page.locator('body').innerText()
    );

  });

});