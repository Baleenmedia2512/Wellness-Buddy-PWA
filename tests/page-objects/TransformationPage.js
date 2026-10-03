/**
 * tests/page-objects/TransformationPage.js
 * Page Object Model for the Transformation / Testimonials Hub.
 */
const { expect } = require('@playwright/test');

class TransformationPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;

    // Navigation & Header
    this.transformationNavTab = page.getByRole('button', { name: 'Transformation', exact: true })
      .or(page.locator('button[aria-label="Testimonials"]'));
    this.refreshButton = page.locator('button[aria-label="Refresh"]');

    this.scopeMineButton = page.getByRole('button', { name: /^Mine/i });
    this.scopeDirectButton = page.getByRole('button', { name: /Direct Team/i }).or(page.getByRole('button', { name: /^Direct/i }));
    this.scopeFullButton = page.getByRole('button', { name: /Full Team/i });

    // Actions & Buttons
    this.shareImageButton = page.getByRole('button', { name: 'Share Image', exact: true });
    this.submitForApprovalButton = page.getByRole('button', { name: /Submit for Approval/i });
    this.submittingSpinner = page.locator('button:has-text("Submitting")');

    // Inline OTP Elements
    this.unifiedOtpContainer = page.locator('div:has-text("Enter OTP from your Sponsor")');
    this.unifiedOtpInput = page.locator('input[placeholder="_ _ _ _"]')
      .or(page.locator('input[inputmode="numeric"]'))
      .or(page.locator('input[data-otp="true"]'));
    this.verifyWithOtpButton = page.getByRole('button', { name: /Verify with OTP/i });
    this.resendOtpButton = page.getByRole('button', { name: /Resend OTP/i });

    // Search Inputs
    this.issueSearchInput = page.getByPlaceholder(/Search health issue/i)
      .or(page.getByRole('textbox', { name: /Search health issues/i }));
    this.nameSearchInput = page.getByPlaceholder(/Search by name/i)
      .or(page.getByRole('textbox', { name: /Search team members by name/i }));
    this.clearSearchButton = page.locator('button[aria-label="Clear search"]')
      .or(page.getByRole('button', { name: 'Clear search' }));

    // Edit Slot Buttons
    this.editDurationButton = page.getByLabel('Edit duration');
    this.editBeforeWeightButton = page.getByLabel('Edit before weight');
    this.editAfterWeightButton = page.getByLabel('Edit after weight');

    // Video Elements
    this.healthVideoInput = page.locator('input[accept*="video"]').first();
    this.businessVideoInput = page.locator('input[accept*="video"]').nth(1);
    this.videoUploadError = page.locator('p.text-amber-800').filter({ hasText: /Only video files are allowed|Video upload/i });
    this.playHealthVideoButton = page.locator('button[aria-label="Play Health Results"]');
    this.playBusinessVideoButton = page.locator('button[aria-label="Play Business Results"]');
    this.videoModal = page.locator('div[role="dialog"]').filter({ hasText: /Playing|Health Results|Business Results/i });
    this.closeVideoModalButton = page.locator('button[aria-label="Close video"]');

    // Inside-Card Health Issues Multi-Select
    this.cardHealthIssuesInput = page.getByPlaceholder(/Search health issues|Add more/i);
    this.cardHealthIssueDropdown = page.locator('div.absolute.z-50').filter({ hasText: /Diabetes|Blood Pressure|Fatty Liver/i });

    // Completeness Filter Chips
    this.filterFullyUploadedChip = page.getByRole('button', { name: /Fully Uploaded/i });
    this.filterPartialChip = page.getByRole('button', { name: /^Partial/i });
    this.filterNotUploadedChip = page.getByRole('button', { name: /Not Uploaded/i });

    // Photo Inputs & Badges
    this.beforePhotoInput = page.locator('input[aria-label="Before gallery upload"]');
    this.afterPhotoInput = page.locator('input[aria-label="After gallery upload"]');
    this.lostGainedBadge = page.locator('span').filter({ hasText: /Lost|Gained/i });
  }

  /**
   * Navigate to Transformation page via bottom / main nav tab.
   */
  async gotoTransformation() {
    await expect(this.transformationNavTab).toBeVisible({ timeout: 15000 });
    await this.transformationNavTab.click();
    // Wait for the Transformation header or card to appear
    await expect(
      this.page.locator('h1, h2, div').filter({ hasText: /Transformation|Testimonials/i }).first()
    ).toBeVisible({ timeout: 15000 });
  }

  /**
   * Switch between Mine, Direct Team, and Full Team scope.
   * @param {'mine' | 'direct' | 'full'} scope
   */
  async selectScope(scope) {
    if (scope === 'mine') {
      await this.scopeMineButton.click();
    } else if (scope === 'direct') {
      await this.scopeDirectButton.click();
    } else if (scope === 'full') {
      await this.scopeFullButton.click();
    }
    await this.page.waitForTimeout(300);
  }

  /**
   * Edit duration text on the transformation card.
   * @param {string} newDuration
   */
  async editDuration(newDuration) {
    await this.editDurationButton.click();
    const durationInput = this.page.getByPlaceholder('e.g. 3 months');
    await expect(durationInput).toBeVisible({ timeout: 5000 });
    await durationInput.fill(newDuration);
    await durationInput.press('Enter');
    await this.page.waitForTimeout(500);
  }

  /**
   * Submit changes for coach approval.
   */
  async clickSubmitForApproval() {
    await this.page.keyboard.press('Escape');
    await expect(this.submitForApprovalButton).toBeVisible({ timeout: 5000 });
    // Scroll into view and click
    await this.submitForApprovalButton.scrollIntoViewIfNeeded();
    await this.submitForApprovalButton.click();
  }

  /**
   * Enter 4-digit OTP code and verify.
   * @param {string} code
   */
  async enterUnifiedOtp(code) {
    await expect(this.unifiedOtpInput).toBeVisible({ timeout: 10000 });
    await this.unifiedOtpInput.fill(code);
    await expect(this.verifyWithOtpButton).toBeEnabled({ timeout: 5000 });
    await this.verifyWithOtpButton.click();
  }

  /**
   * Trigger header data refresh.
   */
  async clickRefresh() {
    await expect(this.refreshButton).toBeVisible();
    await this.refreshButton.click();
  }

  /**
   * Search team testimonials by health issue.
   * @param {string} issue
   */
  async searchByHealthIssue(issue) {
    await expect(this.issueSearchInput).toBeVisible();
    await this.issueSearchInput.fill(issue);
    const suggestion = this.page.locator('ul#testimonial-health-issue-suggestions li').filter({ hasText: new RegExp(issue, 'i') }).first();
    if (await suggestion.isVisible({ timeout: 1500 }).catch(() => false)) {
      await suggestion.click();
    } else {
      await this.issueSearchInput.press('Enter');
    }
    await this.page.waitForTimeout(500);
  }

  /**
   * Search team testimonials by user name.
   * @param {string} name
   */
  async searchByName(name) {
    await expect(this.nameSearchInput).toBeVisible();
    await this.nameSearchInput.fill(name);
    await this.page.waitForTimeout(500);
  }

  async clearIssueSearch() {
    const clearBtn = this.issueSearchInput.locator('..').locator('button[aria-label="Clear search"]');
    if (await clearBtn.isVisible().catch(() => false)) {
      await clearBtn.click();
    } else {
      await this.issueSearchInput.fill('');
      await this.issueSearchInput.press('Enter');
    }
    await this.page.waitForTimeout(500);
  }

  async clearNameSearch() {
    const clearBtn = this.nameSearchInput.locator('..').locator('button[aria-label="Clear search"]');
    if (await clearBtn.isVisible().catch(() => false)) {
      await clearBtn.click();
    } else {
      await this.nameSearchInput.fill('');
    }
    await this.page.waitForTimeout(500);
  }

  /**
   * Upload a file into the health video slot.
   * @param {string} filePath
   */
  async uploadHealthVideo(filePath) {
    await this.healthVideoInput.setInputFiles(filePath);
    await this.page.waitForTimeout(500);
  }

  /**
   * Upload a file into the business video slot.
   * @param {string} filePath
   */
  async uploadBusinessVideo(filePath) {
    await this.businessVideoInput.setInputFiles(filePath);
    await this.page.waitForTimeout(500);
  }

  /**
   * Play health video and verify modal opens.
   */
  async playHealthVideo() {
    await expect(this.playHealthVideoButton.first()).toBeVisible({ timeout: 5000 });
    await this.playHealthVideoButton.first().click();
    await expect(this.videoModal.first()).toBeVisible({ timeout: 5000 });
  }

  /**
   * Close the video modal.
   */
  async closeVideoModal() {
    await expect(this.closeVideoModalButton.first()).toBeVisible({ timeout: 5000 });
    await this.closeVideoModalButton.first().click();
    await expect(this.videoModal).not.toBeVisible({ timeout: 5000 });
  }

  /**
   * Remove a health issue chip from inside the card.
   * @param {string} label
   */
  async removeCardHealthIssue(label) {
    const removeBtn = this.page.locator(`button[aria-label="Remove ${label}"]`);
    await expect(removeBtn.first()).toBeVisible({ timeout: 5000 });
    await removeBtn.first().click();
    await this.page.keyboard.press('Escape');
    await this.page.waitForTimeout(300);
  }
}

module.exports = { TransformationPage };
