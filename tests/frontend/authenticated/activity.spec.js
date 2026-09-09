const { test, expect } = require('@playwright/test');

// Base response we can merge overlays into
const baseReportResponse = {
  success: true,
  summary: { weight: 5, education: 10, breakfast: 2, lunch: 4, dinner: 1, water: 12, calories: 7 },
  teamScopeCounts: { hasTeam: true, mine: 5, direct: 15, full: 41 },
  members: [],
  stats: {},
  records: [],
  pagination: {
    totalRecords: 0,
    totalPages: 0,
    currentPage: 1,
    pageSize: 20,
    hasNextPage: false,
    hasPreviousPage: false
  }
};

/** Activity Report filters are <select>s inside aria-label="Report filters". */
function reportFilterSelects(page) {
  return page.locator('section[aria-label="Report filters"] select');
}

function dateSelect(page) {
  return reportFilterSelects(page).nth(0);
}

function teamSelect(page) {
  // When hasTeam: Date, Team, Category, Attendance
  return reportFilterSelects(page).nth(1);
}

function categorySelect(page) {
  // With team scope visible, Category is the 3rd select (index 2)
  return reportFilterSelects(page).nth(2);
}

function attendanceSelect(page) {
  // With team scope: 4th select; without team: 2nd select
  return reportFilterSelects(page).last();
}

