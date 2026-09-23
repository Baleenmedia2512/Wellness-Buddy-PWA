import { test, expect } from '@playwright/test';

test.describe('Wellness Score - Time-Based Parameters (SCORE_01)', () => {
  const TEST_PHONE = '7695834209';
  const LOGIN_OTP = '1234';
  const TEST_EMAIL = 'existing@test.com';
  const TEST_USER_ID = 1004;

  /**
   * Set up route mocks for auth, user status, profile, time windows, and wellness score API.
   * Evaluates time-based parameters based on whether user action was performed within the time window.
   */
  async function setupMocks(page, { timeWindows, scoreOverrides }) {
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
      const defaultTimeBasedScores = [
        {
          key: 'weight_post',
          label: 'Weight Post',
          section: 'logging',
          scoringMode: 'binary',
          maxPoints: 100,
          earnedPoints: scoreOverrides?.weight_post ?? 100,
          calculationReason: (scoreOverrides?.weight_post ?? 100) === 100
            ? 'Done within allowed time'
            : 'Not completed within window',
        },
        {
          key: 'breakfast_post',
          label: 'Breakfast Post',
          section: 'logging',
          scoringMode: 'binary',
          maxPoints: 100,
          earnedPoints: scoreOverrides?.breakfast_post ?? 100,
          calculationReason: (scoreOverrides?.breakfast_post ?? 100) === 100
            ? 'Done within allowed time'
            : 'Not completed within window',
        },
        {
          key: 'lunch_post',
          label: 'Lunch Post',
          section: 'logging',
          scoringMode: 'binary',
          maxPoints: 100,
          earnedPoints: scoreOverrides?.lunch_post ?? 0,
          calculationReason: (scoreOverrides?.lunch_post ?? 0) === 100
            ? 'Done within allowed time'
            : 'Not completed within window',
        },
        {
          key: 'dinner_post',
          label: 'Dinner Post',
          section: 'logging',
          scoringMode: 'binary',
          maxPoints: 100,
          earnedPoints: scoreOverrides?.dinner_post ?? 0,
          calculationReason: (scoreOverrides?.dinner_post ?? 0) === 100
            ? 'Done within allowed time'
            : 'Not completed within window',
        },
        {
          key: 'edu_post',
          label: 'Education Post',
          section: 'logging',
          scoringMode: 'binary',
          maxPoints: 100,
          earnedPoints: scoreOverrides?.edu_post ?? 100,
          calculationReason: (scoreOverrides?.edu_post ?? 100) === 100
            ? 'Done within allowed time'
            : 'Not completed within window',
        },
      ];

      const totalMax = defaultTimeBasedScores.reduce((sum, p) => sum + p.maxPoints, 0);
      const totalEarned = defaultTimeBasedScores.reduce((sum, p) => sum + p.earnedPoints, 0);

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          date: '2026-09-09',
          summary: {
            totalMaxPoints: totalMax,
            totalEarnedPoints: totalEarned,
            scorePercentage: Math.round((totalEarned / totalMax) * 100),
          },
          parameters: defaultTimeBasedScores,
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

  test('SCORE_01_ZERO: Required time-based parameters display 0 points when outside time window / uncompleted', async ({ page }) => {
    // SCENARIO 2: All 4 required time-based parameters (Breakfast, Dinner, Education, Weight) NOT logged in window -> 0/100 pts
    await setupMocks(page, {
      timeWindows: {
        weight: { start: '05:00:00', end: '09:00:00' },
        breakfast: { start: '05:30:00', end: '08:30:00' },
        lunch: { start: '12:00:00', end: '16:00:00' },
        dinner: { start: '17:30:00', end: '20:30:00' },
        education: { start: '05:00:00', end: '23:59:00' },
      },
      scoreOverrides: {
        weight_post: 0,     // Outside window -> 0 pts
        breakfast_post: 0,  // Outside window -> 0 pts
        dinner_post: 0,     // Outside window -> 0 pts
        edu_post: 0,        // Outside window -> 0 pts
        lunch_post: 0,      // Outside window -> 0 pts
      },
    });

    // 1. Perform Login
    await performLogin(page);

    // 2. Open Wellness Score Sheet
    const wellnessScoreTile = page.locator('[data-testid="wellness-score-home-tile"]').first();
    await expect(wellnessScoreTile).toBeVisible({ timeout: 15000 });
    await wellnessScoreTile.click();

    // 3. Verify ALL 4 required parameters are displayed and show 0 POINTS (0 / 100 pts)
    const weightPostScore = page.locator('[data-testid="score-category-weight_post"]').first();
    await expect(weightPostScore).toBeVisible({ timeout: 15000 });
    await expect(weightPostScore).toContainText('Weight Post');
    await expect(weightPostScore).toContainText('0/100');
    await expect(weightPostScore).toContainText('Today: Not completed within window');

    const breakfastPostScore = page.locator('[data-testid="score-category-breakfast_post"]').first();
    await expect(breakfastPostScore).toBeVisible();
    await expect(breakfastPostScore).toContainText('Breakfast Post');
    await expect(breakfastPostScore).toContainText('0/100');
    await expect(breakfastPostScore).toContainText('Today: Not completed within window');

    const dinnerPostScore = page.locator('[data-testid="score-category-dinner_post"]').first();
    await expect(dinnerPostScore).toBeVisible();
    await expect(dinnerPostScore).toContainText('Dinner Post');
    await expect(dinnerPostScore).toContainText('0/100');
    await expect(dinnerPostScore).toContainText('Today: Not completed within window');

    const eduPostScore = page.locator('[data-testid="score-category-edu_post"]').first();
    await expect(eduPostScore).toBeVisible();
    await expect(eduPostScore).toContainText('Education Post');
    await expect(eduPostScore).toContainText('0/100');
    await expect(eduPostScore).toContainText('Today: Not completed within window');
  });
});
