/**
 * tests/frontend/authenticated/transformation.spec.js
 * Comprehensive E2E test suite for Transformation (Testimonials) Module.
 * 
 * Requirements Covered:
 * - TR-001: Profile 3-angle upload linkage (Left photo auto-seeding, weight, health issues)
 * - TR-002: Team Scope Tabs (Mine, Direct Team, Full Team navigation & isolation)
 * - TR-003: Share Card Rendering (9:16 portrait card DOM container & Share button action)
 * - TR-004: Edit Dirty State, Coach Approval dispatch, and OTP Verification flow
 * - TR-005: Search Filter by Health Issue and User Name + Header Refresh button
 * - TR-006: Photo Restriction Mode for Result Videos (Strict rejection of photo files)
 * - TR-007: Valid Result Video Upload Updates Preview and Triggers Dirty State
 * - TR-008: Result Video Playback in Mine Scope (Play and Close modal)
 * - TR-009: Result Video Playback in Direct Team Scope (Priya Sharma Video)
 * - TR-010: Result Video Playback in Full Team Scope (Suresh Kumar Video)
 * - TR-011: Inside-Card Health Issue Search & Multi-Select Autocomplete (Add and Remove Conditions)
 * - TR-012: Upload Completeness Filter Chips (Fully Uploaded, Partial, Not Uploaded)
 * - TR-013: Mandatory Health Issue Validation on Photo Submit
 * - TR-014: Inline Weight Editing with Live "Lost/Gained X kg" Badge Recalculation
 * - TR-015: Resend OTP Flow in Expired State
 */
const path = require('path');
const { test, expect } = require('@playwright/test');
const { TransformationPage } = require('../../page-objects/TransformationPage');
const {
  MOCK_MEMBER_TESTIMONIAL_VERIFIED,
  MOCK_MEMBER_TESTIMONIAL_PENDING,
  MOCK_TEAM_MEMBERS_DIRECT,
  MOCK_TEAM_MEMBERS_FULL,
  MOCK_KNOWN_HEALTH_ISSUES,
  mockAuthenticatedSession,
} = require('../../fixtures/transformation-mock-data');