test.describe('Activity Report Module', () => {
  test.use({ storageState: 'playwright/.auth/user.json' });

  test.beforeEach(async ({ page }) => {
    // Mock authentication and user lookup to ensure the app loads
    await page.route('**/api/user/verify-session*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          userId: 99999,
          user: { id: 99999, UserId: 99999, UserName: 'Test User', phone: '+1234567890', role: 'coach', email: 'test@example.com' }
        })
      });
    });

    await page.route('**/api/user/lookup*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          isActive: true,
          details: { id: 99999, role: 'coach' }
        })
      });
    });

    await page.route('**/api/user/consent-status*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, consentRequired: false })
      });
    });

    await page.route('**/api/user/status*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ setupComplete: true, isActive: true })
      });
    });

    await page.route('**/api/user/profile*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            profileComplete: true,
            userName: 'Test User',
            email: 'test@example.com',
            phoneNumber: '+1234567890',
            physicalActivityLevel: 'moderate',
            // Required so onboarding Transformation Photos gate does not block nav tabs
            transformationPhotos: {
              left: 'https://example.com/left.jpg',
              front: 'https://example.com/front.jpg',
              right: 'https://example.com/right.jpg',
            },
          }
        })
      });
    });

    // Intercept API calls for activity report
    await page.route('**/api/activity/report*', async route => {
      const url = new URL(route.request().url());
      const activityType = url.searchParams.get('activityType');
      const teamScope = url.searchParams.get('teamScope') || 'mine';
      const dateRange = url.searchParams.get('dateRange') || 'today';
      const pageNum = parseInt(url.searchParams.get('page')) || 1;
      const exportAll = url.searchParams.get('exportAll') === '1';
      const search = url.searchParams.get('search') || '';

      // Create a response payload depending on query parameters
      let response = {
        ...baseReportResponse,
        pagination: { ...baseReportResponse.pagination }
      };

      if (activityType === 'bootstrap') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(response)
        });
      }

      if (activityType === 'weight') {
        if (teamScope === 'mine' && dateRange === 'today') {
          response.records = [{
            userId: '1', memberName: 'Clara K', weight: 78.8, clubName: 'Remote',
            date: '2026-08-24', time: '07:10:38', sponsorName: 'N/A',
            coachName: 'Coach X', phone: '9050000000', city: 'Seegampatti', village: 'Pudu Colony'
          }];
          response.pagination.totalRecords = 1;
          response.pagination.totalPages = 1;
        }
      } else if (activityType === 'water') {
        if (teamScope === 'direct' && dateRange === 'yesterday') {
          response.records = [{
            userId: '2', memberName: 'John Doe', waterLiters: 2.5, clubName: 'Wellness Club',
            date: '2026-08-23', time: '14:20:00', sponsorName: 'Sponsor Y',
            coachName: 'Coach Z', phone: '9000000000', city: 'Chennai', village: 'N/A'
          }];
          response.pagination.totalRecords = 1;
          response.pagination.totalPages = 1;
        }
      } else if (activityType === 'education') {
        if (pageNum === 1) {
          response.records = Array.from({ length: 10 }).map((_, i) => ({
            userId: `${i}`, memberName: `User ${i}`, clubName: 'Remote', date: '2026-08-24', time: '10:00'
          }));
          response.pagination = { totalRecords: 20, totalPages: 2, currentPage: 1, pageSize: 10, hasNextPage: true, hasPreviousPage: false };
        } else if (pageNum === 2) {
          response.records = Array.from({ length: 10 }).map((_, i) => ({
            userId: `${i+10}`, memberName: `User ${i+10}`, clubName: 'Remote', date: '2026-08-24', time: '10:00'
          }));
          response.pagination = { totalRecords: 20, totalPages: 2, currentPage: 2, pageSize: 10, hasNextPage: false, hasPreviousPage: true };
        }

        if (search === 'Clara') {
          response.records = [{ userId: '1', memberName: 'Clara K', clubName: 'Remote', date: '2026-08-24', time: '10:00' }];
          response.pagination = { totalRecords: 1, totalPages: 1, currentPage: 1, pageSize: 10, hasNextPage: false, hasPreviousPage: false };
        }
      }

      if (exportAll) {
        // Return 15 records for export test
        response.records = Array.from({ length: 15 }).map((_, i) => ({
          userId: `${i}`, memberName: `Export User ${i}`, clubName: 'Remote', date: '2026-08-24', time: '10:00'
        }));
      }

      // Empty states fallback
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(response)
      });
    });

    // We also need to mock teamSearchService / team check
    await page.route('**/api/users/team-search?*', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, teamMembers: [{ id: '2' }] })
      });
    });

    // Navigate and go to Activity Tab
    await page.goto('/');
    const activityTab = page.getByRole('button', { name: 'Activity Report' });
    await expect(activityTab).toBeVisible();
    await activityTab.click();
    await expect(page.getByRole('heading', { name: 'Activity Report' })).toBeVisible();
    await expect(page.getByLabel('Report filters')).toBeVisible();
  });

  test('ACT-001 Initial Load and Elements Visibility', async ({ page }) => {
    // Date / Team / Category are selects (not pill buttons)
    await expect(dateSelect(page)).toBeVisible();
    await expect(dateSelect(page)).toHaveValue('today');
    await expect(dateSelect(page).locator('option[value="yesterday"]')).toHaveCount(1);
    await expect(dateSelect(page).locator('option[value="custom"]')).toHaveCount(1);

    await expect(teamSelect(page)).toBeVisible();
    await expect(teamSelect(page).locator('option[value="mine"]')).toHaveCount(1);
    await expect(teamSelect(page).locator('option[value="direct"]')).toHaveCount(1);
    await expect(teamSelect(page).locator('option[value="full"]')).toHaveCount(1);

    await expect(categorySelect(page)).toBeVisible();
    for (const value of ['weight', 'education', 'breakfast', 'lunch', 'dinner', 'water', 'calories']) {
      await expect(categorySelect(page).locator(`option[value="${value}"]`)).toHaveCount(1);
    }
  });

  test('ACT-002 Team Scope Toggles', async ({ page }) => {
    await teamSelect(page).selectOption('mine');
    await expect(teamSelect(page)).toHaveValue('mine');

    await teamSelect(page).selectOption('direct');
    await expect(teamSelect(page)).toHaveValue('direct');

    await teamSelect(page).selectOption('full');
    await expect(teamSelect(page)).toHaveValue('full');
  });

  test('ACT-003 Date Range Filters (Yesterday & Custom)', async ({ page }) => {
    await dateSelect(page).selectOption('yesterday');
    await expect(dateSelect(page)).toHaveValue('yesterday');

    await dateSelect(page).selectOption('custom');
    await expect(dateSelect(page)).toHaveValue('custom');

    // Custom opens DateRangePicker — pick start then end day in the calendar grid
    const calendar = page.locator('.grid.grid-cols-7').last();
    await expect(calendar).toBeVisible();
    const dayBtns = calendar.locator('button:not([disabled])');
    await expect(dayBtns.first()).toBeVisible();
    await dayBtns.nth(0).click();
    await dayBtns.nth(Math.min(2, await dayBtns.count() - 1)).click();
  });

  test('ACT-004 Category Switching & Dynamic Table Headers', async ({ page }) => {
    await categorySelect(page).selectOption('weight');
    await expect(page.getByRole('heading', { name: /Weight · Attended/i })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Weight (kg)', exact: true })).toBeVisible();

    await categorySelect(page).selectOption('breakfast');
    await expect(page.getByRole('heading', { name: /Breakfast · Attended/i })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Meal', exact: true })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Calories', exact: true })).toBeVisible();

    await categorySelect(page).selectOption('water');
    await expect(page.getByRole('heading', { name: /Water · Attended/i })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Water (L)', exact: true })).toBeVisible();
  });

  test('ACT-005 Data Fetching (Weight - Today - Mine)', async ({ page }) => {
    await teamSelect(page).selectOption('mine');
    await dateSelect(page).selectOption('today');
    await categorySelect(page).selectOption('weight');

    await expect(page.getByRole('cell', { name: 'Clara K', exact: true })).toBeVisible();
    await expect(page.getByRole('cell', { name: '78.8', exact: true })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Remote', exact: true })).toBeVisible();
  });

  test('ACT-006 Data Fetching (Water - Yesterday - Direct Team)', async ({ page }) => {
    await teamSelect(page).selectOption('direct');
    await dateSelect(page).selectOption('yesterday');
    await categorySelect(page).selectOption('water');

    await expect(page.getByRole('cell', { name: 'John Doe', exact: true })).toBeVisible();
    await expect(page.getByRole('cell', { name: '2.5', exact: true })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Wellness Club', exact: true })).toBeVisible();
  });

  test('ACT-007 Empty State Handling', async ({ page }) => {
    // For lunch, we didn't mock any records, so it will return empty array
    await categorySelect(page).selectOption('lunch');
    await expect(page.getByText('No records found')).toBeVisible();
  });

  test('ACT-008 Refresh Button', async ({ page }) => {
    const requestPromise = page.waitForRequest(request =>
      request.url().includes('api/activity/report') && request.method() === 'GET'
    );

    const headerRefresh = page.locator('.sticky.top-0').locator('button').first();
    await headerRefresh.click();

    await requestPromise;
  });

  test('ACT-009 Search Functionality', async ({ page }) => {
    // Stay on Education (default) and wait for search debounce request
    let capturedSearchParam = null;
    const searchRequestPromise = page.waitForRequest((request) => {
      const url = request.url();
      if (!url.includes('/api/activity/report')) return false;
      const urlObj = new URL(url);
      capturedSearchParam = urlObj.searchParams.get('search');
      return capturedSearchParam === 'Clara';
    }, { timeout: 15000 });

    const searchInput = page.getByPlaceholder('Search name or phone');
    await expect(searchInput).toBeVisible();
    await searchInput.click();
    await searchInput.fill('');
    await searchInput.pressSequentially('Clara', { delay: 40 });

    await searchRequestPromise;
    expect(capturedSearchParam).toBe('Clara');
    await expect(page.getByRole('cell', { name: 'Clara K', exact: true })).toBeVisible();
  });

  test('ACT-010 Pagination', async ({ page }) => {
    await categorySelect(page).selectOption('education');
    const searchInput = page.getByPlaceholder('Search name or phone');
    if (await searchInput.inputValue()) {
      await searchInput.clear();
      await page.waitForTimeout(400);
    }

    await expect(page.getByRole('cell', { name: 'User 0', exact: true })).toBeVisible();
    await expect(page.getByText('Showing 1 to 10 of 20 records')).toBeVisible();

    let capturedPage = null;
    const page2RequestPromise = page.waitForRequest(request => {
      const url = request.url();
      if (url.includes('/api/activity/report') && url.includes('page=')) {
        const urlObj = new URL(url);
        capturedPage = urlObj.searchParams.get('page');
        return capturedPage === '2';
      }
      return false;
    }, { timeout: 5000 });

    await page.getByRole('button', { name: 'Next' }).click();

    await page2RequestPromise;
    expect(capturedPage).toBe('2');

    await expect(page.getByRole('cell', { name: 'User 10', exact: true })).toBeVisible();
    await expect(page.getByText('Showing 11 to 20 of 20 records')).toBeVisible();
  });

  test('ACT-011 Export Report', async ({ page }) => {
    await categorySelect(page).selectOption('education');
    await expect(page.getByRole('cell', { name: 'User 0', exact: true })).toBeVisible();

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /Export report/i }).click();

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('activity-report-education');
    expect(download.suggestedFilename()).toContain('.csv');
  });

  test('ACT-012 Sorting Columns', async ({ page }) => {
    // Default category is already Education — wait for rows, then sort
    await expect(page.getByRole('cell', { name: 'User 0', exact: true })).toBeVisible();

    const memberNameHeader = page.getByRole('columnheader', { name: /Member Name/i });

    const sortAscPromise = page.waitForRequest((request) => {
      const url = request.url();
      return url.includes('/api/activity/report') &&
        url.includes('sort=memberName') &&
        url.includes('sortDir=asc');
    }, { timeout: 20000 });
    await memberNameHeader.click();
    await sortAscPromise;
    await expect(memberNameHeader).toContainText('↑');

    const sortDescPromise = page.waitForRequest((request) => {
      const url = request.url();
      return url.includes('/api/activity/report') &&
        url.includes('sort=memberName') &&
        url.includes('sortDir=desc');
    }, { timeout: 20000 });
    await memberNameHeader.click();
    await sortDescPromise;
    await expect(memberNameHeader).toContainText('↓');
  });

  test('ACT-013 API Error Handling', async ({ page }) => {
    await page.route('**/api/activity/report*', async (route) => {
      const url = new URL(route.request().url());
      if (url.searchParams.get('activityType') === 'water') {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ success: false, message: 'Simulated Server Error' })
        });
        return;
      }
      await route.fallback();
    });

    await categorySelect(page).selectOption('water');
    await expect(page.getByText('Simulated Server Error')).toBeVisible();
  });

  test('ACT-014 Role-Based Scope Visibility (No Team)', async ({ page }) => {
    await page.route('**/api/activity/report*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          summary: { weight: 0, education: 0, breakfast: 0, lunch: 0, dinner: 0, water: 0, calories: 0 },
          records: [],
          teamScopeCounts: {
            hasTeam: false,
            mine: 10,
            direct: 0,
            full: 0
          },
          pagination: { ...baseReportResponse.pagination }
        })
      });
    });

    await page.reload();
    const activityTab = page.getByRole('button', { name: 'Activity Report' });
    await expect(activityTab).toBeVisible();
    await activityTab.click();
    await expect(page.getByLabel('Report filters')).toBeVisible();

    // Team scope select is hidden when hasTeam is false (Date + Attendance + Category only)
    await expect(reportFilterSelects(page)).toHaveCount(3);
    await expect(page.locator('section[aria-label="Report filters"] option[value="mine"]')).toHaveCount(0);
    await expect(reportFilterSelects(page).nth(1).locator('option[value="attended"]')).toHaveCount(1);
  });
});
