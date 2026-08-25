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
    pageSize: 10,
    hasNextPage: false,
    hasPreviousPage: false
  }
};

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
            physicalActivityLevel: 'moderate'
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
      let response = { ...baseReportResponse };

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
    await page.waitForTimeout(1000); // Wait for tab switch and animations
  });

  test('ACT-001 Initial Load and Elements Visibility', async ({ page }) => {
    // Verify Date Range buttons
    await expect(page.getByRole('button', { name: 'Today', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Yesterday', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Custom', exact: true })).toBeVisible();

    // Verify Team Scope buttons
    await expect(page.getByRole('button', { name: /Mine/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Direct Team/i })).toBeVisible();

    // Verify all 7 activity category badges (using their numbers as labels are partial in some cases)
    await expect(page.getByRole('button', { name: /Weight/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Education/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Breakfast/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Lunch/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Dinner/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Water/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Exercise/i })).toBeVisible();
  });

  test('ACT-002 Team Scope Toggles', async ({ page }) => {
    // Initial is usually Direct Team based on mock, let's explicitly click Mine
    await page.getByRole('button', { name: /Mine/i }).click();
    await expect(page.getByText('Activity counts for Mine')).toBeVisible();

    await page.getByRole('button', { name: /Direct Team/i }).click();
    await expect(page.getByText(/Activity counts for Direct Team/i)).toBeVisible();

    await page.getByRole('button', { name: /Full Team/i }).click();
    await expect(page.getByText(/Activity counts for Full Team/i)).toBeVisible();
  });

  test('ACT-003 Date Range Filters (Yesterday & Custom)', async ({ page }) => {
    await page.getByRole('button', { name: 'Yesterday', exact: true }).click();
    await expect(page.getByText(/· Yesterday/)).toBeVisible();

    await page.getByRole('button', { name: 'Custom', exact: true }).click();
    
    // Select dates in the custom date picker popover
    // Assuming custom date filter shows standard date inputs
    const startInput = page.getByLabel(/Start Date/i).first();
    const endInput = page.getByLabel(/End Date/i).first();
    
    // We will just fill them if visible
    if (await startInput.isVisible()) {
      await startInput.fill('2026-08-01');
      await endInput.fill('2026-08-20');
      // Click somewhere to close or apply
      await page.keyboard.press('Escape');
    }
  });

  test('ACT-004 Category Switching & Dynamic Table Headers', async ({ page }) => {
    // Check Weight columns
    await page.getByRole('button', { name: /Weight/i }).click();
    await expect(page.getByRole('heading', { name: 'Weight Records' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Weight (kg)', exact: true })).toBeVisible();

    // Check Breakfast (Meal, Calories)
    await page.getByRole('button', { name: /Breakfast/i }).click();
    await expect(page.getByRole('heading', { name: 'Breakfast Records' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Meal', exact: true })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Calories', exact: true })).toBeVisible();

    // Check Water
    await page.getByRole('button', { name: /Water/i }).click();
    await expect(page.getByRole('heading', { name: 'Water Records' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Water (L)', exact: true })).toBeVisible();
  });

  test('ACT-005 Data Fetching (Weight - Today - Mine)', async ({ page }) => {
    await page.getByRole('button', { name: /Mine/i }).click();
    await page.getByRole('button', { name: 'Today', exact: true }).click();
    await page.getByRole('button', { name: /Weight/i }).click();

    await expect(page.getByRole('cell', { name: 'Clara K', exact: true })).toBeVisible();
    await expect(page.getByRole('cell', { name: '78.8', exact: true })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Remote', exact: true })).toBeVisible();
  });

  test('ACT-006 Data Fetching (Water - Yesterday - Direct Team)', async ({ page }) => {
    await page.getByRole('button', { name: /Direct Team/i }).click();
    await page.getByRole('button', { name: 'Yesterday', exact: true }).click();
    await page.getByRole('button', { name: /Water/i }).click();

    await expect(page.getByRole('cell', { name: 'John Doe', exact: true })).toBeVisible();
    await expect(page.getByRole('cell', { name: '2.5', exact: true })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Wellness Club', exact: true })).toBeVisible();
  });

  test('ACT-007 Empty State Handling', async ({ page }) => {
    // For lunch, we didn't mock any records, so it will return empty array
    await page.getByRole('button', { name: /Lunch/i }).click();
    await expect(page.getByText('No records found')).toBeVisible();
  });

  test('ACT-008 Refresh Button', async ({ page }) => {
    // Watch for API call
    const requestPromise = page.waitForRequest(request => request.url().includes('api/activity/report') && request.method() === 'GET');
    
    // Click refresh
    const refreshBtn = page.locator('button').filter({ has: page.locator('svg.animate-spin, svg:not(.animate-spin)') }).first();
    // Since lucide-react icon is just an svg inside the TouchFeedbackButton on the header:
    const headerRefresh = page.locator('.sticky.top-0').locator('button').first();
    await headerRefresh.click();
    
    await requestPromise;
  });

  test('ACT-009 Search Functionality', async ({ page }) => {
    await page.getByRole('button', { name: /Education/i }).click();
    await page.waitForTimeout(300);

    // Set up a promise to capture the next API call after typing
    let capturedSearchParam = null;
    const searchRequestPromise = page.waitForRequest(request => {
      const url = request.url();
      if (url.includes('/api/activity/report') && url.includes('search=')) {
        const urlObj = new URL(url);
        capturedSearchParam = urlObj.searchParams.get('search');
        return capturedSearchParam === 'Clara';
      }
      return false;
    }, { timeout: 5000 });

    // Type in search bar
    const searchInput = page.getByPlaceholder('Search by name, phone, coach, city, or village...');
    await searchInput.fill('Clara');

    // Wait for the debounced API call to fire with search=Clara
    await searchRequestPromise;

    // Verify the URL contained search=Clara
    expect(capturedSearchParam).toBe('Clara');
  });

  test('ACT-010 Pagination', async ({ page }) => {
    await page.getByRole('button', { name: /Education/i }).click();
    await page.getByPlaceholder('Search by name, phone, coach, city, or village...').clear();
    await page.waitForTimeout(500);

    // Verify page 1 renders correctly
    await expect(page.getByRole('cell', { name: 'User 0', exact: true })).toBeVisible();
    await expect(page.getByText('Showing 1 to 10 of 20 records')).toBeVisible();

    // Capture the API call when clicking Next — it MUST contain page=2
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

    // Wait for API call with page=2
    await page2RequestPromise;
    expect(capturedPage).toBe('2');

    // Verify page 2 content renders
    await expect(page.getByRole('cell', { name: 'User 10', exact: true })).toBeVisible();
    await expect(page.getByText('Showing 11 to 20 of 20 records')).toBeVisible();
  });

  test('ACT-011 Export Report', async ({ page }) => {
    await page.getByRole('button', { name: /Education/i }).click();
    
    // Setup download listener
    const downloadPromise = page.waitForEvent('download');
    
    // Click Export
    await page.getByRole('button', { name: 'Export' }).click();
    
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('activity-report-education');
    expect(download.suggestedFilename()).toContain('.csv');
  });
  test('ACT-012 Sorting Columns', async ({ page }) => {
    // Click on Member Name header to trigger sorting
    const memberNameHeader = page.getByRole('columnheader', { name: /Member Name/i });
    
    // Watch for the sort network call
    const sortAscPromise = page.waitForResponse(response => 
      response.url().includes('/api/activity/report') && response.url().includes('sort=memberName') && response.url().includes('sortDir=asc')
    );
    await memberNameHeader.click();
    await sortAscPromise;
    
    // Click again for descending sort
    const sortDescPromise = page.waitForResponse(response => 
      response.url().includes('/api/activity/report') && response.url().includes('sort=memberName') && response.url().includes('sortDir=desc')
    );
    await memberNameHeader.click();
    await sortDescPromise;
  });

  test('ACT-013 API Error Handling', async ({ page }) => {
    // Mock the API to return a 500 error for a specific category
    await page.route('**/api/activity/report*activityType=water*', async route => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, message: 'Simulated Server Error' })
      });
    });

    // Click on water to trigger the failed API call
    await page.getByRole('button', { name: /Water/i }).click();

    // Verify error message is displayed
    await expect(page.getByText('Simulated Server Error')).toBeVisible();
  });

  test('ACT-014 Role-Based Scope Visibility (No Team)', async ({ page }) => {
    // Override the mock to return hasTeam: false
    await page.route('**/api/activity/report*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          summary: {},
          records: [],
          teamScopeCounts: {
            hasTeam: false,
            mine: 10,
            direct: 0,
            full: 0
          }
        })
      });
    });

    // Reload the page to apply the new mock
    await page.reload();
    const activityTab = page.getByRole('button', { name: 'Activity Report' });
    await expect(activityTab).toBeVisible();
    await activityTab.click();
    await page.waitForTimeout(1000);

    // Verify the scope toggles group container is NOT visible
    await expect(page.getByRole('group', { name: 'Team scope filter' })).not.toBeVisible();
  });
});
