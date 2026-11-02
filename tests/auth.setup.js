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

  // Seed authentication state before page load
  await page.addInitScript(() => {
    try {
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
          // Required so onboarding Transformation Photos gate does not block nav tabs
          transformationPhotos: {
            left: 'https://example.com/left.jpg',
            front: 'https://example.com/front.jpg',
            right: 'https://example.com/right.jpg',
          },
        },
      }),
    });
  });

  try {
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 15000 });
  } catch (_) {}

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