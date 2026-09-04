import { test, expect } from '@playwright/test';

test.describe('Homepage', () => {

  const TEST_PHONE = '7695834209';
  const LOGIN_OTP = '1234';
  const TEST_EMAIL = 'existing@test.com';

  async function dismissPermissionModalIfPresent(page) {
    try {
      const permissionPrimerBtn = page.getByRole('button', { name: /Allow Permissions|Continue|Allow|Got it|OK/i });
      if (await permissionPrimerBtn.isVisible({ timeout: 2000 })) {
        await permissionPrimerBtn.click();
      }
    } catch {
      // Permission modal was not shown; proceed
    }
  }

  async function loginAndNavigateToHome(page, role = 'developer') {
    // Grant browser-level permissions to avoid location / camera system prompts
    await page.context().grantPermissions(['geolocation', 'camera', 'microphone']).catch(() => { });
    await page.context().setGeolocation({ latitude: 12.9716, longitude: 77.5946 }).catch(() => { });

    // 1. Mock Send OTP
    await page.route('**/api/auth/send-otp', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });

    // 2. Mock Verify OTP with role
    await page.route('**/api/auth/verify-otp', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          isNewUser: false,
          user: {
            id: 1004,
            UserId: 1004,
            username: 'testuser',
            email: TEST_EMAIL,
            phone: `+91${TEST_PHONE}`,
            status: 'Active',
            role: role,
            userRole: role,
            consentRequired: false,
          },
        }),
      });
    });

    // 3. Mock User Lookup with role
    await page.route('**/api/user/lookup', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          isActive: true,
          isNewUser: false,
          role: role,
          userRole: role,
        }),
      });
    });

    // 4. Mock Consent
    await page.route('**/api/user/consent*', async route => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            consentRequired: false,
            consentAccepted: true,
          }),
        });
        return;
      }
      await route.continue();
    });

    // 5. Mock User Profile with role
    await page.route('**/api/user/profile*', async route => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              profileComplete: true,
              userName: 'Test User',
              email: TEST_EMAIL,
              role: role,
              userRole: role,
              height: 170,
              dietType: 'Non-Vegetarian',
              gender: 'Male',
              currentWeight: 70,
              bodyFat: 20,
              profileImage: 'https://example.com/profile.jpg',
              physicalActivityLevel: 'moderate',
            },
          }),
        });
        return;
      }
      await route.continue();
    });

    // 6. Mock User Status
    await page.route('**/api/user/status*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          setupSkipped: true,
          setupComplete: true,
          pendingRequest: false,
        }),
      });
    });

    // 7. Mock Global Leaderboard
    await page.route('**/api/leaderboard/get-global-leaderboard**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            {
              userId: 1,
              userName: 'Test User',
              email: TEST_EMAIL,
              coachName: 'Test Coach',
              sponsorName: 'Test Sponsor',
              weightLoss: 0.5,
              rank: 1,
            },
          ],
        }),
      });
    });

    // 8. Mock Wellness Score Leaderboard
    await page.route('**/api/leaderboard/get-wellness-score-leaderboard**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            {
              userId: 1,
              userName: 'Test User',
              email: TEST_EMAIL,
              wellnessPercentage: 85,
              totalEarned: 850,
              totalPossible: 1000,
              rank: 1,
            },
          ],
        }),
      });
    });

    // Go to landing page and log in
    await page.goto('/');

    const mobileInput = page.getByLabel('Mobile Number');
    await expect(mobileInput).toBeVisible({ timeout: 15000 });
    await mobileInput.fill(TEST_PHONE);

    const sendOtpButton = page.getByRole('button', { name: 'Send OTP' });
    await sendOtpButton.click();

    const otpInputs = page.locator('input[type="tel"]');
    await expect(otpInputs).toHaveCount(4);

    for (let i = 0; i < LOGIN_OTP.length; i++) {
      await otpInputs.nth(i).fill(LOGIN_OTP[i]);
    }

    // Dismiss permission primer if displayed
    await dismissPermissionModalIfPresent(page);

    // Wait for Homepage header / subtitle to appear
    await expect(
      page.getByText('Tracking Wellness with Ease', { exact: true })
    ).toBeVisible({ timeout: 20000 });
  }

  test('HOME-001 verify take photo and gallery uploaded photo displays next page correctly', async ({ page }) => {
    // 1. Navigate to homepage after login
    await loginAndNavigateToHome(page, 'developer');

    // 2. Verify Take Photo and Gallery buttons are displayed and active
    const takePhotoButton = page.getByRole('button', { name: 'Open camera' });
    const galleryButton = page.getByRole('button', { name: 'Choose from gallery' });

    await expect(takePhotoButton).toBeVisible({ timeout: 10000 });
    await expect(galleryButton).toBeVisible({ timeout: 10000 });

    const samplePngBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    );

    // ============================================================
    // A. CLICK "TAKE PHOTO" BUTTON & UPLOAD PHOTO VIA FILE CHOOSER
    // ============================================================
    const [cameraFileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      takePhotoButton.click(),
    ]);

    await cameraFileChooser.setFiles({
      name: 'camera_captured_meal.png',
      mimeType: 'image/png',
      buffer: samplePngBuffer,
    });

    // Verify next classify page displays correctly for Take Photo
    const classifyHeading1 = page.getByRole('heading', { name: 'What is this image?' });
    await expect(classifyHeading1).toBeVisible({ timeout: 15000 });

    await expect(page.getByRole('button', { name: 'Food' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Weight' })).toBeVisible();
    const cancelButton1 = page.getByRole('button', { name: "Cancel, Don't Log" });
    await expect(cancelButton1).toBeVisible();

    // Cancel classify screen to return to Homepage
    await cancelButton1.click();
    await expect(classifyHeading1).not.toBeVisible({ timeout: 10000 });

    // ============================================================
    // B. CLICK "GALLERY" BUTTON & UPLOAD PHOTO VIA FILE CHOOSER
    // ============================================================
    const [galleryFileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      galleryButton.click(),
    ]);

    await galleryFileChooser.setFiles({
      name: 'gallery_selected_meal.png',
      mimeType: 'image/png',
      buffer: samplePngBuffer,
    });

    // Verify next classify page displays correctly for Gallery Upload
    const classifyHeading2 = page.getByRole('heading', { name: 'What is this image?' });
    await expect(classifyHeading2).toBeVisible({ timeout: 15000 });

    await expect(page.getByRole('button', { name: 'Food' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Weight' })).toBeVisible();
    await expect(page.getByRole('button', { name: "Cancel, Don't Log" })).toBeVisible();
  });

  test('HOME-002 developer role can see AI credits setup and wellness score setup; non-developer cannot', async ({ page }) => {
    // ============================================================
    // 1. DEVELOPER ROLE: VERIFY OPTIONS ARE VISIBLE
    // ============================================================
    await loginAndNavigateToHome(page, 'developer');

    const aiCreditsButtonDev = page.getByRole('button', { name: 'Open AI Credits Setup' });
    const wellnessScoreSetupDev = page.locator('[data-testid="wellness-score-setup-button"]').or(page.getByRole('button', { name: 'Configure wellness score' }));

    await expect(aiCreditsButtonDev).toBeVisible({ timeout: 15000 });
    await expect(wellnessScoreSetupDev.first()).toBeVisible({ timeout: 15000 });

    // ============================================================
    // 2. NON-DEVELOPER ROLE (MEMBER): VERIFY OPTIONS ARE NOT VISIBLE
    // ============================================================
    await page.goto('/');
    await loginAndNavigateToHome(page, 'member');

    const aiCreditsButtonMember = page.getByRole('button', { name: 'Open AI Credits Setup' });
    const wellnessScoreSetupMember = page.locator('[data-testid="wellness-score-setup-button"]').or(page.getByRole('button', { name: 'Configure wellness score' }));

    await expect(aiCreditsButtonMember).not.toBeVisible({ timeout: 10000 });
    await expect(wellnessScoreSetupMember).not.toBeVisible({ timeout: 10000 });
  });

  



});