test.describe('Transformation Module (Testimonials Hub)', () => {
  test.use({ storageState: 'playwright/.auth/user.json' });

  let currentTestimonial;

  test.beforeEach(async ({ page }) => {
    // 1. Reset baseline verified testimonial
    currentTestimonial = JSON.parse(JSON.stringify(MOCK_MEMBER_TESTIMONIAL_VERIFIED));

    // 2. Intercept authenticated session, profile & system setup APIs
    await mockAuthenticatedSession(page);

    // 3. Mock default personal testimonial endpoint
    await page.route('**/api/testimonials/my-testimonial*', async (route) => {
      const method = route.request().method();
      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: currentTestimonial,
            testimonial: currentTestimonial,
          }),
        });
      } else {
        await route.continue();
      }
    });

    // 4. Mock coach team downline listing
    await page.route('**/api/testimonials/*coach*', async (route) => {
      const url = new URL(route.request().url());
      const scope = url.searchParams.get('scope') || 'direct';
      const search = (url.searchParams.get('search') || '').toLowerCase().trim();
      const healthIssue = (url.searchParams.get('healthIssue') || '').toLowerCase().trim();
      const uploadFilter = url.searchParams.get('uploadFilter') || '';

      let members = scope === 'full' ? [...MOCK_TEAM_MEMBERS_FULL] : [...MOCK_TEAM_MEMBERS_DIRECT];
      if (search) {
        members = members.filter((m) => (m.user?.userName || '').toLowerCase().includes(search));
      }
      if (healthIssue) {
        members = members.filter((m) =>
          (m.testimonial?.recoveredHealthIssues || []).some(
            (issue) =>
              issue.toLowerCase().includes(healthIssue) || healthIssue.includes(issue.toLowerCase())
          )
        );
      }
      if (uploadFilter && uploadFilter !== 'all') {
        members = members.filter((m) => {
          if (uploadFilter === 'fully_uploaded') {
            return m.completeness === 'fully_uploaded' || m.completeness === 'fully';
          }
          if (uploadFilter === 'partial_upload') {
            return m.completeness === 'partial_upload' || m.completeness === 'partial';
          }
          if (uploadFilter === 'not_uploaded') {
            return m.completeness === 'not_uploaded';
          }
          return true;
        });
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: members,
          members: members,
          pagination: { total: members.length, page: 1, hasMore: false },
          uploadCounts: { fully_uploaded: 1, partial_upload: 1, not_uploaded: 1 },
        }),
      });
    });

    // 5. Mock team performance report
    await page.route('**/api/testimonials/team-report*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          photoReport: {},
          videoReport: {},
          teamPerformanceByUserId: {},
        }),
      });
    });

    // 6. Mock master health issues
    await page.route('**/api/testimonials/known-health-issues', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, issues: MOCK_KNOWN_HEALTH_ISSUES }),
      });
    });

    // 7. Open Dashboard and Navigate to Transformation Hub
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const transformationPage = new TransformationPage(page);
    await transformationPage.gotoTransformation();
  });

  test('TR-001 Profile 3-Angle Photo Upload Seeds Left Photo, Weight, and Health Issues into Transformation Card', async ({ page }) => {
    // Verify weight populated from profile (85 kg)
    await expect(
      page.getByText('85 kg', { exact: false }).first()
    ).toBeVisible({ timeout: 10000 });

    // Verify health issues populated from profile
    await expect(page.getByText('Thyroid', { exact: false }).first()).toBeVisible();
    await expect(page.getByText('Overweight', { exact: false }).first()).toBeVisible();

    // Verify Before photo populated from Left photo
    const beforePhotoElement = page.locator('img[alt*="Before"]').or(page.getByText('BEFORE', { exact: false }));
    await expect(beforePhotoElement.first()).toBeVisible();
  });

  test('TR-002 Team Scope Tabs - Toggle Between Mine, Direct Team, and Full Team Scopes', async ({ page }) => {
    const transformationPage = new TransformationPage(page);

    // Verify all three scope tabs are displayed
    await expect(transformationPage.scopeMineButton).toBeVisible({ timeout: 10000 });
    await expect(transformationPage.scopeDirectButton).toBeVisible({ timeout: 10000 });
    await expect(transformationPage.scopeFullButton).toBeVisible({ timeout: 10000 });

    // Default / Mine view: Personal testimonial details visible
    await expect(page.getByText('Test Coach', { exact: false }).first()).toBeVisible();

    // Switch to "Direct Team"
    await transformationPage.selectScope('direct');
    await expect(page.locator('p.font-semibold').filter({ hasText: 'Priya Sharma' })).toBeVisible({ timeout: 10000 });
    await expect(page.locator('p.font-semibold').filter({ hasText: 'Karthik Raja' })).toBeVisible();

    // Switch to "Full Team"
    await transformationPage.selectScope('full');
    await expect(page.locator('p.font-semibold').filter({ hasText: 'Suresh Kumar' })).toBeVisible({ timeout: 10000 });

    // Switch back to "Mine"
    await transformationPage.selectScope('mine');
    await expect(page.getByText('Test Coach', { exact: false }).first()).toBeVisible();
    await expect(page.locator('p.font-semibold').filter({ hasText: 'Suresh Kumar' })).not.toBeVisible();
  });

  test('TR-003 Share Card Rendering and Action Button Behavior', async ({ page }) => {
    const transformationPage = new TransformationPage(page);

    // Verify Share Image button is visible and active in clean verified state
    await expect(transformationPage.shareImageButton).toBeVisible({ timeout: 10000 });
    await expect(transformationPage.shareImageButton).toBeEnabled();

    // Verify hidden 9:16 portrait card container (540x960 px) exists in the DOM
    const shareCardContainer = page.locator('div[style*="width: 540px"][style*="height: 960px"]')
      .or(page.locator('div[style*="width:540px"][style*="height:960px"]'))
      .or(page.locator('div[aria-hidden="true"]').filter({ hasText: /Wellness Valley|Test Coach/i }));
    await expect(shareCardContainer.first()).toBeAttached();

    // Mock navigator.share to avoid browser prompt blocking
    await page.evaluate(() => {
      if (navigator.share) {
        navigator.share = async () => true;
      }
    });

    // Click Share Image button and assert no unhandled runtime errors
    await transformationPage.shareImageButton.click();
    await expect(page.locator('body')).not.toContainText('Uncaught TypeError');
  });

  test('TR-004 Edit Dirty State Hides Share, Reveals Submit for Approval, Dispatches Coach Email, and OTP Verifies to Restore Share', async ({ page }) => {
    const transformationPage = new TransformationPage(page);

    let submitApprovalCalled = false;

    // 1. Intercept Submit All Edits API
    await page.route('**/api/testimonials/submit-all-edits', async (route) => {
      submitApprovalCalled = true;
      const submitEditsPayload = route.request().postDataJSON?.() || {};
      currentTestimonial = {
        ...currentTestimonial,
        status: 'pending',
        hasPendingOtp: true,
        otpPending: true,
        durationText: submitEditsPayload?.durationText || currentTestimonial.durationText,
        otpExpiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        otpValidityHours: 24,
        otpExpired: false,
      };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          otpSent: true,
          otpExpiresAt: currentTestimonial.otpExpiresAt,
          data: currentTestimonial,
          message: 'Changes submitted. An OTP has been sent to your coach.',
          testimonial: currentTestimonial,
        }),
      });
    });

    // 2. Intercept OTP Verification API (both unified and standard)
    const handleOtpVerify = async (route) => {
      const payload = route.request().postDataJSON?.() || {};
      if (payload.otp === '1234') {
        currentTestimonial = {
          ...currentTestimonial,
          status: 'verified',
          hasPendingOtp: false,
          otpPending: false,
        };
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            status: 'verified',
            data: currentTestimonial,
            testimonial: currentTestimonial,
            message: 'OTP verified successfully.',
          }),
        });
      } else {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            message: 'Invalid OTP code. Please enter the correct code.',
          }),
        });
      }
    };

    await page.route('**/api/testimonials/verify-unified-otp', handleOtpVerify);
    await page.route('**/api/testimonials/verify-otp', handleOtpVerify);

    // 3. Clean verified state: Share button visible, Submit button hidden
    await expect(transformationPage.shareImageButton).toBeVisible({ timeout: 10000 });
    await expect(transformationPage.submitForApprovalButton).not.toBeVisible();

    // 4. Edit duration -> Share button immediately disappears, Submit for Approval appears
    await transformationPage.editDuration('6 months');
    await expect(transformationPage.shareImageButton).not.toBeVisible();
    await expect(transformationPage.submitForApprovalButton).toBeVisible({ timeout: 5000 });

    // 5. Click "Submit for Approval" -> Dispatches coach email & submit button disappears
    await transformationPage.clickSubmitForApproval();
    await expect.poll(() => submitApprovalCalled).toBe(true);
    await expect(transformationPage.submitForApprovalButton).not.toBeVisible();

    // 6. Inline OTP form appears
    await expect(transformationPage.unifiedOtpInput).toBeVisible({ timeout: 10000 });

    // 7. Test invalid OTP rejection
    await transformationPage.enterUnifiedOtp('9999');
    await expect(page.getByText('Invalid OTP code', { exact: false })).toBeVisible({ timeout: 5000 });
    await expect(transformationPage.shareImageButton).not.toBeVisible();

    // 8. Test valid OTP verification -> restores Share Image button
    await transformationPage.enterUnifiedOtp('1234');
    await expect(transformationPage.shareImageButton).toBeVisible({ timeout: 10000 });
    await expect(transformationPage.unifiedOtpInput).not.toBeVisible();
  });

  test('TR-005 Search Team Members by Health Issue, by User Name, and Trigger Data Refresh', async ({ page }) => {
    let refreshCount = 0;

    // Track refresh count on coach endpoint
    await page.route('**/api/testimonials/*coach*', async (route) => {
      refreshCount++;
      const url = new URL(route.request().url());
      const search = (url.searchParams.get('search') || '').toLowerCase().trim();
      const healthIssue = (url.searchParams.get('healthIssue') || '').toLowerCase().trim();

      let members = [...MOCK_TEAM_MEMBERS_DIRECT];
      if (search) {
        members = members.filter((m) => (m.user?.userName || '').toLowerCase().includes(search));
      }
      if (healthIssue) {
        members = members.filter((m) =>
          (m.testimonial?.recoveredHealthIssues || []).some(
            (issue) =>
              issue.toLowerCase().includes(healthIssue) || healthIssue.includes(issue.toLowerCase())
          )
        );
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: members,
          members: members,
          pagination: { total: members.length, page: 1, hasMore: false },
          uploadCounts: { fully_uploaded: 1, partial_upload: 1, not_uploaded: 1 },
        }),
      });
    });

    const transformationPage = new TransformationPage(page);

    // Switch to Direct Team
    await transformationPage.selectScope('direct');

    const priyaCardName = page.locator('p.font-semibold').filter({ hasText: 'Priya Sharma' });
    const karthikCardName = page.locator('p.font-semibold').filter({ hasText: 'Karthik Raja' });

    // Both Priya and Karthik initially visible
    await expect(priyaCardName).toBeVisible({ timeout: 10000 });
    await expect(karthikCardName).toBeVisible();

    // Search by Health Issue: "Diabetes"
    await transformationPage.searchByHealthIssue('Diabetes');
    await expect(karthikCardName).toBeVisible({ timeout: 5000 });
    await expect(priyaCardName).not.toBeVisible();

    // Clear Health Issue search -> both visible
    await transformationPage.clearIssueSearch();
    await expect(priyaCardName).toBeVisible({ timeout: 5000 });
    await expect(karthikCardName).toBeVisible();

    // Search by Name: "Priya"
    await transformationPage.searchByName('Priya');
    await expect(priyaCardName).toBeVisible({ timeout: 5000 });
    await expect(karthikCardName).not.toBeVisible();

    // Clear Name search -> both visible
    await transformationPage.clearNameSearch();
    await expect(karthikCardName).toBeVisible({ timeout: 5000 });

    // Click Header Refresh Button -> triggers server reload
    const countBefore = refreshCount;
    await transformationPage.clickRefresh();
    await expect.poll(() => refreshCount).toBeGreaterThan(countBefore);
  });

  test('TR-006 Result Video Photo Restriction Mode - Rejects Photo Uploads with Error Banner', async ({ page }) => {
    const transformationPage = new TransformationPage(page);
    const photoPath = path.resolve(__dirname, '../../fixtures/portrait.jpg');

    // 1. Attempt to upload a photo into the Health Video slot
    await transformationPage.uploadHealthVideo(photoPath);

    // 2. Assert photo restriction error banner is visible with strict warning
    await expect(
      page.getByText('Only video files are allowed for results. Photos and images are not allowed.')
    ).toBeVisible({ timeout: 5000 });

    // 3. Ensure no play button or uploaded state is created
    await expect(transformationPage.playHealthVideoButton).not.toBeVisible();

    // 4. Attempt to upload a photo into the Business Video slot
    await transformationPage.uploadBusinessVideo(photoPath);

    // 5. Assert error message is still displayed and no business play button
    await expect(
      page.getByText('Only video files are allowed for results. Photos and images are not allowed.')
    ).toBeVisible({ timeout: 5000 });
    await expect(transformationPage.playBusinessVideoButton).not.toBeVisible();
  });

  test('TR-007 Valid Result Video Upload Shows Preview and Triggers Dirty State', async ({ page }) => {
    const transformationPage = new TransformationPage(page);
    const videoPath = path.resolve(__dirname, '../../fixtures/sample-result-video.mp4');

    // Initially clean state: Share Image button is visible
    await expect(transformationPage.shareImageButton).toBeVisible({ timeout: 10000 });

    // Upload valid MP4 video into Health Video slot
    await transformationPage.uploadHealthVideo(videoPath);

    // Assert video preview / play button appears
    await expect(
      page.locator('button[aria-label="Replace health video"]')
        .or(transformationPage.playHealthVideoButton)
        .first()
    ).toBeVisible({ timeout: 10000 });

    // Assert Share button disappears and Submit for Approval appears (dirty state)
    await expect(transformationPage.shareImageButton).not.toBeVisible();
    await expect(transformationPage.submitForApprovalButton).toBeVisible();
  });

  test('TR-008 Result Video Playback in Mine Scope - Play and Close Modal', async ({ page }) => {
    currentTestimonial.healthVideoUrl = 'https://example.com/videos/coach-health.mp4';
    currentTestimonial.videoStatus = 'verified';

    const transformationPage = new TransformationPage(page);
    await transformationPage.clickRefresh();

    // Verify Play Health Results button is visible
    await expect(transformationPage.playHealthVideoButton.first()).toBeVisible({ timeout: 5000 });

    // Open video playback modal
    await transformationPage.playHealthVideo();

    // Verify modal dialog is open with embedded video
    await expect(transformationPage.videoModal.first()).toBeVisible();
    await expect(transformationPage.videoModal.locator('video').first()).toBeVisible();

    // Close modal and verify it is dismissed
    await transformationPage.closeVideoModal();
  });

  test('TR-009 Result Video Playback in Direct Team Scope - Priya Sharma Video Play and Close', async ({ page }) => {
    const transformationPage = new TransformationPage(page);

    // Switch to Direct Team
    await transformationPage.selectScope('direct');

    // Priya Sharma has verified health video
    await expect(page.locator('p.font-semibold').filter({ hasText: 'Priya Sharma' })).toBeVisible({ timeout: 10000 });

    // Play Health Results button on Priya's card
    const playBtn = page.locator('div').filter({ hasText: 'Priya Sharma' })
      .locator('button[aria-label="Play Health Results"]')
      .or(transformationPage.playHealthVideoButton);
    await expect(playBtn.first()).toBeVisible({ timeout: 5000 });
    await playBtn.first().click();

    // Verify Video Player Modal is open with embedded video
    await expect(transformationPage.videoModal.first()).toBeVisible();
    await expect(transformationPage.videoModal.locator('video').first()).toBeVisible();

    // Close Video Modal and verify it closes
    await transformationPage.closeVideoModal();
  });

  test('TR-010 Result Video Playback in Full Team Scope - Suresh Kumar Video Play and Close', async ({ page }) => {
    const transformationPage = new TransformationPage(page);

    // Switch to Full Team
    await transformationPage.selectScope('full');

    // Suresh Kumar has verified health video
    await expect(page.locator('p.font-semibold').filter({ hasText: 'Suresh Kumar' })).toBeVisible({ timeout: 10000 });

    // Play Health Results button on Suresh's card
    const playBtn = page.locator('div').filter({ hasText: 'Suresh Kumar' })
      .locator('button[aria-label="Play Health Results"]')
      .or(transformationPage.playHealthVideoButton);
    await expect(playBtn.first()).toBeVisible({ timeout: 5000 });
    await playBtn.first().click();

    // Verify Video Player Modal is open with embedded video
    await expect(transformationPage.videoModal.first()).toBeVisible();
    await expect(transformationPage.videoModal.locator('video').first()).toBeVisible();

    // Close Video Modal and verify it closes
    await transformationPage.closeVideoModal();
  });

  test('TR-011 Inside-Card Health Issue Search & Multi-Select Autocomplete - Add and Remove Conditions', async ({ page }) => {
    const transformationPage = new TransformationPage(page);

    // Initial state: Card shows existing health issues ('Thyroid', 'Overweight') and Share Image is visible
    await expect(page.locator('span').filter({ hasText: 'Thyroid' }).first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('span').filter({ hasText: 'Overweight' }).first()).toBeVisible();
    await expect(transformationPage.shareImageButton).toBeVisible();

    // 1. Click the inside-card input to reveal the dropdown suggestions
    await transformationPage.cardHealthIssuesInput.click();

    // 2. Verify dropdown list opens showing preset conditions matching user screenshot (Diabetes Type 2, Pre-Diabetes, High Blood Pressure, High Cholesterol, Fatty Liver)
    const dropdown = page.locator('div.absolute.z-50');
    await expect(dropdown).toBeVisible({ timeout: 5000 });
    await expect(dropdown.getByText('Diabetes Type 2', { exact: false }).first()).toBeVisible();
    await expect(dropdown.getByText('Pre-Diabetes', { exact: false }).first()).toBeVisible();
    await expect(dropdown.getByText('High Blood Pressure', { exact: false }).first()).toBeVisible();
    await expect(dropdown.getByText('High Cholesterol', { exact: false }).first()).toBeVisible();
    await expect(dropdown.getByText('Fatty Liver', { exact: false }).first()).toBeVisible();

    // 3. Search for "Fatty Liver" by typing into the input
    await transformationPage.cardHealthIssuesInput.fill('Fatty Liver');
    const fattyLiverOption = dropdown.locator('button').filter({ hasText: 'Fatty Liver' });
    await expect(fattyLiverOption.first()).toBeVisible({ timeout: 5000 });

    // 4. Click the option to add it
    await fattyLiverOption.first().click();

    // 5. Verify the new chip "Fatty Liver" appears in the card
    const fattyLiverChip = page.locator('span').filter({ hasText: 'Fatty Liver' });
    await expect(fattyLiverChip.first()).toBeVisible({ timeout: 5000 });

    // 6. Assert dirty state is triggered: Share button is hidden, and Submit for Approval is visible
    await expect(transformationPage.shareImageButton).not.toBeVisible();
    await expect(transformationPage.submitForApprovalButton).toBeVisible();

    // 7. Remove the newly added chip using its [X] remove button
    await transformationPage.removeCardHealthIssue('Fatty Liver');
    await expect(fattyLiverChip).not.toBeVisible();
  });

  test('TR-012 Upload Completeness Filter Chips - Filter by Fully Uploaded, Partial, and Not Uploaded', async ({ page }) => {
    const transformationPage = new TransformationPage(page);

    // Switch to Direct Team scope
    await transformationPage.selectScope('direct');

    const priyaCard = page.locator('p.font-semibold').filter({ hasText: 'Priya Sharma' });
    const karthikCard = page.locator('p.font-semibold').filter({ hasText: 'Karthik Raja' });
    const ananyaCard = page.locator('p.font-semibold').filter({ hasText: 'Ananya Verma' });

    // Initial state: all 3 members visible
    await expect(priyaCard).toBeVisible({ timeout: 10000 });
    await expect(karthikCard).toBeVisible();
    await expect(ananyaCard).toBeVisible();

    // 1. Filter by "Fully Uploaded"
    await transformationPage.filterFullyUploadedChip.click();
    await expect(priyaCard).toBeVisible({ timeout: 5000 });
    await expect(karthikCard).not.toBeVisible();
    await expect(ananyaCard).not.toBeVisible();

    // Toggle off "Fully Uploaded" -> all 3 visible again
    await transformationPage.filterFullyUploadedChip.click();
    await expect(priyaCard).toBeVisible({ timeout: 5000 });
    await expect(karthikCard).toBeVisible();
    await expect(ananyaCard).toBeVisible();

    // 2. Filter by "Partial"
    await transformationPage.filterPartialChip.click();
    await expect(karthikCard).toBeVisible({ timeout: 5000 });
    await expect(priyaCard).not.toBeVisible();
    await expect(ananyaCard).not.toBeVisible();

    // 3. Filter by "Not Uploaded"
    await transformationPage.filterNotUploadedChip.click();
    await expect(ananyaCard).toBeVisible({ timeout: 5000 });
    await expect(priyaCard).not.toBeVisible();
    await expect(karthikCard).not.toBeVisible();
  });

  test('TR-013 Mandatory Health Issue Validation - Block Photo Submission when Zero Issues Selected', async ({ page }) => {
    const transformationPage = new TransformationPage(page);
    const photoPath = path.resolve(__dirname, '../../fixtures/portrait.jpg');

    // Remove existing issues so list is completely empty
    await transformationPage.removeCardHealthIssue('Thyroid');
    await transformationPage.removeCardHealthIssue('Overweight');

    // Upload a new Before photo to make photos dirty
    await transformationPage.beforePhotoInput.setInputFiles(photoPath);
    await page.waitForTimeout(1000);

    // Click Submit for Approval
    await transformationPage.clickSubmitForApproval();

    // Assert validation error banner is displayed
    await expect(
      page.getByText('Add at least one Health Issue before submitting before + after photos.')
    ).toBeVisible({ timeout: 5000 });
  });

  test('TR-014 Inline Weight Editing - Dynamically Recalculates Lost Weight Badge Live', async ({ page }) => {
    const transformationPage = new TransformationPage(page);

    // Initial state: Before = 85 kg, After = 70 kg -> Diff = 15.0 kgs
    await expect(page.getByText(/Lost 15(\.0)? kgs/i)).toBeVisible({ timeout: 10000 });

    // Click Edit After Weight
    await transformationPage.editAfterWeightButton.click();
    const afterWeightInput = page.locator('input[inputmode="decimal"]').first();
    await expect(afterWeightInput).toBeVisible({ timeout: 5000 });

    // Change After Weight to 75 kg -> Diff becomes |75 - 85| = 10.0 kgs
    await afterWeightInput.fill('75');

    // Assert badge recalculates live to "Lost 10.0 kgs"
    await expect(page.getByText(/Lost 10(\.0)? kgs/i)).toBeVisible({ timeout: 5000 });

    // Press Enter to commit after weight
    await afterWeightInput.press('Enter');

    // Now edit Before Weight
    await transformationPage.editBeforeWeightButton.click();
    const beforeWeightInput = page.locator('input[inputmode="decimal"]').first();
    await expect(beforeWeightInput).toBeVisible({ timeout: 5000 });

    // Change Before Weight to 90 kg -> Diff becomes |75 - 90| = 15.0 kgs
    await beforeWeightInput.fill('90');
    await expect(page.getByText(/Lost 15(\.0)? kgs/i)).toBeVisible({ timeout: 5000 });
    await beforeWeightInput.press('Enter');
  });

  test('TR-015 Resend OTP Flow - Dispatches New OTP to Sponsor and Displays Confirmation', async ({ page }) => {
    // Configure testimonial in expired OTP state
    currentTestimonial = {
      ...MOCK_MEMBER_TESTIMONIAL_PENDING,
      otpExpired: true,
      hasPendingOtp: true,
      status: 'pending',
    };

    const transformationPage = new TransformationPage(page);
    await transformationPage.clickRefresh();

    // Verify expired warning appears
    await expect(
      page.getByText('This OTP has expired. Resend a new code to Master Coach.')
    ).toBeVisible({ timeout: 10000 });

    // Verify "Resend OTP to Master Coach" button is visible
    const resendBtn = page.getByRole('button', { name: /Resend OTP to Master Coach/i });
    await expect(resendBtn).toBeVisible();

    // Click Resend OTP
    await resendBtn.click();

    // Assert confirmation info message is displayed
    await expect(
      page.getByText('New OTP sent to Master Coach. Valid for 24 hours.')
    ).toBeVisible({ timeout: 5000 });

    // Verify OTP input and Verify button are restored
    await expect(transformationPage.unifiedOtpInput).toBeVisible({ timeout: 5000 });
    await expect(transformationPage.verifyWithOtpButton).toBeVisible();
  });
});
