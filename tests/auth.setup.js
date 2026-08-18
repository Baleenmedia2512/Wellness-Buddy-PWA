const { test: setup, expect } = require('@playwright/test');

const authFile = 'playwright/.auth/user.json';

setup('authenticate', async ({ page }) => {

  // Mock Send OTP
  await page.route('**/api/auth/send-otp', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
      }),
    });
  });

  // Mock successful OTP verification
  await page.route('**/api/auth/verify-otp', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        isNewUser: false,
      }),
    });
  });

  await page.goto('/');

  // Mobile number
  await page.getByLabel('Mobile Number').fill('7695834209');

  // Send OTP
  await page.getByRole('button', {
    name: 'Send OTP',
  }).click();

  // OTP screen
  const otpInputs = page.locator('input[type="tel"]');

  await expect(otpInputs).toHaveCount(6);

  // Enter OTP
  const otp = '123456';

  for (let i = 0; i < otp.length; i++) {
    await otpInputs.nth(i).fill(otp[i]);
  }

  // Wait for authentication state
  await expect
  .poll(
    async () =>
      page.evaluate(() =>
        localStorage.getItem('isOtpVerified')
      ),
    {
      timeout: 30000,
      intervals: [500, 1000, 2000],
    }
  )
  .toBe('true');

  // Save authentication state
  await page.context().storageState({
    path: authFile,
  });
});