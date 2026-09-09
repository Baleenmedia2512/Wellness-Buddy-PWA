const path = require('path');
const fs = require('fs');
const { test: setup, expect } = require('@playwright/test');

const authFile = 'playwright/.auth/user.json';

setup('authenticate', async ({ page }) => {
  // Ensure the auth directory exists
  const authDir = path.dirname(authFile);
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  // Ensure clean unauthenticated slate
  await page.addInitScript(() => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (_) {}
  });

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
        user: {
          id: 99999,
          UserId: 99999,
          UserName: 'Test Coach',
          phone: '+917695834209',
          role: 'coach',
          email: 'test@example.com',
        },
      }),
    });
  });

  // Mock post-auth API endpoints so checkUserStatus / profile completion resolve instantly
  await page.route('**/api/user/status*', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        isActive: true,
        isNewUser: false,
        setupSkipped: true,
        setupComplete: true,
      }),
    });
  });

  await page.route('**/api/user/lookup*', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        isActive: true,
        isNewUser: false,
      }),
    });
  });

  await page.route('**/api/user/consent*', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        consentRequired: false,
        consentAccepted: true,
      }),
    });
  });

  await page.route('**/api/user/profile*', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          profileComplete: true,
          userName: 'Test Coach',
          email: 'test@example.com',
          phone: '+917695834209',
          role: 'coach',
        },
      }),
    });
  });

  await page.goto('/', { waitUntil: 'domcontentloaded' });

  // Mobile number input
  const mobileInput = page.getByLabel('Mobile Number');
  await expect(mobileInput).toBeVisible({ timeout: 15000 });
  await mobileInput.fill('7695834209');

  // Click Send OTP
  const sendOtpBtn = page.getByRole('button', { name: 'Send OTP' });
  await expect(sendOtpBtn).toBeEnabled();
  await sendOtpBtn.click();

  // Wait for OTP screen to appear
  await expect(page.getByText('Enter OTP', { exact: true })).toBeVisible({
    timeout: 15000,
  });

  // Target OTP input cells specifically using data-otp attribute
  const otpInputs = page.locator('input[data-otp="true"]');
  await expect(otpInputs).toHaveCount(4, { timeout: 10000 });

  // Enter OTP
  const otp = '1234';
  for (let i = 0; i < otp.length; i++) {
    await otpInputs.nth(i).fill(otp[i]);
  }

  // Wait for authentication state in localStorage
  await expect
    .poll(
      async () =>
        page.evaluate(() => localStorage.getItem('isOtpVerified')),
      {
        timeout: 15000,
        intervals: [200, 500, 1000],
      }
    )
    .toBe('true');

  // Ensure all required authentication keys exist in localStorage
  await page.evaluate(() => {
    localStorage.removeItem('userSignedOut');
    localStorage.setItem('isOtpVerified', 'true');
    localStorage.setItem(
      'otpUser',
      JSON.stringify({
        id: 99999,
        UserId: 99999,
        UserName: 'Test Coach',
        phone: '+917695834209',
        role: 'coach',
        email: 'test@example.com',
      })
    );
    localStorage.setItem('dbUserId', '99999');
    localStorage.setItem('userEmail', 'test@example.com');
  });

  // Save storage state for all authenticated tests
  await page.context().storageState({
    path: authFile,
  });

  // Verify file was written and is valid JSON
  expect(fs.existsSync(authFile)).toBe(true);
  const authContent = JSON.parse(fs.readFileSync(authFile, 'utf8'));
  expect(authContent.origins?.length).toBeGreaterThan(0);
});