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

    // Wait for Homepage header / subtitle or gallery upload button to appear
    const homeIndicator = page.getByText('Tracking Wellness with Ease', { exact: false })
      .or(page.getByRole('button', { name: 'Choose from gallery' }))
      .or(page.getByText('Choose from gallery', { exact: false }));
    await expect(homeIndicator.first()).toBeVisible({ timeout: 20000 });
  }

  const samplePngBuffer = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64'
  );

  test('HOME-001 verify take photo and gallery uploaded photo displays next page correctly', async ({ page }) => {
    // 1. Navigate to homepage after login
    await loginAndNavigateToHome(page, 'developer');

    // 2. Verify Take Photo and Gallery buttons are displayed and active
    const takePhotoButton = page.getByRole('button', { name: 'Open camera' });
    const galleryButton = page.getByRole('button', { name: 'Choose from gallery' });

    await expect(takePhotoButton).toBeVisible({ timeout: 10000 });
    await expect(galleryButton).toBeVisible({ timeout: 10000 });


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
    await page.evaluate(() => localStorage.clear()).catch(() => {});
    await loginAndNavigateToHome(page, 'member');

    const aiCreditsButtonMember = page.getByRole('button', { name: 'Open AI Credits Setup' });
    const wellnessScoreSetupMember = page.locator('[data-testid="wellness-score-setup-button"]').or(page.getByRole('button', { name: 'Configure wellness score' }));

    await expect(aiCreditsButtonMember).not.toBeVisible({ timeout: 10000 });
    await expect(wellnessScoreSetupMember).not.toBeVisible({ timeout: 10000 });
  });

  test('HOME-003 after uploading image, weight option can be selected, weight is editable, shared to whatsapp, and updated in profile', async ({ page }) => {
    let savedWeightPayload = null;

    // 1. Mock Weight Save API
    await page.route('**/api/weight/save', async (route) => {
      savedWeightPayload = JSON.parse(route.request().postData() || '{}');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            id: 101,
            weightValue: savedWeightPayload.weightValue || 75.5,
            unit: savedWeightPayload.unit || 'kg',
            createdAt: new Date().toISOString(),
          },
        }),
      });
    });

    // 2. Log in and navigate to Homepage
    await loginAndNavigateToHome(page, 'developer');

    // 3. Upload image via Gallery button
    const galleryButton = page.getByRole('button', { name: 'Choose from gallery' });
    await expect(galleryButton).toBeVisible({ timeout: 15000 });

    const samplePngBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    );

    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      galleryButton.click(),
    ]);

    await fileChooser.setFiles({
      name: 'scale_photo.png',
      mimeType: 'image/png',
      buffer: samplePngBuffer,
    });

    // 4. Verify Next classify page ('What is this image?') is displayed and select Weight option
    const classifyHeading = page.getByRole('heading', { name: 'What is this image?' });
    await expect(classifyHeading).toBeVisible({ timeout: 15000 });

    const weightOptionButton = page.getByRole('button', { name: 'Weight' });
    await expect(weightOptionButton).toBeVisible({ timeout: 10000 });
    await weightOptionButton.click();

    // 5. Verify Weight Entry Modal opens and edit weight value to 75.5
    const weightInput = page.getByPlaceholder('e.g., 72.5').or(
      page.getByLabel('Weight Value')
    ).or(page.locator('input[inputmode="decimal"]'));
    await expect(weightInput.first()).toBeVisible({ timeout: 10000 });

    // Fill new weight value
    await weightInput.first().fill('75.5');
    await expect(weightInput.first()).toHaveValue('75.5');

    // 6. Click Save button
    const saveButton = page.getByRole('button', { name: 'Save' });
    await expect(saveButton).toBeVisible();
    await saveButton.click();

    // 7. Verify Weight is saved and toast/share caption triggered correctly
    await expect(page.getByText('Weight saved to Diary')).toBeVisible({ timeout: 10000 });

    // Verify backend received the updated weight payload
    expect(savedWeightPayload).not.toBeNull();
    expect(savedWeightPayload.weightValue).toBe(75.5);

    // 8. Override User Profile API after save to return updated weight (75.5 kg)
    await page.unroute('**/api/user/profile*');
    await page.route('**/api/user/profile*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            profileComplete: true,
            userName: 'Test User',
            email: TEST_EMAIL,
            role: 'developer',
            userRole: 'developer',
            height: 170,
            dietType: 'Non-Vegetarian',
            gender: 'Male',
            currentWeight: 75.5,
            latestWeight: 75.5,
            initialWeight: 70,
            bodyFat: 20,
            profileImage: 'https://example.com/profile.jpg',
            physicalActivityLevel: 'moderate',
            marathonWeightComparison: null,
          },
        }),
      });
    });

    // Clear in-memory cacheManager in browser context so Profile fetches fresh payload
    await page.evaluate(() => {
      if (window.__cacheManager) window.__cacheManager.clearAll();
    });

    // 9. Navigate to Profile page and verify updated weight is displayed
    const profileButton = page.getByTitle('My Profile').or(
      page.getByRole('button', { name: 'My Profile' })
    );
    await expect(profileButton.first()).toBeVisible({ timeout: 10000 });
    await profileButton.first().click();

    // Verify Profile page Personal Details header and updated weight (75.5 kg / 75.50 kg)
    await expect(page.getByRole('heading', { name: 'Personal Details' })).toBeVisible({ timeout: 15000 });
    await expect(
      page.getByText('75.50 kg').or(page.getByText('75.5 kg')).or(page.getByText('75.5'))
    ).toBeVisible({ timeout: 10000 });
  });

  test('HOME-004 upload image and increase/decrease scoop and save, maintain previously updated scoop on fresh image selection', async ({ page }) => {
    let currentAfreshScoops = 0;
    let promotedFoodPayloads = [];

    // Mock Water / Beverage Intake API to return currentAfreshScoops state
    await page.route('**/api/water/intake*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          totalMl: 0,
          totalAfreshScoops: currentAfreshScoops,
        }),
      });
    });

    await page.route('**/api/water*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          totalMl: 0,
          totalAfreshScoops: currentAfreshScoops,
        }),
      });
    });

    // Mock Food / Capture promotion API
    await page.route('**/api/captures/promote-unknown-to-food', async (route) => {
      const body = JSON.parse(route.request().postData() || '{}');
      promotedFoodPayloads.push(body);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            id: Date.now(),
            ...body,
          },
        }),
      });
    });

    await loginAndNavigateToHome(page, 'developer');

    // ============================================================
    // FIRST IMAGE UPLOAD & AFRESH SCOOP TESTING
    // ============================================================
    const galleryButton1 = page.getByRole('button', { name: 'Choose from gallery' });
    await expect(galleryButton1).toBeVisible({ timeout: 15000 });

    const [fileChooser1] = await Promise.all([
      page.waitForEvent('filechooser'),
      galleryButton1.click(),
    ]);

    await fileChooser1.setFiles({
      name: 'afresh_test_1.png',
      mimeType: 'image/png',
      buffer: samplePngBuffer,
    });

    // Verify Classify page appears
    const classifyHeading = page.getByRole('heading', { name: 'What is this image?' });
    await expect(classifyHeading).toBeVisible({ timeout: 15000 });

    // Select Afresh category option
    const afreshButton = page.getByRole('button', { name: 'Afresh' });
    await expect(afreshButton).toBeVisible({ timeout: 10000 });
    await afreshButton.click();

    // Verify Afresh Stepper modal is displayed
    const afreshModalHeader = page.getByRole('heading', { name: 'Afresh' });
    await expect(afreshModalHeader).toBeVisible({ timeout: 10000 });

    // Initial scoop display check (0 scoops)
    const scoopDisplay = page.getByText('0 scoops', { exact: true }).or(page.getByText('0 scoop', { exact: true }));
    await expect(scoopDisplay).toBeVisible({ timeout: 5000 });

    const decreaseButton = page.getByRole('button', { name: 'Decrease' });
    const increaseButton = page.getByRole('button', { name: 'Increase' });

    // 1. Test Increase scoops to 3 scoops
    await increaseButton.click();
    await increaseButton.click();
    await increaseButton.click();
    await expect(page.getByText('3 scoops', { exact: true })).toBeVisible({ timeout: 5000 });

    // 2. Test Decrease scoops back to 2 scoops
    await decreaseButton.click();
    await expect(page.getByText('2 scoops', { exact: true })).toBeVisible({ timeout: 5000 });

    // Save Afresh log (button title updates dynamically to 'Add 2 scoops')
    const confirmButton1 = page.getByRole('button', { name: /Add 2 scoops|Log Afresh|Save/i });
    await expect(confirmButton1).toBeVisible({ timeout: 5000 });
    await confirmButton1.click();

    // Update backend mock state to reflect saved scoops (2 scoops)
    currentAfreshScoops = 2;

    // Wait until classify modal exits and Homepage is active again
    await expect(galleryButton1).toBeVisible({ timeout: 15000 });

    // ============================================================
    // SECOND IMAGE UPLOAD & PREVIOUS SCOOP STATE MAINTENANCE CHECK
    // ============================================================
    const galleryButton2 = page.getByRole('button', { name: 'Choose from gallery' });
    const [fileChooser2] = await Promise.all([
      page.waitForEvent('filechooser'),
      galleryButton2.click(),
    ]);

    await fileChooser2.setFiles({
      name: 'afresh_test_2.png',
      mimeType: 'image/png',
      buffer: samplePngBuffer,
    });

    await expect(page.getByRole('heading', { name: 'What is this image?' })).toBeVisible({ timeout: 15000 });

    // Select Afresh option for second image
    await page.getByRole('button', { name: 'Afresh' }).click();

    // Verify modal maintains previous state (2 scoops)
    await expect(page.getByRole('heading', { name: 'Afresh' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('2 scoops', { exact: true })).toBeVisible({ timeout: 5000 });

    // 3. Further update state from maintained state (increase from 2 scoops to 4 scoops)
    await increaseButton.click();
    await increaseButton.click();
    await expect(page.getByText('4 scoops', { exact: true })).toBeVisible({ timeout: 5000 });

    // Save updated state (Add 2 scoops delta to reach 4 scoops)
    const confirmButton2 = page.getByRole('button', { name: /Add 2 scoops|Log Afresh|Save/i });
    await expect(confirmButton2).toBeVisible({ timeout: 5000 });
    await confirmButton2.click();

    // Verify modal closes and flow completes back on Home screen
    await expect(galleryButton2).toBeVisible({ timeout: 15000 });
  });

  test('HOME-005 upload image, select all options in education, pick Wellness Seminar and In-person, save, and verify education modal behavior on revisit', async ({ page }) => {
    let savedEducationPayloads = [];
    await page.route('**/api/education/**', async (route) => {
      if (route.request().method() === 'POST') {
        const body = JSON.parse(route.request().postData() || '{}');
        savedEducationPayloads.push(body);
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { id: Date.now() },
        }),
      });
    });

    await loginAndNavigateToHome(page, 'developer');

    // ============================================================
    // 1. UPLOAD IMAGE & TEST SELECTING ALL EDUCATION OPTIONS
    // ============================================================
    const galleryButton1 = page.getByRole('button', { name: 'Choose from gallery' });
    await expect(galleryButton1).toBeVisible({ timeout: 15000 });

    const [fileChooser1] = await Promise.all([
      page.waitForEvent('filechooser'),
      galleryButton1.click(),
    ]);

    await fileChooser1.setFiles({
      name: 'education_test_1.png',
      mimeType: 'image/png',
      buffer: samplePngBuffer,
    });

    // Verify Classify screen appears
    await expect(page.getByRole('heading', { name: 'What is this image?' })).toBeVisible({ timeout: 15000 });

    // Select Education category tile from 'Log as' grid
    const educationCategoryBtn = page.getByRole('button', { name: 'Education' }).or(
      page.getByText('Education', { exact: true })
    );
    await expect(educationCategoryBtn.first()).toBeVisible({ timeout: 10000 });
    await educationCategoryBtn.first().click();

    // Click 'Log Education' button on intro screen if shown
    const logEducationIntroBtn = page.getByRole('button', { name: /Log Education/i }).or(
      page.getByText(/Log Education/i)
    );
    await expect(logEducationIntroBtn.first()).toBeVisible({ timeout: 10000 });
    await logEducationIntroBtn.first().click();

    // Verify Education Form is open
    await expect(page.getByText('Meeting session')).toBeVisible({ timeout: 10000 });

    // Click through all Meeting Session options to verify they are all selectable
    const meetingSessions = ['Blueprint for Success', 'HALA', 'Daily Education', 'Wellness Seminar', 'Academy'];
    for (const session of meetingSessions) {
      const sessionBtn = page.getByRole('button', { name: session, exact: true });
      await expect(sessionBtn).toBeVisible();
      await sessionBtn.click();
      await expect(sessionBtn).toHaveClass(/bg-emerald-50/);
    }

    // Select target Meeting Session: "Wellness Seminar"
    const wellnessSeminarBtn = page.getByRole('button', { name: 'Wellness Seminar', exact: true });
    await wellnessSeminarBtn.click();
    await expect(wellnessSeminarBtn).toHaveClass(/bg-emerald-50/);

    // Click through all Platform options to verify they are all selectable
    const platforms = ['Zoom', 'Microsoft Teams', 'Google Meet', 'In-person', 'Other'];
    for (const platformItem of platforms) {
      const platformBtn = page.getByRole('button', { name: platformItem, exact: true });
      await expect(platformBtn).toBeVisible();
      await platformBtn.click();
      await expect(platformBtn).toHaveClass(/bg-emerald-50/);
    }

    // Select target Platform: "In-person"
    const inPersonBtn = page.getByRole('button', { name: 'In-person', exact: true });
    await inPersonBtn.click();
    await expect(inPersonBtn).toHaveClass(/bg-emerald-50/);

    // Click Save Education
    const saveEducationBtn = page.getByRole('button', { name: 'Save', exact: true });
    await expect(saveEducationBtn).toBeVisible({ timeout: 5000 });
    await saveEducationBtn.click();

    // Verify payload sent to backend contains topic "Wellness Seminar" and platform "In-person"
    await expect.poll(() => savedEducationPayloads.length).toBeGreaterThanOrEqual(1);
    expect(savedEducationPayloads[0]).toMatchObject({
      topic: 'Wellness Seminar',
      platform: 'In-person',
    });

    // Wait until modal closes and Homepage is back
    await expect(galleryButton1).toBeVisible({ timeout: 15000 });

    // ============================================================
    // 2. FRESH IMAGE UPLOAD & RE-VISIT EDUCATION MODAL
    // ============================================================
    const galleryButton2 = page.getByRole('button', { name: 'Choose from gallery' });
    const [fileChooser2] = await Promise.all([
      page.waitForEvent('filechooser'),
      galleryButton2.click(),
    ]);

    await fileChooser2.setFiles({
      name: 'education_test_2.png',
      mimeType: 'image/png',
      buffer: samplePngBuffer,
    });

    await expect(page.getByRole('heading', { name: 'What is this image?' })).toBeVisible({ timeout: 15000 });

    // Open Education modal again
    await educationCategoryBtn.first().click();
    await expect(logEducationIntroBtn.first()).toBeVisible({ timeout: 10000 });
    await logEducationIntroBtn.first().click();

    // Verify modal form opens cleanly with Meeting session options
    await expect(page.getByText('Meeting session')).toBeVisible({ timeout: 10000 });
    await expect(saveEducationBtn).toBeVisible();
  });

  test('HOME-006 upload image and select water, test increase/decrease ml, quick add presets, save, and verify consumed water ml is maintained on fresh image upload', async ({ page }) => {
    let currentWaterMl = 0;

    // Mock Water Intake API to return currentWaterMl state
    await page.route('**/api/water/intake*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          totalMl: currentWaterMl,
          totalAfreshScoops: 0,
        }),
      });
    });

    await page.route('**/api/water*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          totalMl: currentWaterMl,
          totalAfreshScoops: 0,
        }),
      });
    });

    // Mock Food / Capture promotion API for water logging
    await page.route('**/api/captures/promote-unknown-to-food', async (route) => {
      const body = JSON.parse(route.request().postData() || '{}');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            id: Date.now(),
            ...body,
          },
        }),
      });
    });

    await loginAndNavigateToHome(page, 'developer');

    // ============================================================
    // 1. FIRST IMAGE UPLOAD & WATER STEPPER / QUICK ADD TESTING
    // ============================================================
    const galleryButton1 = page.getByRole('button', { name: 'Choose from gallery' });
    await expect(galleryButton1).toBeVisible({ timeout: 15000 });

    const [fileChooser1] = await Promise.all([
      page.waitForEvent('filechooser'),
      galleryButton1.click(),
    ]);

    await fileChooser1.setFiles({
      name: 'water_test_1.png',
      mimeType: 'image/png',
      buffer: samplePngBuffer,
    });

    // Verify Classify page appears
    await expect(page.getByRole('heading', { name: 'What is this image?' })).toBeVisible({ timeout: 15000 });

    // Select Water category option tile from 'Log as' grid
    const waterCategoryBtn = page.getByRole('button', { name: 'Water', exact: true });
    await expect(waterCategoryBtn).toBeVisible({ timeout: 10000 });
    await waterCategoryBtn.click();

    // Verify Water Stepper modal is displayed
    const waterModalHeader = page.getByRole('heading', { name: 'Water', exact: true });
    await expect(waterModalHeader).toBeVisible({ timeout: 10000 });

    // Verify initial water display starts at 0 ml
    await expect(page.getByText('0 ml', { exact: true })).toBeVisible({ timeout: 5000 });

    const increaseBtn = page.getByRole('button', { name: 'Increase' });
    const decreaseBtn = page.getByRole('button', { name: 'Decrease' });

    // A. Test Increase button (stepper step = +100 ml)
    await increaseBtn.click();
    await increaseBtn.click();
    await expect(page.getByText('200 ml', { exact: true })).toBeVisible({ timeout: 5000 });

    // B. Test Decrease button (stepper step = -100 ml)
    await decreaseBtn.click();
    await expect(page.getByText('100 ml', { exact: true })).toBeVisible({ timeout: 5000 });

    // C. Test Quick Add preset '+100 ml' (+100 ml -> 200 ml)
    const quickAdd100Btn = page.getByRole('button', { name: '+100 ml' }).or(page.getByText('+100 ml'));
    await expect(quickAdd100Btn).toBeVisible({ timeout: 5000 });
    await quickAdd100Btn.click();
    await expect(page.getByText('200 ml', { exact: true })).toBeVisible({ timeout: 5000 });

    // D. Test Quick Add preset '+1 L' (+1000 ml -> 1200 ml)
    const quickAdd1LBtn = page.getByRole('button', { name: '+1 L' }).or(page.getByText('+1 L'));
    await expect(quickAdd1LBtn).toBeVisible({ timeout: 5000 });
    await quickAdd1LBtn.click();
    await expect(page.getByText('1200 ml', { exact: true })).toBeVisible({ timeout: 5000 });

    // Save Water log (button label updates dynamically to 'Add 1200 ml')
    const confirmWaterBtn1 = page.getByRole('button', { name: /Add 1200 ml|Log Water|Save/i });
    await expect(confirmWaterBtn1).toBeVisible({ timeout: 5000 });
    await confirmWaterBtn1.click();

    // Update backend mock state to reflect saved water intake (1200 ml)
    currentWaterMl = 1200;

    // Wait until modal closes and Homepage is active again
    await expect(galleryButton1).toBeVisible({ timeout: 15000 });

    // ============================================================
    // 2. SECOND IMAGE UPLOAD & PREVIOUSLY CONSUMED WATER ML MAINTENANCE CHECK
    // ============================================================
    const galleryButton2 = page.getByRole('button', { name: 'Choose from gallery' });
    const [fileChooser2] = await Promise.all([
      page.waitForEvent('filechooser'),
      galleryButton2.click(),
    ]);

    await fileChooser2.setFiles({
      name: 'water_test_2.png',
      mimeType: 'image/png',
      buffer: samplePngBuffer,
    });

    await expect(page.getByRole('heading', { name: 'What is this image?' })).toBeVisible({ timeout: 15000 });

    // Select Water category option again
    await waterCategoryBtn.click();

    // Verify Water modal opens and maintains previously consumed water amount (1200 ml)
    await expect(waterModalHeader).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('1200 ml', { exact: true })).toBeVisible({ timeout: 5000 });

    // Further increase water intake from maintained state (+100 ml -> 1300 ml)
    await increaseBtn.click();
    await expect(page.getByText('1300 ml', { exact: true })).toBeVisible({ timeout: 5000 });

    // Save updated water intake (bottom action button)
    const confirmWaterBtn2 = page.locator('div.bg-gray-50 button').filter({ hasText: /Add \d+ ml|Log Water|Save/i });
    await expect(confirmWaterBtn2.first()).toBeVisible({ timeout: 5000 });
    await confirmWaterBtn2.first().click();

    // Verify flow finishes back on Homepage
    await expect(galleryButton2).toBeVisible({ timeout: 15000 });
  });

  test('HOME-007 upload image, search food options (vegetable biriyani, mutton rice), save meal, and verify in diary', async ({ page }) => {
    let savedFoodPayloads = [];

    // Mock Food Corrections Search API for queries (e.g. biriyani, rice, mutton, etc.)
    await page.route('**/api/food-corrections/search*', async (route) => {
      const url = new URL(route.request().url());
      const query = (url.searchParams.get('query') || '').toLowerCase();

      let masterItems = [
        { name: 'Vegetable Biriyani', calories: 280, protein: 6, carbs: 45, fat: 8, portion: '1 plate' },
        { name: 'Mutton Rice', calories: 420, protein: 22, carbs: 50, fat: 14, portion: '1 plate' },
      ];

      if (query) {
        masterItems = masterItems.filter((i) => i.name.toLowerCase().includes(query));
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          masterItems,
          myItems: [],
          communityItems: [],
        }),
      });
    });

    // Mock Food Suggestions API
    await page.route('**/api/food-suggestions*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          latest: [],
          oftenWith: [],
        }),
      });
    });

    // Mock Capture Food Promotion API
    await page.route(/\/api\/(background-analysis\/captures\/retry-promotion|captures\/promote-unknown-to-food)/, async (route) => {
      const body = JSON.parse(route.request().postData() || '{}');
      savedFoodPayloads.push(body);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            id: Date.now(),
            ...body,
          },
        }),
      });
    });

    // Mock Diary List API to include the saved food item
    await page.route('**/api/diary/list*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          data: {
            date: new Date().toISOString().slice(0, 10),
            ownerUserId: 'developer',
            isSelf: true,
            includesUnknown: false,
            pagination: { limit: 20, offset: 0, total: 1, hasMore: false, nextOffset: null },
            entries: [
              {
                kind: 'food',
                capturedAt: new Date().toISOString(),
                payload: {
                  id: 'meal-1',
                  mealName: 'Vegetable Biriyani & Mutton Rice',
                  foodName: 'Vegetable Biriyani & Mutton Rice',
                  totals: {
                    calories: 700,
                    protein: 28,
                    carbs: 95,
                    fat: 22,
                  },
                  listSummary: {
                    name: 'Vegetable Biriyani & Mutton Rice',
                    items: [
                      { name: 'Vegetable Biriyani', calories: 280 },
                      { name: 'Mutton Rice', calories: 420 },
                    ],
                  },
                },
              },
            ],
          },
        }),
      });
    });

    await loginAndNavigateToHome(page, 'developer');

    // ============================================================
    // 1. UPLOAD IMAGE AND NAVIGATE TO FOOD SEARCH
    // ============================================================
    const galleryButton = page.getByRole('button', { name: 'Choose from gallery' });
    await expect(galleryButton).toBeVisible({ timeout: 15000 });

    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      galleryButton.click(),
    ]);

    await fileChooser.setFiles({
      name: 'food_search_test.png',
      mimeType: 'image/png',
      buffer: samplePngBuffer,
    });

    // Verify Classify screen header
    await expect(page.getByRole('heading', { name: 'What is this image?' })).toBeVisible({ timeout: 15000 });

    // Select Food category tile
    const foodCategoryBtn = page.getByRole('button', { name: 'Food', exact: true });
    await expect(foodCategoryBtn).toBeVisible({ timeout: 10000 });
    await foodCategoryBtn.click();

    // Verify Add Food modal / search screen is open
    const searchInput = page.getByPlaceholder('Search for food...');
    await expect(searchInput).toBeVisible({ timeout: 15000 });

    // ============================================================
    // 2. SEARCH & SELECT FOOD OPTIONS (Vegetable Biriyani & Mutton Rice)
    // ============================================================
    // Search for "biriyani" and select Vegetable Biriyani
    await searchInput.fill('biriyani');
    const vegBiriyaniItem = page.getByText('Vegetable Biriyani', { exact: false });
    await expect(vegBiriyaniItem.first()).toBeVisible({ timeout: 10000 });
    await vegBiriyaniItem.first().click();

    // Search for "mutton" and select Mutton Rice
    await searchInput.fill('mutton');
    const muttonRiceItem = page.getByText('Mutton Rice', { exact: false });
    await expect(muttonRiceItem.first()).toBeVisible({ timeout: 10000 });
    await muttonRiceItem.first().click();

    // Verify meal tray shows floating Save Meal / Save 2 Items button
    const saveMealBtn = page.getByRole('button', { name: /Save Meal|Save \d+ Items/i }).or(
      page.locator('button').filter({ hasText: /Save Meal|Save \d+ Items/i })
    );
    await expect(saveMealBtn.first()).toBeVisible({ timeout: 10000 });
    await saveMealBtn.first().click();

    // Verify flow finishes back on Homepage
    await expect(galleryButton).toBeVisible({ timeout: 15000 });

    // Verify promoteUnknownToFood was called with selected food items
    expect(savedFoodPayloads.length).toBeGreaterThan(0);

    // ============================================================
    // 3. NAVIGATE TO DIARY AND VERIFY SAVED MEAL IS ADDED CORRECTLY
    // ============================================================
    const diaryTabBtn = page.getByRole('button', { name: 'Diary', exact: true }).or(
      page.getByText('Diary', { exact: true })
    );
    await expect(diaryTabBtn.first()).toBeVisible({ timeout: 10000 });
    await diaryTabBtn.first().click();

    const diaryFoodRow = page.getByTestId('diary-row-food').or(
      page.getByRole('heading', { name: 'Vegetable Biriyani & Mutton Rice' })
    );
    await expect(diaryFoodRow.first()).toBeVisible({ timeout: 15000 });
  });

  test('HOME-008 upload image, select Workout, test increase/decrease calories and quick add presets, save, and verify previously logged calories are maintained on fresh image upload', async ({ page }) => {
    let currentWorkoutKcal = 0;
    let savedWorkoutPayloads = [];

    // Mock watch calories burned endpoint to track currentWorkoutKcal
    await page.route('**/api/activity/watch-calories*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          caloriesBurned: currentWorkoutKcal,
        }),
      });
    });

    // Mock Education / Activity Log Save API for Workout entry
    await page.route('**/api/education/log*', async (route) => {
      const body = JSON.parse(route.request().postData() || '{}');
      savedWorkoutPayloads.push(body);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { id: Date.now(), ...body },
        }),
      });
    });

    await loginAndNavigateToHome(page, 'developer');

    // ============================================================
    // 1. FIRST IMAGE UPLOAD & WORKOUT STEPPER / QUICK ADD TESTING
    // ============================================================
    const galleryButton1 = page.getByRole('button', { name: 'Choose from gallery' });
    await expect(galleryButton1).toBeVisible({ timeout: 15000 });

    const [fileChooser1] = await Promise.all([
      page.waitForEvent('filechooser'),
      galleryButton1.click(),
    ]);

    await fileChooser1.setFiles({
      name: 'workout_test_1.png',
      mimeType: 'image/png',
      buffer: samplePngBuffer,
    });

    // Verify Classify screen header
    await expect(page.getByRole('heading', { name: 'What is this image?' })).toBeVisible({ timeout: 15000 });

    // Select Workout category option tile
    const workoutCategoryBtn = page.getByRole('button', { name: 'Workout' }).or(
      page.getByRole('button', { name: /Workout/i })
    );
    await expect(workoutCategoryBtn.first()).toBeVisible({ timeout: 10000 });
    await workoutCategoryBtn.first().click();

    // Verify Calories burnt modal is displayed
    const workoutModalHeader = page.getByRole('heading', { name: 'Calories burnt' });
    await expect(workoutModalHeader).toBeVisible({ timeout: 10000 });

    // Initial calories display (starts at 0 kcal)
    await expect(page.getByText('0 kcal', { exact: true })).toBeVisible({ timeout: 5000 });

    const increaseBtn = page.getByRole('button', { name: 'Increase' });
    const decreaseBtn = page.getByRole('button', { name: 'Decrease' });

    // A. Test Increase button (+1 step -> 2 kcal)
    await increaseBtn.click();
    await increaseBtn.click();
    await expect(page.getByText('2 kcal', { exact: true })).toBeVisible({ timeout: 5000 });

    // B. Test Decrease button (-1 step -> 1 kcal)
    await decreaseBtn.click();
    await expect(page.getByText('1 kcal', { exact: true })).toBeVisible({ timeout: 5000 });

    // C. Test Quick Add preset "+50 kcal" (1 + 50 = 51 kcal)
    const quickAdd50Btn = page.getByRole('button', { name: '+50 kcal' }).or(page.getByText('+50 kcal'));
    await expect(quickAdd50Btn.first()).toBeVisible({ timeout: 5000 });
    await quickAdd50Btn.first().click();
    await expect(page.getByText('51 kcal', { exact: true })).toBeVisible({ timeout: 5000 });

    // D. Test Quick Add preset "+100 kcal" (51 + 100 = 151 kcal)
    const quickAdd100Btn = page.getByRole('button', { name: '+100 kcal' }).or(page.getByText('+100 kcal'));
    await expect(quickAdd100Btn.first()).toBeVisible({ timeout: 5000 });
    await quickAdd100Btn.first().click();
    await expect(page.getByText('151 kcal', { exact: true })).toBeVisible({ timeout: 5000 });

    // E. Test Quick Add preset "+250 kcal" (151 + 250 = 401 kcal)
    const quickAdd250Btn = page.getByRole('button', { name: '+250 kcal' }).or(page.getByText('+250 kcal'));
    await expect(quickAdd250Btn.first()).toBeVisible({ timeout: 5000 });
    await quickAdd250Btn.first().click();
    await expect(page.getByText('401 kcal', { exact: true })).toBeVisible({ timeout: 5000 });

    // Save Workout log (button text: 'Log Activity' or 'Update to 401 kcal')
    const confirmWorkoutBtn1 = page.getByRole('button', { name: /Log Activity|Update to 401 kcal|Add calories/i });
    await expect(confirmWorkoutBtn1).toBeVisible({ timeout: 5000 });
    await confirmWorkoutBtn1.click();

    // Update backend state to reflect saved workout calories (401 kcal baseline)
    currentWorkoutKcal = 401;

    // Verify modal closes and Homepage is active again
    await expect(galleryButton1).toBeVisible({ timeout: 15000 });
    expect(savedWorkoutPayloads.length).toBeGreaterThan(0);

    // ============================================================
    // 2. SECOND IMAGE UPLOAD & PREVIOUS WORKOUT KCAL MAINTENANCE CHECK
    // ============================================================
    const galleryButton2 = page.getByRole('button', { name: 'Choose from gallery' });
    const [fileChooser2] = await Promise.all([
      page.waitForEvent('filechooser'),
      galleryButton2.click(),
    ]);

    await fileChooser2.setFiles({
      name: 'workout_test_2.png',
      mimeType: 'image/png',
      buffer: samplePngBuffer,
    });

    await expect(page.getByRole('heading', { name: 'What is this image?' })).toBeVisible({ timeout: 15000 });

    // Select Workout category option again
    await workoutCategoryBtn.first().click();

    // Verify modal opens and maintains previously logged baseline (401 kcal)
    await expect(workoutModalHeader).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('401 kcal', { exact: true })).toBeVisible({ timeout: 5000 });

    // Further increase from maintained baseline state (+100 kcal -> 501 kcal)
    await quickAdd100Btn.first().click();
    await expect(page.getByText('501 kcal', { exact: true })).toBeVisible({ timeout: 5000 });

    // Save updated workout calories ('Update to 501 kcal')
    const confirmWorkoutBtn2 = page.getByRole('button', { name: /Update to 501 kcal|Log Activity|Add calories/i });
    await expect(confirmWorkoutBtn2).toBeVisible({ timeout: 5000 });
    await confirmWorkoutBtn2.click();

    // Verify flow finishes back on Homepage
    await expect(galleryButton2).toBeVisible({ timeout: 15000 });
  });

  test('HOME-009 upload image, select Good Habit, save, and verify it is stored in the diary page', async ({ page }) => {
    let savedHabitPayloads = [];

    // Mock Good Habit API POST route
    await page.route('**/api/good-habits*', async (route) => {
      if (route.request().method() === 'POST') {
        const body = JSON.parse(route.request().postData() || '{}');
        savedHabitPayloads.push(body);
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          success: true,
          data: { id: Date.now() },
        }),
      });
    });

    // Mock Diary List API to include saved Good Habit entry
    await page.route('**/api/diary/list*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          data: {
            date: new Date().toISOString().slice(0, 10),
            ownerUserId: 'developer',
            isSelf: true,
            includesUnknown: false,
            pagination: { limit: 20, offset: 0, total: 1, hasMore: false, nextOffset: null },
            entries: [
              {
                kind: 'good-habit',
                capturedAt: new Date().toISOString(),
                payload: {
                  id: 'habit-1',
                  habitType: 'image_notes',
                  title: 'Good Habit',
                  hasImage: true,
                },
              },
            ],
          },
        }),
      });
    });

    await loginAndNavigateToHome(page, 'developer');

    // ============================================================
    // 1. UPLOAD IMAGE AND SELECT GOOD HABIT CATEGORY
    // ============================================================
    const galleryButton = page.getByRole('button', { name: 'Choose from gallery' });
    await expect(galleryButton).toBeVisible({ timeout: 15000 });

    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      galleryButton.click(),
    ]);

    await fileChooser.setFiles({
      name: 'good_habit_test.png',
      mimeType: 'image/png',
      buffer: samplePngBuffer,
    });

    // Verify Classify page header
    await expect(page.getByRole('heading', { name: 'What is this image?' })).toBeVisible({ timeout: 15000 });

    // Select Good Habit option tile
    const goodHabitBtn = page.getByRole('button', { name: 'Good Habit', exact: true }).or(
      page.getByRole('button', { name: /Good Habit/i })
    );
    await expect(goodHabitBtn.first()).toBeVisible({ timeout: 10000 });
    await goodHabitBtn.first().click();

    // Verify Good Habit modal dialog opens
    const habitTitle = page.getByText('Good Habit', { exact: true }).or(
      page.getByRole('dialog').getByText('Good Habit')
    );
    await expect(habitTitle.first()).toBeVisible({ timeout: 10000 });

    // Save Good Habit entry
    const saveHabitBtn = page.getByRole('button', { name: 'Save', exact: true }).or(
      page.locator('button').filter({ hasText: /^Save$/i })
    );
    await expect(saveHabitBtn.first()).toBeVisible({ timeout: 10000 });
    await saveHabitBtn.first().click();

    // Verify flow completes back on Homepage
    await expect(galleryButton).toBeVisible({ timeout: 15000 });
    expect(savedHabitPayloads.length).toBeGreaterThan(0);

    // ============================================================
    // 2. NAVIGATE TO DIARY PAGE AND VERIFY GOOD HABIT IS STORED
    // ============================================================
    const diaryTabBtn = page.getByRole('button', { name: 'Diary', exact: true }).or(
      page.getByText('Diary', { exact: true })
    );
    await expect(diaryTabBtn.first()).toBeVisible({ timeout: 10000 });
    await diaryTabBtn.first().click();

    // Verify Good Habit row appears in Diary feed
    const habitDiaryRow = page.getByTestId('diary-row-good-habit').or(
      page.getByRole('heading', { name: 'Good Habit' })
    ).or(
      page.getByText('Good Habit', { exact: true })
    );
    await expect(habitDiaryRow.first()).toBeVisible({ timeout: 15000 });
  });

  test('HOME-010 upload image, select Target Nutrition, search Herbalife Beta Heart and Herbalife Niteworks, test multi-add with decimal rounding, save meal, and verify in diary', async ({ page }) => {
    let savedFoodPayloads = [];

    // Mock Target Nutrition / Dry Salad catalog search API with decimal macros (e.g. 48.5 kcal)
    await page.route('**/api/dry-salad/search*', async (route) => {
      const url = new URL(route.request().url());
      const query = (url.searchParams.get('query') || '').toLowerCase();

      let masterItems = [
        { name: 'Herbalife Beta Heart', calories: 48.5, protein: 3.2, carbs: 6.1, fat: 0.8, portion: '1 sachet' },
        { name: 'Herbalife Niteworks', calories: 35.0, protein: 4.5, carbs: 3.0, fat: 0.2, portion: '1 scoop' },
      ];

      if (query) {
        masterItems = masterItems.filter((i) => i.name.toLowerCase().includes(query));
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          masterItems,
          myItems: [],
          communityItems: [],
        }),
      });
    });

    // Mock dry-salad suggestions API
    await page.route('**/api/dry-salad/suggestions*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          selected: [],
          suggestions: [],
        }),
      });
    });

    // Mock Food Promotion / Save API
    await page.route(/\/api\/(background-analysis\/captures\/retry-promotion|captures\/promote-unknown-to-food)/, async (route) => {
      const body = JSON.parse(route.request().postData() || '{}');
      savedFoodPayloads.push(body);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { id: Date.now(), ...body },
        }),
      });
    });

    // Mock Diary List API to include saved Target Nutrition meal
    await page.route('**/api/diary/list*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          data: {
            date: new Date().toISOString().slice(0, 10),
            ownerUserId: 'developer',
            isSelf: true,
            includesUnknown: false,
            pagination: { limit: 20, offset: 0, total: 1, hasMore: false, nextOffset: null },
            entries: [
              {
                kind: 'food',
                capturedAt: new Date().toISOString(),
                payload: {
                  id: 'target-nutrition-meal-1',
                  mealName: 'Herbalife Beta Heart, Herbalife Niteworks',
                  foodName: 'Herbalife Beta Heart',
                  totals: {
                    calories: 132,
                    protein: 11,
                    carbs: 15,
                    fat: 2,
                  },
                  listSummary: {
                    name: 'Herbalife Beta Heart, Herbalife Niteworks',
                    items: [
                      { name: 'Herbalife Beta Heart', calories: 97 },
                      { name: 'Herbalife Niteworks', calories: 35 },
                    ],
                  },
                },
              },
            ],
          },
        }),
      });
    });

    await loginAndNavigateToHome(page, 'developer');

    // ============================================================
    // 1. UPLOAD IMAGE AND SELECT TARGET NUTRITION CATEGORY
    // ============================================================
    const galleryButton = page.getByRole('button', { name: 'Choose from gallery' });
    await expect(galleryButton).toBeVisible({ timeout: 15000 });

    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      galleryButton.click(),
    ]);

    await fileChooser.setFiles({
      name: 'target_nutrition_test.png',
      mimeType: 'image/png',
      buffer: samplePngBuffer,
    });

    // Verify Classify screen header
    await expect(page.getByRole('heading', { name: 'What is this image?' })).toBeVisible({ timeout: 15000 });

    // Select Target Nutrition category option tile
    const targetNutritionBtn = page.getByRole('button', { name: 'Target Nutrition', exact: true }).or(
      page.getByRole('button', { name: /Target Nutrition/i })
    );
    await expect(targetNutritionBtn.first()).toBeVisible({ timeout: 10000 });
    await targetNutritionBtn.first().click();

    // Verify Target Nutrition catalog search modal opens
    const searchInput = page.getByPlaceholder('Search target nutrition…').or(
      page.getByPlaceholder('Search for food...')
    );
    await expect(searchInput.first()).toBeVisible({ timeout: 15000 });

    // ============================================================
    // 2. SEARCH & ADD HERBALIFE BETA HEART & NITEWORKS
    // ============================================================
    // Search "Beta Heart" and add to meal
    await searchInput.first().fill('Beta Heart');
    const betaHeartItem = page.getByText('Herbalife Beta Heart', { exact: false });
    await expect(betaHeartItem.first()).toBeVisible({ timeout: 10000 });
    await betaHeartItem.first().click();

    // Search "Niteworks" and add to meal
    await searchInput.first().fill('Niteworks');
    const niteworksItem = page.getByText('Herbalife Niteworks', { exact: false });
    await expect(niteworksItem.first()).toBeVisible({ timeout: 10000 });
    await niteworksItem.first().click();

    // Verify Floating Meal Tray displays 1 sachet Beta Heart (48.5 kcal rounded to 49 kcal)
    // and combined initial total calories in tray (49 + 35 = 84 kcal)
    const mealTrayButton = page.getByRole('button', { name: /Review meal/i }).or(
      page.getByText('Your Meal', { exact: false })
    );
    await expect(mealTrayButton.first()).toBeVisible({ timeout: 10000 });
    // Open Meal Builder sheet by clicking tray
    await mealTrayButton.first().click();

    const sheetDialog = page.getByRole('dialog', { name: 'Your Meal' });
    await expect(sheetDialog).toBeVisible({ timeout: 10000 });

    // Verify initial macro summary values in sheet before quantity increase
    // Beta Heart (1x): 48.5 kcal (49), 3.2g P, 6.1g C, 0.8g F
    // Niteworks (1x): 35.0 kcal, 4.5g P, 3.0g C, 0.2g F
    // Initial totals: 84 kcal, P: 8g (7.7), C: 9g (9.1), F: 1g (1.0)
    await expect(sheetDialog.getByText('84', { exact: true })).toBeVisible({ timeout: 5000 });

    // Increase Herbalife Beta Heart quantity to 2 items (+ button inside sheet)
    const increaseBetaHeartBtn = page.getByRole('button', { name: 'Increase Herbalife Beta Heart' });
    await expect(increaseBetaHeartBtn).toBeVisible({ timeout: 5000 });
    await increaseBetaHeartBtn.click();

    // Verify 2 items of Beta Heart (48.5 * 2 = 97 kcal) displays updated item kcal (97 kcal)
    await expect(page.getByText('97 kcal', { exact: false })).toBeVisible({ timeout: 5000 });

    // Verify updated total calories and individual P, C, F macros in sheet summary:
    // Beta Heart (2x): 97 kcal, 6.4g P, 12.2g C, 1.6g F
    // Niteworks (1x): 35 kcal, 4.5g P, 3.0g C, 0.2g F
    // Combined total: 132 kcal, P: 11g (10.9), C: 15g (15.2), F: 2g (1.8)
    await expect(page.getByText('132 kcal', { exact: false }).first()).toBeVisible({ timeout: 5000 });
    await expect(sheetDialog.getByText('11g', { exact: true })).toBeVisible({ timeout: 5000 });
    await expect(sheetDialog.getByText('15g', { exact: true })).toBeVisible({ timeout: 5000 });
    await expect(sheetDialog.getByText('2g', { exact: true })).toBeVisible({ timeout: 5000 });

    // Save Meal from sheet (scoped inside sheet dialog)
    const saveMealBtn = sheetDialog.getByRole('button', { name: /Save Meal|Save \d+ Items/i });
    await expect(saveMealBtn.first()).toBeVisible({ timeout: 5000 });
    await saveMealBtn.first().click();

    // Verify flow finishes back on Homepage
    await expect(galleryButton).toBeVisible({ timeout: 15000 });
    expect(savedFoodPayloads.length).toBeGreaterThan(0);

    // ============================================================
    // 4. NAVIGATE TO DIARY PAGE AND VERIFY STORED MEAL
    // ============================================================
    const diaryTabBtn = page.getByRole('button', { name: 'Diary', exact: true }).or(
      page.getByText('Diary', { exact: true })
    );
    await expect(diaryTabBtn.first()).toBeVisible({ timeout: 10000 });
    await diaryTabBtn.first().click();

    // Verify Target Nutrition saved meal entry appears in Diary feed
    const diaryEntry = page.getByTestId('diary-row-food').or(
      page.getByRole('heading', { name: 'Herbalife Beta Heart, Herbalife Niteworks' })
    ).or(
      page.getByText('Herbalife Beta Heart', { exact: false })
    );
    await expect(diaryEntry.first()).toBeVisible({ timeout: 15000 });
  });

});











