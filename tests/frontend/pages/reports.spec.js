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


});

