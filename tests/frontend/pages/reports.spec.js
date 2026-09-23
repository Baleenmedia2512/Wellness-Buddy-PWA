/**
 * tests/frontend/pages/reports.spec.js
 * E2E test suite for Reports Module.
 * 
 * Requirements Covered:
 * - RPT-001: Enter into the report module and able to click ideal weight, wellness score, nutrition and trend
 */

const { test, expect } = require('@playwright/test');

test.describe('Reports Module', () => {
  test.use({ storageState: 'playwright/.auth/user.json' });

  test.beforeEach(async ({ page }) => {
    // Enable feature flags for Reports module before app mounts
    await page.addInitScript(() => {
      localStorage.setItem('ff.reports-module', 'true');
      localStorage.setItem('ff.wellness-score-sheet', 'true');
    });

    // Mock user auth & session API routes
    await page.route('**/api/user/verify-session*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          userId: 99999,
          sessionStale: false,
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

    await page.route('**/api/user/lookup*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, isNewUser: false, isActive: true, role: 'coach' }),
      });
    });

    await page.route('**/api/user/profile*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            userId: 99999,
            userName: 'Test Coach',
            role: 'coach',
          },
        }),
      });
    });

    // Mock reports API endpoints
    await page.route('**/api/reports/downline-weight*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            self: null,
            members: [],
            pagination: { page: 1, limit: 20, totalRecords: 0, totalPages: 0, hasNextPage: false, hasPreviousPage: false },
            statusCounts: { off_track: 0, on_track: 0, no_data: 0, all: 0 },
            teamScopeCounts: { mine: 0, direct: 0, full: 0 },
          },
        }),
      });
    });

    await page.route('**/api/reports/wellness-score*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [],
        }),
      });
    });

    await page.route('**/api/diary/team-search*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          members: [],
        }),
      });
    });
  });

  // ── RPT-001 ─────────────────────────────────────────────────────────────
  test('RPT-001: Enter into the report module and able to click ideal weight, wellness score, nutrition and trend', async ({ page }) => {
    // Step 1: Navigate to app home page
    await page.goto('/');

    // Step 2: Click Reports button in navigation tab bar or header to enter Reports module
    const reportsNavBtn = page.locator('button[aria-label="Reports Dashboard"], button:has-text("Reports")').first();
    await expect(reportsNavBtn).toBeVisible({ timeout: 15000 });
    await reportsNavBtn.click();

    // Verify Reports module tablist is rendered
    const reportsTabList = page.locator('[role="tablist"][aria-label="Reports Dashboard tabs"]');
    await expect(reportsTabList).toBeVisible({ timeout: 10000 });

    // Step 3: Click Ideal Weight tab and verify panel activation
    const idealWeightTab = page.locator('#reports-tab-ideal-weight');
    await expect(idealWeightTab).toBeVisible();
    await idealWeightTab.click();
    await expect(idealWeightTab).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#reports-panel-ideal-weight')).toBeVisible();

    // Step 4: Click Wellness Score tab and verify panel activation
    const wellnessScoreTab = page.locator('#reports-tab-wellness-score');
    await expect(wellnessScoreTab).toBeVisible();
    await wellnessScoreTab.click();
    await expect(wellnessScoreTab).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#reports-panel-wellness-score')).toBeVisible();

    // Step 5: Click Nutrition tab and verify panel activation
    const nutritionTab = page.locator('#reports-tab-nutrition');
    await expect(nutritionTab).toBeVisible();
    await nutritionTab.click();
    await expect(nutritionTab).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#reports-panel-nutrition')).toBeVisible();

    // Step 6: Click Trend tab and verify panel activation
    const trendTab = page.locator('#reports-tab-trend');
    await expect(trendTab).toBeVisible();
    await trendTab.click();
    await expect(trendTab).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#reports-panel-trend')).toBeVisible();
  });

  // ── RPT-002 ─────────────────────────────────────────────────────────────
  test('RPT-002: Mine, Direct Team, and Full Team selection updates bracket numbering', async ({ page }) => {
    // Intercept downline weight API with custom teamScopeCounts
    await page.route('**/api/reports/downline-weight*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            self: null,
            members: [
              { userId: 101, name: 'Alice Smith', currentWeight: 65, idealWeight: 60, status: 'on_track' },
              { userId: 102, name: 'Bob Jones', currentWeight: 80, idealWeight: 70, status: 'off_track' },
            ],
            pagination: { page: 1, limit: 20, totalRecords: 12, totalPages: 1 },
            statusCounts: { off_track: 2, on_track: 8, no_data: 2, all: 12 },
            teamScopeCounts: { mine: 1, direct: 5, full: 12 },
          },
        }),
      });
    });

    // Navigate to homepage and open Reports module
    await page.goto('/');

    const reportsNavBtn = page.locator('button[aria-label="Reports Dashboard"], button:has-text("Reports")').first();
    await expect(reportsNavBtn).toBeVisible({ timeout: 15000 });
    await reportsNavBtn.click();

    // Locate Team Scope filter buttons container
    const teamScopeGroup = page.locator('[role="group"][aria-label="Team scope filter"]');
    await expect(teamScopeGroup).toBeVisible({ timeout: 10000 });

    const mineBtn = teamScopeGroup.locator('button').filter({ hasText: /Mine/i });
    const directBtn = teamScopeGroup.locator('button').filter({ hasText: /Direct/i });
    const fullBtn = teamScopeGroup.locator('button').filter({ hasText: /Full/i });

    await expect(mineBtn).toBeVisible();
    await expect(directBtn).toBeVisible();
    await expect(fullBtn).toBeVisible();

    // Verify bracket count numbers on Direct Team (5) and Full Team (12)
    await expect(directBtn).toContainText('(5)');
    await expect(fullBtn).toContainText('(12)');

    // Click Direct Team button & verify selection
    await directBtn.click();
    await expect(directBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(mineBtn).toHaveAttribute('aria-pressed', 'false');

    // Click Full Team button & verify selection
    await fullBtn.click();
    await expect(fullBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(directBtn).toHaveAttribute('aria-pressed', 'false');

    // Click Mine button & verify selection
    await mineBtn.click();
    await expect(mineBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(fullBtn).toHaveAttribute('aria-pressed', 'false');
  });

  // ── RPT-003 ─────────────────────────────────────────────────────────────
  test('RPT-003: Filter Ideal Weight report by status chips', async ({ page }) => {
    // Intercept API with specific status counts and member records
    await page.route('**/api/reports/downline-weight*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            self: null,
            members: [
              { userId: 101, name: 'Alice Smith', currentWeight: 65, idealWeight: 60, status: 'on_track' },
              { userId: 102, name: 'Bob Jones', currentWeight: 80, idealWeight: 70, status: 'off_track' },
            ],
            pagination: { page: 1, limit: 20, totalRecords: 2, totalPages: 1 },
            statusCounts: { off_track: 1, on_track: 1, no_data: 0, all: 2 },
            teamScopeCounts: { mine: 0, direct: 2, full: 2 },
          },
        }),
      });
    });

    await page.goto('/');
    const reportsNavBtn = page.locator('button[aria-label="Reports Dashboard"], button:has-text("Reports")').first();
    await reportsNavBtn.click();

    // Locate status filter group
    const statusGroup = page.locator('[role="group"][aria-label="Status filter"]');
    await expect(statusGroup).toBeVisible({ timeout: 10000 });

    const offTrackChip = statusGroup.locator('button').filter({ hasText: /Off Track/i });
    const onTrackChip = statusGroup.locator('button').filter({ hasText: /On Track/i });
    const allChip = statusGroup.locator('button').filter({ hasText: /All/i });

    await expect(offTrackChip).toContainText('(1)');
    await expect(onTrackChip).toContainText('(1)');
    await expect(allChip).toContainText('(2)');

    // Click Off Track chip & verify selection
    await offTrackChip.click();
    await expect(offTrackChip).toHaveClass(/bg-green-600/);

    // Click On Track chip & verify selection
    await onTrackChip.click();
    await expect(onTrackChip).toHaveClass(/bg-green-600/);
  });

    // ── RPT-004 ─────────────────────────────────────────────────────────────
  test('RPT-004: Search member by name in Ideal Weight report', async ({ page }) => {
    await page.goto('/');
    const reportsNavBtn = page.locator('button[aria-label="Reports Dashboard"], button:has-text("Reports")').first();
    await reportsNavBtn.click();

    const searchInput = page.locator('input[placeholder*="Search"]');
    await expect(searchInput).toBeVisible();

    // Type search query
    await searchInput.fill('Alice');
    await expect(searchInput).toHaveValue('Alice');
  });

  // ── RPT-005 ─────────────────────────────────────────────────────────────
  test('RPT-005: Mine, Direct Team, and Full Team scope filtering in Wellness Score report tab', async ({ page }) => {
    // Intercept wellness score report API before navigation
    await page.route('**/api/reports/wellness-score-report*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            scoreDate: '2026-09-17',
            members: [
              {
                userId: 201,
                name: 'Jane Cooper',
                todayWeight: 68,
                previousWeight: 70,
                wellnessScore: 92,
                sponsor: 'Coach Mark',
              },
              {
                userId: 202,
                name: 'Robert Fox',
                todayWeight: 84,
                previousWeight: 85,
                wellnessScore: 78,
                sponsor: 'Coach Mark',
              },
            ],
            pagination: { page: 1, limit: 10, totalRecords: 2, totalPages: 1 },
            teamScopeCounts: { mine: 1, direct: 4, full: 8 },
          },
        }),
      });
    });

    // 1. Navigate to home page
    await page.goto('/');

    // 2. Open Reports Module
    const reportsNavBtn = page.locator('button[aria-label="Reports Dashboard"], button:has-text("Reports")').first();
    await expect(reportsNavBtn).toBeVisible({ timeout: 15000 });
    await reportsNavBtn.click();

    // 3. Switch to Wellness Score Tab
    const wellnessScoreTab = page.locator('#reports-tab-wellness-score');
    await expect(wellnessScoreTab).toBeVisible({ timeout: 10000 });
    await wellnessScoreTab.click();
    await expect(wellnessScoreTab).toHaveAttribute('aria-selected', 'true');

    // 4. Locate Team Scope filter group inside Wellness Score tab panel
    const wellnessPanel = page.locator('#reports-panel-wellness-score');
    await expect(wellnessPanel).toBeVisible({ timeout: 10000 });

    const teamScopeGroup = wellnessPanel.locator('[role="group"][aria-label="Team scope filter"]');
    await expect(teamScopeGroup).toBeVisible({ timeout: 10000 });

    const mineBtn = teamScopeGroup.locator('button').filter({ hasText: /Mine/i });
    const directBtn = teamScopeGroup.locator('button').filter({ hasText: /Direct/i });
    const fullBtn = teamScopeGroup.locator('button').filter({ hasText: /Full/i });

    // 5. Verify button text & teamScopeCounts bracket numbers (Mine has no bracket, Direct/Full have counts)
    await expect(mineBtn).toBeVisible();
    await expect(directBtn).toContainText('(4)');
    await expect(fullBtn).toContainText('(8)');

    // 6. Test Mine scope selection
    await mineBtn.click();
    await expect(mineBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(directBtn).toHaveAttribute('aria-pressed', 'false');

    // 7. Test Direct Team scope selection
    await directBtn.click();
    await expect(directBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(mineBtn).toHaveAttribute('aria-pressed', 'false');

    // 8. Test Full Team scope selection
    await fullBtn.click();
    await expect(fullBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(directBtn).toHaveAttribute('aria-pressed', 'false');

    // 9. Verify table populated mock data rows are rendered
    await expect(wellnessPanel.getByText('Jane', { exact: false })).toBeVisible({ timeout: 10000 });
    await expect(wellnessPanel.getByText('Robert', { exact: false })).toBeVisible({ timeout: 10000 });
  });

  // ── RPT-006 ─────────────────────────────────────────────────────────────
  test('RPT-006: Nutrition section components, date range presets, and parameter cards are clickable', async ({ page }) => {
    // Intercept wellness score history API for Nutrition tab rendering
    await page.route('**/api/wellness-score/history*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          userId: 1,
          date: '2026-09-17',
          parameters: [
            {
              key: 'protein',
              earnedPoints: 20,
              maxPoints: 20,
              scoringMode: 'proportional',
              calculationReason: 'Goal achieved (65g / 60g)',
            },
            {
              key: 'calories',
              earnedPoints: 15,
              maxPoints: 15,
              scoringMode: 'limit',
              calculationReason: 'Within limit (1800 / 2000 kcal)',
            },
            {
              key: 'water_qty',
              earnedPoints: 10,
              maxPoints: 10,
              scoringMode: 'proportional',
              calculationReason: 'Goal achieved (3.0L / 3.0L)',
            },
            {
              key: 'weight_improvement',
              earnedPoints: 15,
              maxPoints: 15,
              scoringMode: 'progress',
              calculationReason: 'Weight progress logged',
            },
          ],
          totalEarned: 60,
          totalMax: 60,
          goalMode: 'weight_loss',
        }),
      });
    });

    // 1. Navigate to home page
    await page.goto('/');

    // 2. Open Reports Module
    const reportsNavBtn = page.locator('button[aria-label="Reports Dashboard"], button:has-text("Reports")').first();
    await expect(reportsNavBtn).toBeVisible({ timeout: 15000 });
    await reportsNavBtn.click();

    // 3. Switch to Nutrition Tab
    const nutritionTab = page.locator('#reports-tab-nutrition');
    await expect(nutritionTab).toBeVisible({ timeout: 10000 });
    await nutritionTab.click();
    await expect(nutritionTab).toHaveAttribute('aria-selected', 'true');

    // 4. Locate Nutrition panel
    const nutritionPanel = page.locator('#reports-panel-nutrition');
    await expect(nutritionPanel).toBeVisible({ timeout: 10000 });

    // 5. Test Date Range Presets Clickability (Today, Yesterday, Last 7 Days, Custom)
    const todayPill = nutritionPanel.locator('button').filter({ hasText: /^Today$/i });
    const yesterdayPill = nutritionPanel.locator('button').filter({ hasText: /^Yesterday$/i });
    const last7DaysPill = nutritionPanel.locator('button').filter({ hasText: /Last 7 Days/i });
    const customPill = nutritionPanel.locator('button').filter({ hasText: /Custom/i });

    await expect(todayPill).toBeVisible();
    await expect(yesterdayPill).toBeVisible();
    await expect(last7DaysPill).toBeVisible();
    await expect(customPill).toBeVisible();

    // Click Yesterday preset pill & verify active styling
    await yesterdayPill.click();
    await expect(yesterdayPill).toHaveClass(/bg-green-600/);

    // Click Last 7 Days preset pill & verify active styling
    await last7DaysPill.click();
    await expect(last7DaysPill).toHaveClass(/bg-green-600/);

    // Click Today preset pill to switch back
    await todayPill.click();
    await expect(todayPill).toHaveClass(/bg-green-600/);

    // 6. Test Parameter Cards Clickability (Protein, Calories, Water Quantity, Weight Improvement)
    const proteinCard = nutritionPanel.locator('[data-testid="score-category-protein"]');
    const caloriesCard = nutritionPanel.locator('[data-testid="score-category-calories"]');
    const waterCard = nutritionPanel.locator('[data-testid="score-category-water_qty"]');
    const weightCard = nutritionPanel.locator('[data-testid="score-category-weight_improvement"]');

    await expect(proteinCard).toBeVisible({ timeout: 10000 });
    await expect(caloriesCard).toBeVisible();
    await expect(waterCard).toBeVisible();
    await expect(weightCard).toBeVisible();

    // Click Protein card and verify Details bottom sheet modal opens
    await proteinCard.click();
    const contributionModal = page.locator('[role="dialog"][aria-modal="true"]');
    await expect(contributionModal).toBeVisible({ timeout: 10000 });

    // Close the contribution modal
    const closeBtn = contributionModal.locator('button[aria-label="Close"], button:has-text("Close")').first();
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
    } else {
      await page.keyboard.press('Escape');
    }
    await expect(contributionModal).toBeHidden();

    // Click Water Quantity card and verify modal opens
    await waterCard.click();
    await expect(contributionModal).toBeVisible({ timeout: 10000 });
  });

  // ── RPT-007 ─────────────────────────────────────────────────────────────
  test('RPT-007: Trend section allows selecting all metric cards, date range buttons, and custom date picker', async ({ page }) => {
    // Intercept weight history & body params card history APIs for Trend tab
    await page.route('**/api/weight/history*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            { id: 1, userId: 1, weight: 70.5, loggedAt: '2026-09-10T08:00:00Z', createdAt: '2026-09-10' },
            { id: 2, userId: 1, weight: 69.8, loggedAt: '2026-09-15T08:00:00Z', createdAt: '2026-09-15' },
            { id: 3, userId: 1, weight: 69.2, loggedAt: '2026-09-17T08:00:00Z', createdAt: '2026-09-17' },
          ],
        }),
      });
    });

    await page.route('**/api/body-parameters-card/history*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            { id: 1, userId: 1, fatPercent: 22.5, bmr: 1650, bmi: 23.1, createdAt: '2026-09-17' },
          ],
        }),
      });
    });

    // 1. Navigate to home page
    await page.goto('/');

    // 2. Open Reports Module
    const reportsNavBtn = page.locator('button[aria-label="Reports Dashboard"], button:has-text("Reports")').first();
    await expect(reportsNavBtn).toBeVisible({ timeout: 15000 });
    await reportsNavBtn.click();

    // 3. Switch to Trend Tab
    const trendTab = page.locator('#reports-tab-trend');
    await expect(trendTab).toBeVisible({ timeout: 10000 });
    await trendTab.click();
    await expect(trendTab).toHaveAttribute('aria-selected', 'true');

    // 4. Locate Trend panel & feed cards
    const trendPanel = page.locator('#reports-panel-trend');
    await expect(trendPanel).toBeVisible({ timeout: 10000 });

    const trendFeed = trendPanel.locator('[data-testid="trend-feed"]');
    await expect(trendFeed).toBeVisible({ timeout: 10000 });

    // 5. Verify Metric Cards visibility (Weight, Fat %, BMR, BMI, etc.)
    const weightCard = trendFeed.locator('button[aria-label="Open Weight Trend"]');
    const fatCard = trendFeed.locator('button[aria-label="Open Fat % Trend"]');
    const bmrCard = trendFeed.locator('button[aria-label="Open BMR Trend"]');

    await expect(weightCard).toBeVisible();
    await expect(fatCard).toBeVisible();
    await expect(bmrCard).toBeVisible();

    // 6. Click Weight metric card to open detailed trend chart view
    await weightCard.click();

    // 7. Verify Range Selector Pill Buttons (5 days, 10 days, 1 month, 1 year, Custom date)
    const rangeGroup = trendPanel.locator('div.grid.grid-cols-5');
    await expect(rangeGroup).toBeVisible({ timeout: 10000 });

    const range5DaysBtn = rangeGroup.locator('button').nth(0);
    const range10DaysBtn = rangeGroup.locator('button').nth(1);
    const range1MonthBtn = rangeGroup.locator('button').nth(2);
    const range1YearBtn = rangeGroup.locator('button').nth(3);
    const rangeCustomBtn = rangeGroup.locator('button').nth(4);

    await expect(range5DaysBtn).toBeVisible();
    await expect(range10DaysBtn).toBeVisible();
    await expect(range1MonthBtn).toBeVisible();
    await expect(range1YearBtn).toBeVisible();
    await expect(rangeCustomBtn).toBeVisible();

    // Test clicking 10 days range button
    await range10DaysBtn.click();
    await expect(range10DaysBtn).toHaveClass(/bg-emerald-500/);

    // Test clicking 1 month range button
    await range1MonthBtn.click();
    await expect(range1MonthBtn).toHaveClass(/bg-emerald-500/);

    // Test clicking 1 year range button
    await range1YearBtn.click();
    await expect(range1YearBtn).toHaveClass(/bg-emerald-500/);

    // Test clicking Custom date range button to trigger date picker popover
    await rangeCustomBtn.click();
    await expect(rangeCustomBtn).toHaveClass(/bg-emerald-500/);

    // Verify calendar date picker popover appears
    const datePickerModal = trendPanel.locator('button[aria-label="Previous month"]').or(trendPanel.locator('button:has-text("Apply")'));
    await expect(datePickerModal.first()).toBeVisible({ timeout: 10000 });

    // Verify calendar date range picker popover opens
    const backNavBtn = page.locator('button[aria-label="Back to trend cards"]');
    await expect(backNavBtn).toBeVisible();

    // 8. Test Back button to return from detail chart view to metric cards feed
    await backNavBtn.click();
    await expect(trendFeed).toBeVisible({ timeout: 10000 });

    // 9. Click another metric card (Fat %) to ensure navigation works consistently
    await fatCard.click();
    await expect(backNavBtn).toBeVisible();
  });
});










