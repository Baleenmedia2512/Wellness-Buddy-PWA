import { test, expect } from '@playwright/test';

test.describe('Admin Page - Wellness Score & Activity Time Settings (ADMIN_001)', () => {
  const TEST_PHONE = '7695834209';
  const LOGIN_OTP = '1234';
  const TEST_EMAIL = 'admin@test.com';

  const ALL_WELLNESS_PARAMETERS = [
    { key: 'weight_post', label: 'Weight Post', section: 'logging', scoringMode: 'binary', maxPoints: 100, enabled: true },
    { key: 'edu_post', label: 'Education Post', section: 'logging', scoringMode: 'binary', maxPoints: 100, enabled: true },
    { key: 'breakfast_post', label: 'Breakfast Post', section: 'logging', scoringMode: 'binary', maxPoints: 100, enabled: true },
    { key: 'lunch_post', label: 'Lunch Post', section: 'logging', scoringMode: 'binary', maxPoints: 100, enabled: true },
    { key: 'dinner_post', label: 'Dinner Post', section: 'logging', scoringMode: 'binary', maxPoints: 100, enabled: true },
    { key: 'good_habit_post', label: 'Today Task Given by Coach', section: 'logging', scoringMode: 'binary', maxPoints: 100, enabled: true },
    { key: 'calories', label: 'Calories', section: 'nutrition', scoringMode: 'limit', maxPoints: 100, enabled: true },
    { key: 'carbohydrates', label: 'Carbohydrates', section: 'nutrition', scoringMode: 'limit', maxPoints: 100, enabled: true },
    { key: 'fat', label: 'Fat', section: 'nutrition', scoringMode: 'limit', maxPoints: 100, enabled: true },
    { key: 'protein', label: 'Protein', section: 'nutrition', scoringMode: 'proportional', maxPoints: 100, enabled: true },
    { key: 'sodium', label: 'Sodium', section: 'nutrition', scoringMode: 'limit', maxPoints: 100, enabled: true },
    { key: 'cholesterol', label: 'Cholesterol', section: 'nutrition', scoringMode: 'limit', maxPoints: 100, enabled: true },
    { key: 'sugar', label: 'Sugar', section: 'nutrition', scoringMode: 'limit', maxPoints: 100, enabled: true },
    { key: 'fiber', label: 'Fiber', section: 'nutrition', scoringMode: 'proportional', maxPoints: 100, enabled: true },
    { key: 'gi', label: 'GI', section: 'nutrition', scoringMode: 'limit', maxPoints: 100, enabled: true },
    { key: 'vitamin_a', label: 'Vitamin A', section: 'nutrition', scoringMode: 'proportional', maxPoints: 100, enabled: true },
    { key: 'vitamin_c', label: 'Vitamin C', section: 'nutrition', scoringMode: 'proportional', maxPoints: 100, enabled: true },
    { key: 'vitamin_d', label: 'Vitamin D', section: 'nutrition', scoringMode: 'proportional', maxPoints: 100, enabled: true },
    { key: 'vitamin_e', label: 'Vitamin E', section: 'nutrition', scoringMode: 'proportional', maxPoints: 100, enabled: true },
    { key: 'vitamin_k', label: 'Vitamin K', section: 'nutrition', scoringMode: 'proportional', maxPoints: 100, enabled: true },
    { key: 'vitamin_b1', label: 'Vitamin B1', section: 'nutrition', scoringMode: 'proportional', maxPoints: 100, enabled: true },
    { key: 'vitamin_b2', label: 'Vitamin B2', section: 'nutrition', scoringMode: 'proportional', maxPoints: 100, enabled: true },
    { key: 'vitamin_b3', label: 'Vitamin B3', section: 'nutrition', scoringMode: 'proportional', maxPoints: 100, enabled: true },
    { key: 'vitamin_b6', label: 'Vitamin B6', section: 'nutrition', scoringMode: 'proportional', maxPoints: 100, enabled: true },
    { key: 'vitamin_b9', label: 'Vitamin B9', section: 'nutrition', scoringMode: 'proportional', maxPoints: 100, enabled: true },
    { key: 'vitamin_b12', label: 'Vitamin B12', section: 'nutrition', scoringMode: 'proportional', maxPoints: 100, enabled: true },
    { key: 'calcium', label: 'Calcium', section: 'nutrition', scoringMode: 'proportional', maxPoints: 100, enabled: true },
    { key: 'iron', label: 'Iron', section: 'nutrition', scoringMode: 'proportional', maxPoints: 100, enabled: true },
    { key: 'magnesium', label: 'Magnesium', section: 'nutrition', scoringMode: 'proportional', maxPoints: 100, enabled: true },
    { key: 'potassium', label: 'Potassium', section: 'nutrition', scoringMode: 'proportional', maxPoints: 100, enabled: true },
    { key: 'zinc', label: 'Zinc', section: 'nutrition', scoringMode: 'proportional', maxPoints: 100, enabled: true },
    { key: 'phosphorus', label: 'Phosphorus', section: 'nutrition', scoringMode: 'proportional', maxPoints: 100, enabled: true },
    { key: 'weight_improvement', label: 'Weight Improvement', section: 'progress', scoringMode: 'progress', maxPoints: 100, enabled: true },
    { key: 'water_qty', label: 'Water Quantity', section: 'progress', scoringMode: 'proportional', maxPoints: 100, enabled: true },
    { key: 'physical_activity', label: 'Physical Activity', section: 'progress', scoringMode: 'proportional', maxPoints: 100, enabled: true },
  ];

  async function dismissPermissionModalIfPresent(page) {
    try {
      const permissionPrimerBtn = page.getByRole('button', { name: /Allow Permissions|Continue|Allow|Got it|OK/i });
      if (await permissionPrimerBtn.isVisible({ timeout: 2000 })) {
        await permissionPrimerBtn.click({ force: true });
      }
    } catch {
      // Permission modal was not shown; proceed
    }
  }

  async function setupMocks(page, role = 'admin') {
    await page.context().grantPermissions(['geolocation', 'camera', 'microphone']).catch(() => {});
    await page.context().setGeolocation({ latitude: 12.9716, longitude: 77.5946 }).catch(() => {});

    // Ensure feature flags for wellness score sheet, AI credits & page access are active
    await page.addInitScript(() => {
      localStorage.setItem('ff.wellness-score-sheet', 'true');
      localStorage.setItem('ff.ai-credits', 'true');
      localStorage.setItem('ff.nav-page-access', 'true');
    });

    // 1. Auth & Verification mocks
    await page.route('**/api/auth/send-otp', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });

    await page.route('**/api/auth/verify-otp', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          isNewUser: false,
          user: {
            id: 9999,
            UserId: 9999,
            username: 'adminuser',
            userName: 'Admin User',
            name: 'Admin User',
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

    await page.route('**/api/user/lookup*', async (route) => {
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

    await page.route('**/api/user/consent*', async (route) => {
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

    await page.route('**/api/user/profile*', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              userId: 9999,
              userName: 'Admin User',
              email: TEST_EMAIL,
              role: role,
              userRole: role,
              height: 175,
              dietType: 'Non-Vegetarian',
              gender: 'Male',
              currentWeight: 70,
              bodyFat: 15,
              profileComplete: true,
              needsName: false,
              profileImage: 'https://example.com/profile.jpg',
              physicalActivityLevel: 'moderate',
              transformationPhotos: {
                left: 'http://example.com/l.jpg',
                front: 'http://example.com/f.jpg',
                center: 'http://example.com/f.jpg',
                right: 'http://example.com/r.jpg',
              },
            },
          }),
        });
        return;
      }
      await route.continue();
    });

    await page.route('**/api/user/status*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          setupSkipped: true,
          setupComplete: true,
          pendingRequest: false,
          role: role,
        }),
      });
    });

    await page.route('**/api/user/verify-session*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          userId: 9999,
          user: {
            id: 9999,
            UserId: 9999,
            userName: 'Admin User',
            phone: `+91${TEST_PHONE}`,
            role: role,
            email: TEST_EMAIL,
          },
        }),
      });
    });

    // 2. Leaderboard mocks
    await page.route('**/api/leaderboard/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [] }),
      });
    });

    // 3. Time Windows mock
    await page.route('**/api/misc/time-windows*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          windows: {
            weight: { start: '05:00:00', end: '09:00:00' },
            education: { start: '05:00:00', end: '23:59:00' },
            breakfast: { start: '05:30:00', end: '08:30:00' },
            lunch: { start: '12:00:00', end: '16:00:00' },
            dinner: { start: '17:30:00', end: '20:30:00' },
          },
        }),
      });
    });

    // 4. Admin Config Mock (GET & PUT)
    let currentAdminConfig = ALL_WELLNESS_PARAMETERS.map((param) => ({ ...param }));

    await page.route('**/api/wellness-score/admin-config*', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            parameters: currentAdminConfig,
          }),
        });
      } else if (route.request().method() === 'PUT') {
        const postData = route.request().postDataJSON();
        if (postData?.parameters) {
          currentAdminConfig = postData.parameters;
        }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            parameters: currentAdminConfig,
          }),
        });
      } else {
        await route.continue();
      }
    });

    // 5. Daily Wellness Score Mock
    await page.route('**/api/wellness-score/daily*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          score: {
            earnedPoints: 2000,
            possiblePoints: 3500,
            percentage: 57.14,
          },
        }),
      });
    });

    // 6. AI Credits Admin Config Mock (GET & PUT)
    let currentAiCreditsConfig = {
      dailyAiCredits: 10,
      aiModeEnabled: true,
      availabilityWindows: {
        breakfast: { enabled: true, start: '05:30:00', end: '08:30:00' },
        lunch: { enabled: true, start: '12:00:00', end: '16:00:00' },
        dinner: { enabled: true, start: '17:30:00', end: '20:30:00' },
      },
    };

    await page.route('**/api/ai-credits/admin-config*', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: currentAiCreditsConfig,
          }),
        });
      } else if (route.request().method() === 'PUT') {
        const postData = route.request().postDataJSON();
        currentAiCreditsConfig = {
          ...currentAiCreditsConfig,
          ...postData,
        };
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: currentAiCreditsConfig,
          }),
        });
      } else {
        await route.continue();
      }
    });

    // 7. Nav Page Access Mocks
    await page.route('**/api/nav-access/for-me*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          pages: {
            home: true,
            dashboard: true,
            'activity-report': true,
            enrollment: true,
            counselling: true,
            'physical-club': true,
            testimonials: true,
            reports: true,
          },
          accountRole: role,
        }),
      });
    });

    let currentNavAccessMatrix = {
      user: { home: true, dashboard: true, 'activity-report': true, enrollment: true, counselling: true, 'physical-club': true, testimonials: true, reports: true },
      coach: { home: true, dashboard: true, 'activity-report': true, enrollment: true, counselling: true, 'physical-club': true, testimonials: true, reports: true },
      admin: { home: true, dashboard: true, 'activity-report': true, enrollment: true, counselling: true, 'physical-club': true, testimonials: true, reports: true },
      developer: { home: true, dashboard: true, 'activity-report': true, enrollment: true, counselling: true, 'physical-club': true, testimonials: true, reports: true },
    };

    await page.route('**/api/nav-access/admin-config*', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            matrix: currentNavAccessMatrix,
          }),
        });
      } else if (route.request().method() === 'PUT') {
        const postData = route.request().postDataJSON();
        if (postData?.matrix) {
          currentNavAccessMatrix = postData.matrix;
        }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            matrix: currentNavAccessMatrix,
          }),
        });
      } else {
        await route.continue();
      }
    });
  }

  async function performAdminLogin(page) {
    await page.goto('/');

    const mobileInput = page.getByLabel('Mobile Number');
    await expect(mobileInput).toBeVisible({ timeout: 15000 });
    await mobileInput.fill(TEST_PHONE);

    const sendOtpButton = page.getByRole('button', { name: 'Send OTP' });
    await sendOtpButton.click();

    await expect(page.getByText('Enter OTP', { exact: true })).toBeVisible({ timeout: 15000 });

    const otpInputs = page.locator('input[data-otp="true"]');
    await expect(otpInputs).toHaveCount(4);

    for (let i = 0; i < LOGIN_OTP.length; i++) {
      await otpInputs.nth(i).fill(LOGIN_OTP[i]);
    }

    await dismissPermissionModalIfPresent(page);

    // Wait for home page to be visible
    const homeIndicator = page.getByText('Tracking Wellness with Ease', { exact: false })
      .or(page.getByTestId('wellness-score-home-tile'));
    await expect(homeIndicator.first()).toBeVisible({ timeout: 20000 });
  }

  test('admin-001: admin logs in, clicks Settings option on home page, and toggles each wellness score component modifying total points', async ({ page }) => {
    // 1. Setup route mocks for admin user
    await setupMocks(page, 'admin');

    // 2. Perform Admin Login
    await performAdminLogin(page);

    // 3. Click Settings option on the Home page (Settings icon on Wellness Score card tile)
    const settingsButton = page.getByTestId('wellness-score-setup-button');
    await expect(settingsButton).toBeVisible({ timeout: 10000 });
    await settingsButton.click({ force: true });

    // 4. Verify navigation to Wellness Score Setup (within Admin Config Setup)
    await expect(page.getByText('Admin Config Setup', { exact: false }).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Total daily capacity', { exact: false })).toBeVisible({ timeout: 10000 });

    // Initial total daily capacity points banner (35 active parameters * 100 maxPoints = 3,500 pts)
    const totalPointsDisplay = page.locator('p.text-3xl.font-bold');
    await expect(totalPointsDisplay).toContainText('3,500');

    let currentTotalPoints = 3500;

    // 5. Iterate through EACH wellness score parameter option
    for (const param of ALL_WELLNESS_PARAMETERS) {
      const paramRow = page.getByTestId(`wellness-setup-${param.key}`);
      await expect(paramRow).toBeVisible();

      const toggleSwitch = paramRow.getByRole('switch');
      await expect(toggleSwitch).toHaveAttribute('aria-checked', 'true');

      // A) Disable component -> total points must decrease by maxPoints (100)
      await toggleSwitch.click();
      await expect(toggleSwitch).toHaveAttribute('aria-checked', 'false');

      const expectedAfterDisable = currentTotalPoints - param.maxPoints;
      await expect(totalPointsDisplay).toContainText(expectedAfterDisable.toLocaleString());

      // B) Re-enable component -> total points must increase back by maxPoints (100)
      await toggleSwitch.click();
      await expect(toggleSwitch).toHaveAttribute('aria-checked', 'true');

      await expect(totalPointsDisplay).toContainText(currentTotalPoints.toLocaleString());
    }

    // 6. Save configuration and verify save status feedback
    const saveButton = page.getByRole('button', { name: /Save configuration|Saved/i });
    await expect(saveButton).toBeVisible();
    await saveButton.click();

    // Verify save feedback appears
    await expect(page.getByRole('button', { name: 'Saved' })).toBeVisible({ timeout: 5000 });
  });

  test('admin-002: in admin config setup, each activity_time option can be editable and savable', async ({ page }) => {
    // 1. Setup route mocks for admin user
    await setupMocks(page, 'admin');

    let initialTimeWindows = [
      { ActivityType: 'weight', WindowStartTime: '05:00:00', WindowEndTime: '09:00:00', isDefault: false },
      { ActivityType: 'education', WindowStartTime: '05:00:00', WindowEndTime: '23:59:00', isDefault: false },
      { ActivityType: 'breakfast', WindowStartTime: '05:30:00', WindowEndTime: '08:30:00', isDefault: false },
      { ActivityType: 'lunch', WindowStartTime: '12:00:00', WindowEndTime: '16:00:00', isDefault: false },
      { ActivityType: 'dinner', WindowStartTime: '17:30:00', WindowEndTime: '20:30:00', isDefault: false },
    ];

    const savedTimeWindowRequests = [];

    await page.route('**/api/admin/time-windows*', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            timeWindows: initialTimeWindows,
          }),
        });
      } else if (route.request().method() === 'POST') {
        const postData = route.request().postDataJSON();
        savedTimeWindowRequests.push(postData);

        initialTimeWindows = initialTimeWindows.map((tw) =>
          tw.ActivityType === postData.activityType
            ? {
                ...tw,
                WindowStartTime: `${postData.windowStartTime}:00`,
                WindowEndTime: `${postData.windowEndTime}:00`,
                LastUpdated: new Date().toISOString(),
              }
            : tw
        );

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            message: 'Time window updated successfully',
            timeWindow: {
              activityType: postData.activityType,
              windowStartTime: `${postData.windowStartTime}:00`,
              windowEndTime: `${postData.windowEndTime}:00`,
            },
          }),
        });
      } else {
        await route.continue();
      }
    });

    // 2. Perform Admin Login
    await performAdminLogin(page);

    // 3. Click Settings option on Home page
    const settingsButton = page.getByTestId('wellness-score-setup-button');
    await expect(settingsButton).toBeVisible({ timeout: 10000 });
    await settingsButton.click({ force: true });

    await expect(page.getByText('Admin Config Setup', { exact: false }).first()).toBeVisible({ timeout: 10000 });

    // 4. Switch to "Activity Time Setup" tab
    const activityTab = page.locator('#admin-config-tab-activity-time');
    await expect(activityTab).toBeVisible({ timeout: 10000 });
    await activityTab.click();

    await expect(page.getByText('Configure activity start and end times', { exact: false })).toBeVisible({ timeout: 10000 });

    // 5. Test editing each activity time window option (Weight, Education, Breakfast, Lunch, Dinner)
    const activitiesToTest = [
      { type: 'weight', name: 'Weight' },
      { type: 'education', name: 'Education' },
      { type: 'breakfast', name: 'Breakfast' },
      { type: 'lunch', name: 'Lunch' },
      { type: 'dinner', name: 'Dinner' },
    ];

    for (const activity of activitiesToTest) {
      // Find and click the activity card
      const card = page.getByRole('button', { name: new RegExp(`Edit ${activity.name} time window`, 'i') })
        .or(page.getByText(activity.name, { exact: true }));
      await expect(card.first()).toBeVisible();
      await card.first().click();

      // Enter optional reason note
      const reasonInput = page.getByPlaceholder('Optional note...');
      await expect(reasonInput).toBeVisible();
      await reasonInput.fill(`Updated ${activity.name} time window note`);

      // Click "Save Changes"
      const saveChangesBtn = page.getByRole('button', { name: 'Save Changes' });
      await expect(saveChangesBtn).toBeVisible();
      await saveChangesBtn.click();

      // Verify success message
      await expect(page.getByText('Activity time windows updated successfully', { exact: false })).toBeVisible({ timeout: 5000 });
    }

    // Verify all 5 activity time window save requests were sent and recorded
    expect(savedTimeWindowRequests.length).toBe(5);
  });

  test('admin-003: in admin config setup, AI config can be enabled/disabled, credits incremented/decremented, and breakfast, lunch, and dinner timings set', async ({ page }) => {
    // 1. Setup route mocks for admin user
    await setupMocks(page, 'admin');

    let currentAiCreditsConfig = {
      dailyAiCredits: 10,
      aiModeEnabled: true,
      availabilityWindows: {
        breakfast: { enabled: true, start: '05:30:00', end: '08:30:00' },
        lunch: { enabled: true, start: '12:00:00', end: '16:00:00' },
        dinner: { enabled: true, start: '17:30:00', end: '20:30:00' },
      },
    };

    let savedAiConfigPayload = null;

    await page.route('**/api/ai-credits/admin-config*', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: currentAiCreditsConfig,
          }),
        });
      } else if (route.request().method() === 'PUT') {
        savedAiConfigPayload = route.request().postDataJSON();
        currentAiCreditsConfig = {
          ...currentAiCreditsConfig,
          ...savedAiConfigPayload,
        };
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: currentAiCreditsConfig,
          }),
        });
      } else {
        await route.continue();
      }
    });

    // 2. Perform Admin Login
    await performAdminLogin(page);

    // 3. Navigate to Admin Config Setup
    const settingsButton = page.getByTestId('wellness-score-setup-button');
    await expect(settingsButton).toBeVisible({ timeout: 10000 });
    await settingsButton.click({ force: true });

    await expect(page.getByText('Admin Config Setup', { exact: false }).first()).toBeVisible({ timeout: 10000 });

    // 4. Switch to "AI Configuration Setup" tab
    const aiTab = page.locator('#admin-config-tab-ai-config');
    await expect(aiTab).toBeVisible({ timeout: 10000 });
    await aiTab.click();

    await expect(page.getByText('AI Mode enabled', { exact: false })).toBeVisible({ timeout: 10000 });

    // 5. Test AI Mode Enable / Disable toggle
    const aiModeToggle = page.getByRole('switch', { name: /Disable AI Mode|Enable AI Mode/i });
    await expect(aiModeToggle).toHaveAttribute('aria-checked', 'true');

    // Disable AI Mode
    await aiModeToggle.click();
    await expect(aiModeToggle).toHaveAttribute('aria-checked', 'false');

    // Re-enable AI Mode
    await aiModeToggle.click();
    await expect(aiModeToggle).toHaveAttribute('aria-checked', 'true');

    // 6. Test Daily AI Credits Increment and Decrement
    const increaseCreditsBtn = page.getByRole('button', { name: 'Increase daily AI credits' });
    const decreaseCreditsBtn = page.getByRole('button', { name: 'Decrease daily AI credits' });
    const creditsValueDisplay = page.locator('span[aria-label$="daily AI credits"]');

    await expect(creditsValueDisplay).toHaveText('10');

    // Increment credits twice (10 -> 11 -> 12)
    await increaseCreditsBtn.click();
    await expect(creditsValueDisplay).toHaveText('11');
    await increaseCreditsBtn.click();
    await expect(creditsValueDisplay).toHaveText('12');

    // Decrement credits once (12 -> 11)
    await decreaseCreditsBtn.click();
    await expect(creditsValueDisplay).toHaveText('11');

    // 7. Test Breakfast, Lunch, and Dinner Timings & Availability
    const mealTabList = page.getByRole('tablist', { name: 'Meal availability' });
    await expect(mealTabList).toBeVisible();

    // A) Breakfast timing setup
    const breakfastTabBtn = page.getByRole('tab', { name: /Breakfast/i });
    await breakfastTabBtn.click();
    const breakfastInputs = page.locator('input[type="time"]');
    await breakfastInputs.nth(0).fill('06:00');
    await breakfastInputs.nth(1).fill('09:00');

    // B) Lunch timing setup
    const lunchTabBtn = page.getByRole('tab', { name: /Lunch/i });
    await lunchTabBtn.click();
    const lunchInputs = page.locator('input[type="time"]');
    await lunchInputs.nth(0).fill('12:30');
    await lunchInputs.nth(1).fill('15:30');

    // C) Dinner timing setup
    const dinnerTabBtn = page.getByRole('tab', { name: /Dinner/i });
    await dinnerTabBtn.click();
    const dinnerInputs = page.locator('input[type="time"]');
    await dinnerInputs.nth(0).fill('18:00');
    await dinnerInputs.nth(1).fill('21:00');

    // 8. Save AI Configuration
    const saveAiBtn = page.getByRole('button', { name: /Save|Saved!/i }).first();
    await expect(saveAiBtn).toBeVisible();
    await saveAiBtn.click();

    // 9. Verify save status notification feedback
    await expect(page.getByText('AI settings updated', { exact: false }).first()).toBeVisible({ timeout: 5000 });

    // Assert that captured PUT payload accurately includes all updated settings
    expect(savedAiConfigPayload).not.toBeNull();
    expect(savedAiConfigPayload.aiModeEnabled).toBe(true);
    expect(savedAiConfigPayload.dailyAiCredits).toBe(11);
    expect(savedAiConfigPayload.availabilityWindows.breakfast.start).toBe('06:00:00');
    expect(savedAiConfigPayload.availabilityWindows.breakfast.end).toBe('09:00:00');
    expect(savedAiConfigPayload.availabilityWindows.lunch.start).toBe('12:30:00');
    expect(savedAiConfigPayload.availabilityWindows.lunch.end).toBe('15:30:00');
    expect(savedAiConfigPayload.availabilityWindows.dinner.start).toBe('18:00:00');
    expect(savedAiConfigPayload.availabilityWindows.dinner.end).toBe('21:00:00');
  });

  test('admin-004: in page access, all checkboxes can be selected and unselected successfully', async ({ page }) => {
    // 1. Setup route mocks for admin user
    await setupMocks(page, 'admin');

    let savedNavAccessMatrix = null;

    await page.route('**/api/nav-access/admin-config*', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            matrix: {
              user: { home: true, dashboard: true, 'activity-report': true, enrollment: true, counselling: true, 'physical-club': true, testimonials: true, reports: true },
              coach: { home: true, dashboard: true, 'activity-report': true, enrollment: true, counselling: true, 'physical-club': true, testimonials: true, reports: true },
              admin: { home: true, dashboard: true, 'activity-report': true, enrollment: true, counselling: true, 'physical-club': true, testimonials: true, reports: true },
              developer: { home: true, dashboard: true, 'activity-report': true, enrollment: true, counselling: true, 'physical-club': true, testimonials: true, reports: true },
            },
          }),
        });
      } else if (route.request().method() === 'PUT') {
        const postData = route.request().postDataJSON();
        savedNavAccessMatrix = postData?.matrix || null;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            matrix: savedNavAccessMatrix,
          }),
        });
      } else {
        await route.continue();
      }
    });

    // 2. Perform Admin Login
    await performAdminLogin(page);

    // 3. Navigate to Admin Config Setup
    const settingsButton = page.getByTestId('wellness-score-setup-button');
    await expect(settingsButton).toBeVisible({ timeout: 10000 });
    await settingsButton.click({ force: true });

    await expect(page.getByText('Admin Config Setup', { exact: false }).first()).toBeVisible({ timeout: 10000 });

    // 4. Switch to "Page Access" tab
    const pageAccessTab = page.locator('#admin-config-tab-page-access');
    await expect(pageAccessTab).toBeVisible({ timeout: 10000 });
    await pageAccessTab.click();

    await expect(page.getByText('Toggle main nav tabs per role', { exact: false })).toBeVisible({ timeout: 10000 });
    await expect(page.locator('table')).toBeVisible({ timeout: 10000 });

    // 5. Verify all checkboxes can be unselected and selected successfully
    const checkboxes = page.locator('table input[type="checkbox"]');
    await expect(checkboxes.first()).toBeVisible({ timeout: 10000 });

    const checkboxCount = await checkboxes.count();
    expect(checkboxCount).toBe(32); // 4 roles * 8 pages

    for (let i = 0; i < checkboxCount; i++) {
      const checkbox = checkboxes.nth(i);

      if (await checkbox.isChecked()) {
        // Unselect checkbox
        await checkbox.uncheck({ force: true });
        await expect(checkbox).not.toBeChecked();

        // Select checkbox back
        await checkbox.check({ force: true });
        await expect(checkbox).toBeChecked();
      } else {
        // Select checkbox
        await checkbox.check({ force: true });
        await expect(checkbox).toBeChecked();

        // Unselect checkbox back
        await checkbox.uncheck({ force: true });
        await expect(checkbox).not.toBeChecked();
      }
    }

    // 6. Modify a checkbox state and save configuration
    const firstCheckbox = checkboxes.first();
    await firstCheckbox.uncheck({ force: true });
    await expect(firstCheckbox).not.toBeChecked();

    const saveAccessBtn = page.getByRole('button', { name: /Save access|Saved/i });
    await expect(saveAccessBtn).toBeVisible();
    await saveAccessBtn.click();

    // Verify save feedback appears
    await expect(page.getByRole('button', { name: 'Saved' })).toBeVisible({ timeout: 5000 });
    expect(savedNavAccessMatrix).not.toBeNull();
  });
});

