/**
 * tests/page-objects/DiaryPage.js
 * Page Object Model for the Diary / Food Log Module.
 * Encapsulates feed inspection, modal dialogs, item nutrition facts, edit/delete actions,
 * and date navigation.
 */

const { expect } = require('@playwright/test');

class DiaryPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;

    // ── Feed Locators ────────────────────────────────────────────────────────
    this.timelineFeed = page.locator('[data-testid="diary-timeline"], [data-testid="diary-feed"]');
    this.emptyState = page.locator('[data-testid="diary-feed-empty"]');
    this.errorState = page.locator('[data-testid="diary-feed-error"]');
    this.foodCards = page.locator('[data-testid="diary-row-food"]');
    this.datePickerToggle = page.locator('button[aria-label="Toggle date picker"]');
    this.calendarPanel = page.locator('.grid.grid-cols-7');

    // ── Meal Details Modal (NutritionAnalysisPanel) ──────────────────────────
    this.mealModal = page.locator('div.fixed.inset-0').filter({ has: page.locator('h2') });
    this.mealModalTitle = this.mealModal.locator('h2');
    this.mealModalCloseBtn = this.mealModal.locator('button:has(svg path[d*="M6 18L18 6"])').first();
    this.mealModalDeleteBtn = this.mealModal.locator('button:has-text("Delete")');

    // ── Nutrition Facts Modal (FoodItemNutritionModal) ───────────────────────
    this.factsModal = page.locator('div[role="dialog"][aria-modal="true"]');
    this.factsModalTitle = page.locator('#food-item-nutrition-title');
    this.factsModalCloseBtn = page.locator('button[aria-label="Close nutrition facts"]');

    // ── Add Item Controls (MealAddItemForm) ──────────────────────────────────
    this.addItemBtn = page.locator('button:has-text("+ Add Item")');
    this.addItemNameInput = page.locator('input[placeholder="Food name"]');
    this.addItemQuantityInput = page.locator('input[placeholder="Quantity"]');
    this.addItemUnitSelect = page.locator('select:has(option[value="g"])');
    this.addItemSaveBtn = page.locator('button:has-text("Save Item")');
    this.addItemCancelBtn = page.locator('button:has-text("Cancel")');
    this.addItemSuggestions = page.locator('div.relative.z-20 button');

    // ── Inline Edit Controls ────────────────────────────────────────────────
    this.editSearchInput = page.locator('input[placeholder="Search to replace..."]');
    this.editGramsInput = page.locator('input[placeholder*="grams"], input[placeholder*="ml"]');
    this.closeEditBtn = page.locator('button:has-text("Close Edit")');
    this.undoDeleteBtn = page.locator('button:has-text("Undo")');

    // ── Multi-Vertical Feed Cards & Action Affordances ───────────────────────
    this.undoRow = page.locator('[data-testid="diary-undo-row"]');
    this.weightCard = page.locator('[data-testid="diary-row-weight"]');
    this.educationCard = page.locator('[data-testid="diary-row-education"]');
    this.watchCard = page.locator('[data-testid="diary-row-watch"]');
    this.goodHabitCard = page.locator('[data-testid="diary-row-good-habit"]');
    this.unknownCard = page.locator('[data-testid="diary-row-unknown"]');
    this.feedError = page.locator('[data-testid="diary-feed-error"]');
    this.retryBtn = page.locator('[data-testid="diary-feed-error"] button');
    this.teamSearchInput = page.locator('input[placeholder*="search members"]');
    this.viewMineBtn = page.locator('button:has-text("View Mine")');
    this.prevMonthBtn = page.locator('button[aria-label="Previous month"]');
    this.nextMonthBtn = page.locator('button[aria-label="Next month"]');

    // ── Team Member Profile Modal (TeamMemberProfileModal) ───────────────────
    this.memberProfileModal = page.locator('div.fixed.inset-0').filter({ hasText: 'Team Member' });
    this.memberProfileCloseBtn = this.memberProfileModal.locator('button[aria-label="Close"]');
  }

  /**
   * Performs horizontal swipe-left on a card to trigger swipe-to-delete.
   * @param {import('@playwright/test').Locator} cardLocator
   */
  async swipeDeleteCard(cardLocator) {
    await expect(cardLocator).toBeVisible({ timeout: 10000 });
    const box = await cardLocator.boundingBox();
    if (!box) {
      throw new Error('swipeDeleteCard: card has no bounding box');
    }
    // useSwipeToDelete requires a sustained horizontal drag ≥ 100px
    const y = box.y + box.height / 2;
    const startX = box.x + Math.min(box.width - 8, 280);
    const endX = Math.max(box.x + 8, startX - 160);
    await this.page.mouse.move(startX, y);
    await this.page.mouse.down();
    await this.page.mouse.move(endX, y, { steps: 12 });
    await this.page.mouse.up();
  }

  // ── Navigation & Feed Actions ──────────────────────────────────────────────

  /**
   * Freeze "today" to mock primary diary date so calendar / future-day rules
   * match fixtures (MOCK_DIARY_DATE_PRIMARY) regardless of real wall clock.
   */
  async installDiaryClock(isoDate = '2026-09-07T12:00:00.000Z') {
    if (this.page.clock?.install) {
      await this.page.clock.install({ time: new Date(isoDate) });
      return;
    }
    await this.page.addInitScript((frozenIso) => {
      const frozen = new Date(frozenIso).getTime();
      const RealDate = Date;
      class MockDate extends RealDate {
        constructor(...args) {
          if (args.length === 0) super(frozen);
          else super(...args);
        }
        static now() {
          return frozen;
        }
      }
      MockDate.parse = RealDate.parse;
      MockDate.UTC = RealDate.UTC;
      // eslint-disable-next-line no-global-assign
      Date = MockDate;
    }, isoDate);
  }

  async gotoDiary() {
    await this.installDiaryClock();
    await this.page.goto('/');
    const diaryBtn = this.page.getByRole('button', { name: 'Diary' });
    await expect(diaryBtn).toBeVisible({ timeout: 15000 });
    await diaryBtn.click();
    await expect(this.timelineFeed.or(this.feedError).or(this.emptyState)).toBeVisible({ timeout: 15000 });
  }

  getFoodCardByTitle(title) {
    return this.foodCards.filter({ hasText: title }).first();
  }

  async openMealByTitle(title) {
    const card = this.getFoodCardByTitle(title);
    await expect(card).toBeVisible({ timeout: 10000 });
    await card.click();
    await expect(this.mealModal).toBeVisible({ timeout: 10000 });
  }

  async closeMealModal() {
    await this.mealModalCloseBtn.click();
    await expect(this.mealModal).not.toBeVisible({ timeout: 5000 });
  }

  // ── Date Navigation ────────────────────────────────────────────────────────

  async openDatePicker() {
    await this.datePickerToggle.click();
    await expect(this.calendarPanel.last()).toBeVisible({ timeout: 5000 });
  }

  async selectCalendarDay(dayNumber) {
    const dayBtn = this.calendarPanel.last().locator(`button:has-text("${dayNumber}")`).first();
    await dayBtn.click();
  }

  // ── Food Item Inside Modal ─────────────────────────────────────────────────

  getFoodItemRow(name) {
    return this.mealModal.locator('div.relative.bg-white.rounded-2xl').filter({ hasText: name }).first();
  }

  async openNutritionFactsFor(name) {
    const trigger = this.page.locator(`[aria-label="View nutrition facts for ${name}"]`);
    await expect(trigger).toBeVisible({ timeout: 10000 });
    await trigger.click();
    await expect(this.factsModal).toBeVisible({ timeout: 10000 });
  }

  async closeNutritionFacts() {
    await this.factsModalCloseBtn.click();
    await expect(this.factsModal).not.toBeVisible({ timeout: 5000 });
  }

  // ── Inline Edit Actions ────────────────────────────────────────────────────

  async clickEditFoodItem(name) {
    const row = this.getFoodItemRow(name);
    const editBtn = row.locator('button[aria-label="Edit food item"]');
    await editBtn.click();
    await expect(this.editGramsInput).toBeVisible({ timeout: 5000 });
  }

  async updateFoodGrams(grams) {
    await this.editGramsInput.fill('');
    await this.editGramsInput.fill(String(grams));
    await this.page.waitForTimeout(300);
  }

  async saveInlineEdit() {
    await this.closeEditBtn.click();
    await expect(this.editGramsInput).not.toBeVisible({ timeout: 5000 });
  }

  // ── Single Item Delete & Undo ──────────────────────────────────────────────

  async clickDeleteFoodItem(name) {
    const row = this.getFoodItemRow(name);
    const deleteBtn = row.locator('button[aria-label="Delete food item"]');
    await deleteBtn.click();
  }

  async clickUndoDelete() {
    await expect(this.undoDeleteBtn).toBeVisible({ timeout: 5000 });
    await this.undoDeleteBtn.click();
  }

  // ── Add Item Flow ──────────────────────────────────────────────────────────

  async startAddItem() {
    await expect(this.addItemBtn).toBeVisible({ timeout: 5000 });
    await this.addItemBtn.click();
    await expect(this.addItemNameInput).toBeVisible({ timeout: 5000 });
  }

  async searchAndSelectFood(query, selectName) {
    await this.addItemNameInput.fill(query);
    const suggestion = this.addItemSuggestions.filter({ hasText: selectName || query }).first();
    await expect(suggestion).toBeVisible({ timeout: 8000 });
    await suggestion.click();
  }

  async saveAddItem() {
    await this.addItemSaveBtn.click();
    await expect(this.addItemNameInput).not.toBeVisible({ timeout: 5000 });
  }

  // ── Whole Meal Delete ──────────────────────────────────────────────────────

  async deleteEntireMeal() {
    await expect(this.mealModalDeleteBtn).toBeVisible({ timeout: 5000 });
    await this.mealModalDeleteBtn.click();
    await expect(this.mealModal).not.toBeVisible({ timeout: 10000 });
  }

  // ── Team Member Profile Modal ──────────────────────────────────────────────

  async openMemberProfileFromHeader(memberName) {
    const memberNameBtn = this.page.locator('h1 button[title="View profile"]').filter({ hasText: memberName });
    await expect(memberNameBtn).toBeVisible({ timeout: 10000 });
    await memberNameBtn.click();
    await expect(this.memberProfileModal).toBeVisible({ timeout: 10000 });
  }

  async closeMemberProfile() {
    await this.memberProfileCloseBtn.click();
    await expect(this.memberProfileModal).not.toBeVisible({ timeout: 5000 });
  }
}

module.exports = { DiaryPage };
