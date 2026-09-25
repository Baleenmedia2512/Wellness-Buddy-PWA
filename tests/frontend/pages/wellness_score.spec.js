import { test, expect } from '@playwright/test';

test.describe('Wellness Score - Time-Based Parameters (SCORE_01)', () => {
  const TEST_PHONE = '7695834209';
  const LOGIN_OTP = '1234';
  const TEST_EMAIL = 'existing@test.com';
  const TEST_USER_ID = 1004;

  const ALL_WELLNESS_PARAMETERS = [
    // Activity / Logging Section (6)
    { key: 'weight_post', label: 'Weight Post', section: 'logging', scoringMode: 'binary', maxPoints: 100 },
    { key: 'edu_post', label: 'Education Post', section: 'logging', scoringMode: 'binary', maxPoints: 100 },
    { key: 'breakfast_post', label: 'Breakfast Post', section: 'logging', scoringMode: 'binary', maxPoints: 100 },
    { key: 'lunch_post', label: 'Lunch Post', section: 'logging', scoringMode: 'binary', maxPoints: 100 },
    { key: 'dinner_post', label: 'Dinner Post', section: 'logging', scoringMode: 'binary', maxPoints: 100 },
    { key: 'good_habit_post', label: 'Today Task Given by Coach', section: 'logging', scoringMode: 'binary', maxPoints: 100 },
    // Nutrition Section (26)
    { key: 'calories', label: 'Calories', section: 'nutrition', scoringMode: 'limit', maxPoints: 100 },
    { key: 'carbohydrates', label: 'Carbohydrates', section: 'nutrition', scoringMode: 'limit', maxPoints: 100 },
    { key: 'fat', label: 'Fat', section: 'nutrition', scoringMode: 'limit', maxPoints: 100 },
    { key: 'protein', label: 'Protein', section: 'nutrition', scoringMode: 'proportional', maxPoints: 100 },
    { key: 'sodium', label: 'Sodium', section: 'nutrition', scoringMode: 'limit', maxPoints: 100 },
    { key: 'cholesterol', label: 'Cholesterol', section: 'nutrition', scoringMode: 'limit', maxPoints: 100 },
    { key: 'sugar', label: 'Sugar', section: 'nutrition', scoringMode: 'limit', maxPoints: 100 },
    { key: 'fiber', label: 'Fiber', section: 'nutrition', scoringMode: 'proportional', maxPoints: 100 },
    { key: 'gi', label: 'GI', section: 'nutrition', scoringMode: 'limit', maxPoints: 100 },
    { key: 'vitamin_a', label: 'Vitamin A', section: 'nutrition', scoringMode: 'proportional', maxPoints: 100 },
    { key: 'vitamin_c', label: 'Vitamin C', section: 'nutrition', scoringMode: 'proportional', maxPoints: 100 },
    { key: 'vitamin_d', label: 'Vitamin D', section: 'nutrition', scoringMode: 'proportional', maxPoints: 100 },
    { key: 'vitamin_e', label: 'Vitamin E', section: 'nutrition', scoringMode: 'proportional', maxPoints: 100 },
    { key: 'vitamin_k', label: 'Vitamin K', section: 'nutrition', scoringMode: 'proportional', maxPoints: 100 },
    { key: 'vitamin_b1', label: 'Vitamin B1', section: 'nutrition', scoringMode: 'proportional', maxPoints: 100 },
    { key: 'vitamin_b2', label: 'Vitamin B2', section: 'nutrition', scoringMode: 'proportional', maxPoints: 100 },
    { key: 'vitamin_b3', label: 'Vitamin B3', section: 'nutrition', scoringMode: 'proportional', maxPoints: 100 },
    { key: 'vitamin_b6', label: 'Vitamin B6', section: 'nutrition', scoringMode: 'proportional', maxPoints: 100 },
    { key: 'vitamin_b9', label: 'Vitamin B9', section: 'nutrition', scoringMode: 'proportional', maxPoints: 100 },
    { key: 'vitamin_b12', label: 'Vitamin B12', section: 'nutrition', scoringMode: 'proportional', maxPoints: 100 },
    { key: 'calcium', label: 'Calcium', section: 'nutrition', scoringMode: 'proportional', maxPoints: 100 },
    { key: 'iron', label: 'Iron', section: 'nutrition', scoringMode: 'proportional', maxPoints: 100 },
    { key: 'magnesium', label: 'Magnesium', section: 'nutrition', scoringMode: 'proportional', maxPoints: 100 },
    { key: 'potassium', label: 'Potassium', section: 'nutrition', scoringMode: 'proportional', maxPoints: 100 },
    { key: 'zinc', label: 'Zinc', section: 'nutrition', scoringMode: 'proportional', maxPoints: 100 },
    { key: 'phosphorus', label: 'Phosphorus', section: 'nutrition', scoringMode: 'proportional', maxPoints: 100 },
    // Progress Section (3)
    { key: 'weight_improvement', label: 'Weight Improvement', section: 'progress', scoringMode: 'progress', maxPoints: 100 },
    { key: 'water_qty', label: 'Water Quantity', section: 'progress', scoringMode: 'proportional', maxPoints: 100 },
    { key: 'physical_activity', label: 'Physical Activity', section: 'progress', scoringMode: 'proportional', maxPoints: 100 },
  ];

  /**
   * Set up route mocks for auth, user status, profile, time windows, and wellness score API.
   * Evaluates time-based parameters based on whether user action was performed within the time window.
   */
  async function setupMocks(page, { timeWindows, scoreOverrides }) {
    await page.addInitScript(() => {
      localStorage.setItem('ff.wellness-score-sheet', 'true');
    });

    // 1. Auth & Lookup routes
    await page.route('**/api/auth/send-otp', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
    });

    await page.route('**/api/auth/verify-otp', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          isNewUser: false,
          user: {
            id: TEST_USER_ID,
            UserId: TEST_USER_ID,
            userId: TEST_USER_ID,
            username: 'existinguser',
            userName: 'Nitheesh Lingam',
            name: 'Nitheesh Lingam',
            email: TEST_EMAIL,
            phone: `+91${TEST_PHONE}`,
            status: 'Active',
            isNewUser: false,
            consentRequired: false,
          },
        }),
      });
    });

    await page.route('**/api/user/verify-session*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          userId: TEST_USER_ID,
          user: {
            id: TEST_USER_ID,
            UserId: TEST_USER_ID,
            userName: 'Nitheesh Lingam',
            phone: `+91${TEST_PHONE}`,
            role: 'user',
            email: TEST_EMAIL,
          },
        }),
      });
    });

    await page.route('**/api/user/lookup*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, isNewUser: false, isActive: true, role: 'user' }) });
    });

    await page.route('**/api/user/consent*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, consentRequired: false, consentAccepted: true }) });
    });

    await page.route('**/api/user/profile*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            userId: TEST_USER_ID,
            userName: 'Nitheesh Lingam',
            email: TEST_EMAIL,
            phoneNumber: TEST_PHONE,
            gender: 'Male',
            height: 170,
            dietType: 'Non-Vegetarian',
            bodyFat: 20,
            latestWeight: 75.0,
            profileComplete: true,
            transformationPhotos: {
              left: 'http://example.com/left.jpg',
              front: 'http://example.com/front.jpg',
              center: 'http://example.com/center.jpg',
              right: 'http://example.com/right.jpg',
            },
          },
        }),
      });
    });

    await page.route('**/api/user/status*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, setupComplete: true, setupSkipped: true, role: 'user' }),
      });
    });

    await page.route('**/api/leaderboard/**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) });
    });

    // 2. Activity Time Windows Mock
    await page.route('**/api/misc/time-windows*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          windows: timeWindows || {
            weight: { start: '05:00:00', end: '09:00:00' },
            education: { start: '05:00:00', end: '23:59:00' },
            breakfast: { start: '05:30:00', end: '08:30:00' },
            lunch: { start: '12:00:00', end: '16:00:00' },
            dinner: { start: '17:30:00', end: '20:30:00' },
          },
        }),
      });
    });

    // 3. Daily Wellness Score API Mock
    await page.route('**/api/wellness-score/daily*', async (route) => {
      const url = new URL(route.request().url());
      const requestedDate = url.searchParams.get('date');

      const parameters = ALL_WELLNESS_PARAMETERS.map((p) => {
        const override = scoreOverrides?.[p.key];
        const earned = override !== undefined ? override : 100;
        return {
          ...p,
          earnedPoints: earned,
          calculationReason: earned === 100 ? 'Goal met' : 'Not completed within window',
        };
      });

      const totalMax = parameters.reduce((sum, p) => sum + p.maxPoints, 0);
      const totalEarned = parameters.reduce((sum, p) => sum + p.earnedPoints, 0);

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          ...(requestedDate ? { date: requestedDate } : {}),
          summary: {
            totalMaxPoints: totalMax,
            totalEarnedPoints: totalEarned,
            scorePercentage: Math.round((totalEarned / totalMax) * 100),
          },
          parameters,
        }),
      });
    });
  }

  /**
   * Login helper performing OTP authentication flow
   */
  async function performLogin(page) {
    await page.goto('/');
    const phoneInput = page.locator('input[type="tel"]').first();
    await expect(phoneInput).toBeVisible({ timeout: 15000 });
    await phoneInput.fill(TEST_PHONE);

    const submitPhoneBtn = page.getByRole('button', { name: /Send OTP|Continue|Submit/i }).first();
    await submitPhoneBtn.click();

    await expect(page.getByText('Enter OTP', { exact: true })).toBeVisible({ timeout: 15000 });
    const otpInputs = page.locator('input[data-otp="true"]');
    await expect(otpInputs).toHaveCount(4);

    for (let i = 0; i < LOGIN_OTP.length; i++) {
      await otpInputs.nth(i).fill(LOGIN_OTP[i]);
    }

    try {
      const permissionPrimerBtn = page.getByRole('button', { name: /Allow Permissions|Continue|Allow|Got it|OK/i });
      if (await permissionPrimerBtn.isVisible({ timeout: 2000 })) {
        await permissionPrimerBtn.click({ force: true });
      }
    } catch {
      // Permission modal not present
    }
  }

  test('SCORE_01: Required time-based parameters (Breakfast, Dinner, Education, Weight) display full 100 points when logged within window and 0 points otherwise', async ({ page }) => {
    // SCENARIO 1: All 4 required time-based parameters logged within allowed time slots -> 100/100 pts each
    await setupMocks(page, {
      timeWindows: {
        weight: { start: '05:00:00', end: '09:00:00' },
        breakfast: { start: '05:30:00', end: '08:30:00' },
        lunch: { start: '12:00:00', end: '16:00:00' },
        dinner: { start: '17:30:00', end: '20:30:00' },
        education: { start: '05:00:00', end: '23:59:00' },
      },
      scoreOverrides: {
        weight_post: 100,     // Weight Post in window -> 100 pts
        breakfast_post: 100,  // Breakfast Post in window -> 100 pts
        dinner_post: 100,     // Dinner Post in window -> 100 pts
        edu_post: 100,        // Education Post in window -> 100 pts
        lunch_post: 0,        // Lunch Post outside window -> 0 pts
      },
    });

    // 1. Perform Login
    await performLogin(page);

    // 2. Open Wellness Score Sheet via homepage tile
    const wellnessScoreTile = page.locator('[data-testid="wellness-score-home-tile"]').first();
    await expect(wellnessScoreTile).toBeVisible({ timeout: 15000 });
    await wellnessScoreTile.click();

    // 3. Verify ALL 4 required parameters display FULL POINTS (100 / 100 pts) when logged within window
    const weightPostScore = page.locator('[data-testid="score-category-weight_post"]').first();
    await expect(weightPostScore).toBeVisible({ timeout: 15000 });
    await expect(weightPostScore).toContainText('Weight Post');
    await expect(weightPostScore).toContainText('Time-based');
    await expect(weightPostScore).toContainText('100/100');

    const breakfastPostScore = page.locator('[data-testid="score-category-breakfast_post"]').first();
    await expect(breakfastPostScore).toBeVisible();
    await expect(breakfastPostScore).toContainText('Breakfast Post');
    await expect(breakfastPostScore).toContainText('Time-based');
    await expect(breakfastPostScore).toContainText('100/100');

    const dinnerPostScore = page.locator('[data-testid="score-category-dinner_post"]').first();
    await expect(dinnerPostScore).toBeVisible();
    await expect(dinnerPostScore).toContainText('Dinner Post');
    await expect(dinnerPostScore).toContainText('Time-based');
    await expect(dinnerPostScore).toContainText('100/100');

    const eduPostScore = page.locator('[data-testid="score-category-edu_post"]').first();
    await expect(eduPostScore).toBeVisible();
    await expect(eduPostScore).toContainText('Education Post');
    await expect(eduPostScore).toContainText('Time-based');
    await expect(eduPostScore).toContainText('100/100');

    // 4. Verify parameter outside window displays 0 POINTS (0 / 100 pts)
    const lunchPostScore = page.locator('[data-testid="score-category-lunch_post"]').first();
    await expect(lunchPostScore).toBeVisible();
    await expect(lunchPostScore).toContainText('Lunch Post');
    await expect(lunchPostScore).toContainText('Time-based');
    await expect(lunchPostScore).toContainText('0/100');

    // 5. Open contribution modal by clicking row to verify details
    await weightPostScore.click();
    await expect(page.getByRole('dialog', { name: /Weight Post contribution/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('100/100 pts').first()).toBeVisible();
    await page.getByRole('button', { name: 'Close' }).click();
  });

  test('SCORE_02: All wellness score parameter components across Activity, Nutrition, and Progress can be selected to view contribution details modal', async ({ page }) => {
    // 1. Setup route mocks for user across all 35 parameter components
    await setupMocks(page, {
      timeWindows: {
        weight: { start: '03:00:00', end: '06:30:00' },
        breakfast: { start: '05:30:00', end: '08:30:00' },
        lunch: { start: '12:00:00', end: '16:00:00' },
        dinner: { start: '17:30:00', end: '20:30:00' },
        education: { start: '05:00:00', end: '23:59:00' },
      },
      scoreOverrides: {
        weight_post: 0,
        breakfast_post: 100,
        lunch_post: 0,
        dinner_post: 0,
        edu_post: 100,
        calories: 80,
        protein: 100,
        water_qty: 100,
        physical_activity: 50,
      },
    });

    // 2. Perform Login
    await performLogin(page);

    // 3. Open Wellness Score Sheet via homepage tile
    const wellnessScoreTile = page.locator('[data-testid="wellness-score-home-tile"]').first();
    await expect(wellnessScoreTile).toBeVisible({ timeout: 15000 });
    await wellnessScoreTile.click();

    // 4. Select each of all 35 parameter components across Activity/Logging, Nutrition, and Progress
    for (const param of ALL_WELLNESS_PARAMETERS) {
      const paramCard = page.locator(`[data-testid="score-category-${param.key}"]`).first();
      await expect(paramCard).toBeVisible({ timeout: 10000 });
      await paramCard.click();

      // Verify modal dialog opens for the selected component
      const modalDialog = page.getByRole('dialog', { name: new RegExp(`${param.label} contribution`, 'i') });
      await expect(modalDialog).toBeVisible({ timeout: 10000 });

      // Check title header
      await expect(modalDialog.getByRole('heading', { name: param.label })).toBeVisible();

      // Close modal details
      const closeBtn = modalDialog.getByRole('button', { name: 'Close' });
      await expect(closeBtn).toBeVisible();
      await closeBtn.click();

      // Ensure modal closes before selecting next component
      await expect(modalDialog).not.toBeVisible({ timeout: 5000 });
    }
  });
});



