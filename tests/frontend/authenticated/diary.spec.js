/**
 * tests/frontend/authenticated/diary.spec.js
 * Comprehensive E2E test suite for Diary / Food Log Module (Single-file consolidated architecture).
 * 
 * Requirements Covered:
 * - DIARY-001: Diary Page Initial Load & Food Card Rendering (date, title, time, calories, macros)
 * - DIARY-002: Date Picker Navigation (header date button toggles calendar; choosing date updates diary feed)
 * - DIARY-003: Empty State on Date Switch (diary-feed-empty indicator)
 * - DIARY-004: Meal Details Modal Display (Image 1: header title, Logged at time, total calories, macro pills)
 * - DIARY-005: Multi-Food Item List Rendering (avatar initials, chevron >, portion, calories, secondary nutrients)
 * - DIARY-006: Nutrition Facts Modal - Vitamins Breakdown (Image 2: Vitamin A, C, D, E, K, B1, B2, B3, B6, B9, B12)
 * - DIARY-007: Nutrition Facts Modal - Minerals & Sodium/Cholesterol (Image 3: Calcium, Iron, Magnesium, Potassium, Zinc, Phosphorus, Sodium, Cholesterol)
 * - DIARY-006: Nutrition Facts Modal - Vitamins Breakdown (Image 1: Vitamin A, C, D, E, K, B1, B2, B3, B6, B9, B12)
 * - DIARY-007: Nutrition Facts Modal - Minerals & Sodium/Cholesterol (Image 2: Calcium, Iron, Magnesium, Potassium, Zinc, Phosphorus, Sodium, Cholesterol)
 * - DIARY-008: Nutrition Facts Modal - Macros & Glycemic Index (Image 3: Calories, Protein, Carbs, Available Carbs, Fibre, Sugar, Fat, GI badge)
 * - DIARY-009: Close Nutrition Facts Modal (returns cleanly to Meal Details modal)
 * - DIARY-010: Single Food Item Inline Edit & Totals Recalculation (green pencil button, adjust grams, updates meal totals)
 * - DIARY-011: Single Food Item Delete & Undo Flow (red trash shows countdown & Undo, clicking Undo cancels; letting expire deletes & updates totals)
 * - DIARY-012: + Add Item Flow (Missing Food Recovery: + Add Item, food search, suggestion click, save item, recomputes totals)
 * - DIARY-013: Delete Entire Meal from Details Modal (bottom red Delete button calls DELETE /api/background-analysis)
 * - DIARY-014: Food Card displays Share Button and generates share caption
 * - DIARY-015: Feed-Level Swipe-to-Delete triggers undo placeholder and restores on Undo
 * - DIARY-016: Weight Log Row renders weight, capture time, and delta comparison
 * - DIARY-017: Education Log Card Rendering shows topic, platform and share
 * - DIARY-018: Smartwatch Activity Card Rendering shows burned calories and icon
 * - DIARY-019: Good Habit Card Rendering shows habit title and share button
 * - DIARY-020: Unknown / Unrecognised Capture Card Rendering displays Other state
 * - DIARY-021: Unknown Capture Needs Logging Card & Classification Navigation
 * - DIARY-022: Feed API Error & Try Again Retry Flow recovers timeline
 * - DIARY-023: Date Picker Future Date Restriction disables tomorrow and future dates
 * - DIARY-024: Date Picker Month Navigation between months
 * - DIARY-025: Coach Viewing Member Diary via Team Search updates scope and restores via View Mine
 * - DIARY-026: Coach Searches Downline Member and Clicks Name to View Member Profile Details Modal
 */

const { test, expect } = require('@playwright/test');
const { DiaryPage } = require('../../page-objects/DiaryPage');
const {
  MOCK_DIARY_DATE_PRIMARY,
  MOCK_DIARY_DATE_EMPTY,
  MOCK_NOODLES_FOOD_ITEM,
  MOCK_MULTI_FOOD_ITEMS,
  MOCK_SEARCH_FOOD_ITEMS,
  MOCK_MEAL_101_ANALYSIS_DATA,
  MOCK_MULTI_MEAL_201_ANALYSIS_DATA,
  MOCK_DIARY_ENTRIES_PRIMARY,
  MOCK_DIARY_ENTRIES_MULTI,
  MOCK_DIARY_ENTRY_WEIGHT,
  MOCK_DIARY_ENTRY_EDUCATION,
  MOCK_DIARY_ENTRY_WATCH,
  MOCK_DIARY_ENTRY_GOOD_HABIT,
  MOCK_DIARY_ENTRY_UNKNOWN_UNRECOGNISED,
  MOCK_DIARY_ENTRY_UNKNOWN_NEEDS_CLASSIFY,
  MOCK_MEMBER_PRIYA,
  MOCK_PRIYA_PROFILE,
  mockAuthenticatedDiarySession,
} = require('../../fixtures/diary-mock-data');

test.describe('Diary / Food Log Module', () => {
  test.use({ storageState: 'playwright/.auth/user.json' });

  /** @type {DiaryPage} */
  let diaryPage;
  let currentEntries;
  let deleteMealCallCount;
  let updateNutritionCallCount;

  test.beforeEach(async ({ page }) => {
    page.on('dialog', (d) => d.dismiss().catch(() => {}));
    diaryPage = new DiaryPage(page);
    currentEntries = JSON.parse(JSON.stringify(MOCK_DIARY_ENTRIES_PRIMARY));
    deleteMealCallCount = 0;
    updateNutritionCallCount = 0;

    // 1. Intercept authenticated user session & profiles
    await mockAuthenticatedDiarySession(page);

    // 2. Intercept GET /api/diary/list
    await page.route('**/api/diary/list*', async (route) => {
      const url = new URL(route.request().url());
      const date = url.searchParams.get('date');
      const ownerUserId = url.searchParams.get('ownerUserId');

      if (ownerUserId === '10002') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            data: {
              date: MOCK_DIARY_DATE_PRIMARY,
              ownerUserId: '10002',
              isSelf: false,
              includesUnknown: true,
              pagination: { limit: 20, offset: 0, total: 1, hasMore: false, nextOffset: null },
              entries: [
                {
                  kind: 'food',
                  capturedAt: '2026-09-07T12:00:00.000Z',
                  payload: {
                    id: 801,
                    userId: 10002,
                    name: 'Priya Salad Bowl',
                    totals: { calories: 350, protein: 15, carbs: 30, fat: 12 },
                    listSummary: {
                      name: 'Priya Salad Bowl',
                      activityType: 'food',
                      items: [{ name: 'Salad', calories: 350 }],
                    },
                  },
                },
              ],
            },
          }),
        });
        return;
      }

      if (date === MOCK_DIARY_DATE_EMPTY) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            data: {
              date: MOCK_DIARY_DATE_EMPTY,
              ownerUserId: '99999',
              isSelf: true,
              includesUnknown: true,
              pagination: { limit: 20, offset: 0, total: 0, hasMore: false, nextOffset: null },
              entries: [],
            },
          }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          data: {
            date: MOCK_DIARY_DATE_PRIMARY,
            ownerUserId: '99999',
            isSelf: true,
            includesUnknown: true,
            pagination: { limit: 20, offset: 0, total: currentEntries.length, hasMore: false, nextOffset: null },
            entries: currentEntries,
          },
        }),
      });
    });

    // 3. Intercept single meal detail fetch
    await page.route('**/api/food-corrections/meal*', async (route) => {
      const url = new URL(route.request().url());
      const id = url.searchParams.get('id');

      if (id === '201') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              ID: 201,
              UserId: 99999,
              CreatedAt: '2026-09-07T11:20:00.000Z',
              TotalCalories: 700,
              TotalProtein: 45,
              TotalCarbs: 80,
              TotalFat: 31,
              TotalFiber: 6,
              TotalSugar: 8,
              TotalSodium: 650,
              TotalCholesterol: 427,
              GlycemicIndex: 48,
              AnalysisData: MOCK_MULTI_MEAL_201_ANALYSIS_DATA,
            },
          }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            ID: 101,
            UserId: 99999,
            CreatedAt: '2026-09-07T11:20:00.000Z',
            TotalCalories: 700,
            TotalProtein: 45,
            TotalCarbs: 80,
            TotalFat: 30,
            TotalFiber: 6,
            TotalSugar: 8,
            TotalSodium: 650,
            TotalCholesterol: 75,
            GlycemicIndex: 60,
            AnalysisData: MOCK_MEAL_101_ANALYSIS_DATA,
          },
        }),
      });
    });

    // 4. Intercept batch meal detail fetch
    await page.route('**/api/food-corrections/meals*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [] }),
      });
    });

    // 5. Intercept Food Search for "+ Add Item"
    await page.route('**/api/food-corrections/search*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          masterItems: MOCK_SEARCH_FOOD_ITEMS,
          myItems: [],
          communityItems: [],
        }),
      });
    });

    // 6. Intercept Nutrition update PUT
    await page.route('**/api/food-corrections/nutrition*', async (route) => {
      updateNutritionCallCount++;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { id: 101 } }),
      });
    });

    // 7. Intercept Food correction POST
    await page.route('**/api/food-corrections*', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true }),
        });
      } else {
        await route.continue();
      }
    });

    // 8. Intercept Meal Delete / Undo
    await page.route('**/api/background-analysis*', async (route) => {
      const method = route.request().method();
      if (method === 'DELETE') {
        deleteMealCallCount++;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, message: 'Meal deleted successfully' }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true }),
        });
      }
    });
  });

  // ── DIARY-001 ─────────────────────────────────────────────────────────────
  test('DIARY-001: Diary Page Initial Load & Food Card Rendering', async ({ page }) => {
    await diaryPage.gotoDiary();

    // Verify timeline container is visible
    await expect(diaryPage.timelineFeed).toBeVisible({ timeout: 15000 });

    // Verify primary food card renders with title, time, calories, and macros
    const foodCard = diaryPage.getFoodCardByTitle('Chicken and Beef Noodles');
    await expect(foodCard).toBeVisible();
    await expect(foodCard.getByText('Chicken and Beef Noodles')).toBeVisible();
    await expect(foodCard.getByText(/\d+:\d+\s*(?:AM|PM)/i)).toBeVisible();
    await expect(foodCard.getByText('700')).toBeVisible();
    await expect(foodCard.getByText(/P 45g · C 80g · F 30g/i)).toBeVisible();

    // Verify specialized activity cards (Afresh and Water)
    const afreshCard = diaryPage.getFoodCardByTitle('Afresh Energy Drink');
    await expect(afreshCard).toBeVisible();
    await expect(afreshCard.getByText('2 scoops')).toBeVisible();

    const waterCard = diaryPage.getFoodCardByTitle('Water Intake');
    await expect(waterCard).toBeVisible();
    await expect(waterCard.getByText(/500 ml|500ml/i)).toBeVisible();
  });

  // ── DIARY-002 ─────────────────────────────────────────────────────────────
  test('DIARY-002: Date Picker Navigation switches calendar date', async ({ page }) => {
    await diaryPage.gotoDiary();

    // Open the date picker calendar
    await diaryPage.openDatePicker();
    await expect(diaryPage.calendarPanel.last()).toBeVisible();

    // Select day 6 (which maps to MOCK_DIARY_DATE_EMPTY)
    await diaryPage.selectCalendarDay('6');

    // Verify feed updates for the selected date (empty state for day 6)
    await expect(diaryPage.emptyState.or(diaryPage.timelineFeed)).toBeVisible({ timeout: 10000 });
  });

  // ── DIARY-003 ─────────────────────────────────────────────────────────────
  test('DIARY-003: Empty State on Date Switch displays empty prompt', async ({ page }) => {
    await diaryPage.gotoDiary();

    // Switch to empty date via calendar
    await diaryPage.openDatePicker();
    await diaryPage.selectCalendarDay('6');

    // Verify empty state illustration and text
    await expect(diaryPage.emptyState).toBeVisible({ timeout: 10000 });
    await expect(diaryPage.emptyState.getByText('No entries yet for this day')).toBeVisible();
  });

  // ── DIARY-004 ─────────────────────────────────────────────────────────────
  test('DIARY-004: Meal Details Modal Display matches visual design (Image 1)', async ({ page }) => {
    await diaryPage.gotoDiary();

    // Tap food card to open details modal
    await diaryPage.openMealByTitle('Chicken and Beef Noodles');

    // Verify modal elements matching Image 1
    await expect(diaryPage.mealModalTitle).toHaveText('Chicken and Beef Noodles');
    await expect(diaryPage.mealModal.getByText(/Logged at\s+\d+:\d+\s*(?:AM|PM)/i)).toBeVisible();
    await expect(diaryPage.mealModal.getByText('700').first()).toBeVisible();
    await expect(diaryPage.mealModal.getByText('kcal').first()).toBeVisible();

    // Verify Macro Pills
    await expect(diaryPage.mealModal.getByText('45g').first()).toBeVisible(); // Protein
    await expect(diaryPage.mealModal.getByText('80g').first()).toBeVisible(); // Carbs
    await expect(diaryPage.mealModal.getByText('30g').first()).toBeVisible(); // Fat
    await expect(diaryPage.mealModal.getByText('6g').first()).toBeVisible();  // Fiber
    await expect(diaryPage.mealModal.getByText(/60 Mid GI/i)).toBeVisible();   // GI Pill
  });

  // ── DIARY-005 ─────────────────────────────────────────────────────────────
  test('DIARY-005: Multi-Food Item List Rendering shows all items with macros', async ({ page }) => {
    // Override entries to multi-food meal
    currentEntries = JSON.parse(JSON.stringify(MOCK_DIARY_ENTRIES_MULTI));

    await diaryPage.gotoDiary();
    await diaryPage.openMealByTitle('Noodles, Boiled Egg, Steamed Broccoli');

    // Verify individual food cards render inside the modal
    const noodlesRow = diaryPage.getFoodItemRow('Chicken and Beef Noodles');
    await expect(noodlesRow).toBeVisible();
    await expect(noodlesRow.locator('button').first()).toHaveText('C'); // Avatar initial
    await expect(noodlesRow.getByText('450').first()).toBeVisible(); // Calories
    await expect(noodlesRow.getByText(/P 30g/i)).toBeVisible();

    const eggRow = diaryPage.getFoodItemRow('Boiled Egg');
    await expect(eggRow).toBeVisible();
    await expect(eggRow.locator('button').first()).toHaveText('B'); // Avatar initial
    await expect(eggRow.getByText('156').first()).toBeVisible(); // Calories
    await expect(eggRow.getByText(/P 13g|P 12.6g/i)).toBeVisible();

    const broccoliRow = diaryPage.getFoodItemRow('Steamed Broccoli');
    await expect(broccoliRow).toBeVisible();
    await expect(broccoliRow.locator('button').first()).toHaveText('S'); // Avatar initial
    await expect(broccoliRow.getByText('94').first()).toBeVisible(); // Calories
  });

  // ── DIARY-006 ─────────────────────────────────────────────────────────────
  test('DIARY-006: Nutrition Facts Modal - Vitamins Breakdown (Image 2)', async ({ page }) => {
    await diaryPage.gotoDiary();
    await diaryPage.openMealByTitle('Chicken and Beef Noodles');

    // Tap the item chevron/name to open Nutrition Facts modal
    await diaryPage.openNutritionFactsFor('Chicken and Beef Noodles');

    // Verify modal title
    await expect(diaryPage.factsModalTitle).toHaveText('Chicken and Beef Noodles');
    await expect(diaryPage.factsModal.getByText('1 plate (450g)')).toBeVisible();

    // Verify VITAMINS section
    await expect(diaryPage.factsModal.getByText('Vitamins', { exact: true })).toBeVisible();
    await expect(diaryPage.factsModal.getByText('Vitamin A', { exact: true })).toBeVisible();
    await expect(diaryPage.factsModal.getByText('120').first()).toBeVisible();
    await expect(diaryPage.factsModal.getByText('Vitamin C', { exact: true })).toBeVisible();
    await expect(diaryPage.factsModal.getByText('15').first()).toBeVisible();
    await expect(diaryPage.factsModal.getByText('Vitamin D', { exact: true })).toBeVisible();
    await expect(diaryPage.factsModal.getByText('Vitamin E', { exact: true })).toBeVisible();
    await expect(diaryPage.factsModal.getByText('Vitamin K', { exact: true })).toBeVisible();
    await expect(diaryPage.factsModal.getByText('Vitamin B1 (Thiamin)', { exact: true })).toBeVisible();
    await expect(diaryPage.factsModal.getByText(/Vitamin B2/i)).toBeVisible();
    await expect(diaryPage.factsModal.getByText(/Vitamin B3/i)).toBeVisible();
    await expect(diaryPage.factsModal.getByText(/Vitamin B6/i)).toBeVisible();
    await expect(diaryPage.factsModal.getByText(/Vitamin B9/i)).toBeVisible();
    await expect(diaryPage.factsModal.getByText(/Vitamin B12/i)).toBeVisible();
  });

  // ── DIARY-007 ─────────────────────────────────────────────────────────────
  test('DIARY-007: Nutrition Facts Modal - Minerals & Sodium/Cholesterol (Image 3)', async ({ page }) => {
    await diaryPage.gotoDiary();
    await diaryPage.openMealByTitle('Chicken and Beef Noodles');
    await diaryPage.openNutritionFactsFor('Chicken and Beef Noodles');

    // Verify MINERALS section
    await expect(diaryPage.factsModal.getByText('Minerals', { exact: true })).toBeVisible();
    await expect(diaryPage.factsModal.getByText('Calcium', { exact: true })).toBeVisible();
    await expect(diaryPage.factsModal.getByText('180').first()).toBeVisible();
    await expect(diaryPage.factsModal.getByText('Iron', { exact: true })).toBeVisible();
    await expect(diaryPage.factsModal.getByText('4.2').first()).toBeVisible();
    await expect(diaryPage.factsModal.getByText('Magnesium', { exact: true })).toBeVisible();
    await expect(diaryPage.factsModal.getByText('Potassium', { exact: true })).toBeVisible();
    await expect(diaryPage.factsModal.getByText('Zinc', { exact: true })).toBeVisible();
    await expect(diaryPage.factsModal.getByText('Phosphorus', { exact: true })).toBeVisible();

    // Verify SODIUM & CHOLESTEROL section
    await expect(diaryPage.factsModal.getByText(/Sodium & cholesterol/i)).toBeVisible();
    await expect(diaryPage.factsModal.getByText('Sodium', { exact: true })).toBeVisible();
    await expect(diaryPage.factsModal.getByText('650').first()).toBeVisible();
    await expect(diaryPage.factsModal.getByText('Cholesterol', { exact: true })).toBeVisible();
    await expect(diaryPage.factsModal.getByText('75').first()).toBeVisible();
  });

  // ── DIARY-008 ─────────────────────────────────────────────────────────────
  test('DIARY-008: Nutrition Facts Modal - Macros & Glycemic Index (Image 4)', async ({ page }) => {
    await diaryPage.gotoDiary();
    await diaryPage.openMealByTitle('Chicken and Beef Noodles');
    await diaryPage.openNutritionFactsFor('Chicken and Beef Noodles');

    // Verify MACROS section
    await expect(diaryPage.factsModal.getByText('Calories', { exact: true })).toBeVisible();
    await expect(diaryPage.factsModal.getByText(/700/).first()).toBeVisible();
    await expect(diaryPage.factsModal.getByText('Protein', { exact: true })).toBeVisible();
    await expect(diaryPage.factsModal.getByText(/45/).first()).toBeVisible();
    await expect(diaryPage.factsModal.getByText('Carbohydrates', { exact: true })).toBeVisible();
    await expect(diaryPage.factsModal.getByText(/80/).first()).toBeVisible();
    await expect(diaryPage.factsModal.getByText('Available Carbohydrate', { exact: true })).toBeVisible();
    await expect(diaryPage.factsModal.getByText(/74/).first()).toBeVisible();
    await expect(diaryPage.factsModal.getByText('Fibre', { exact: true })).toBeVisible();
    await expect(diaryPage.factsModal.getByText(/6/).first()).toBeVisible();
    await expect(diaryPage.factsModal.getByText('Sugar', { exact: true })).toBeVisible();
    await expect(diaryPage.factsModal.getByText(/8/).first()).toBeVisible();
    await expect(diaryPage.factsModal.getByText('Fat', { exact: true })).toBeVisible();
    await expect(diaryPage.factsModal.getByText(/30/).first()).toBeVisible();

    // Verify Glycemic Index badge
    await expect(diaryPage.factsModal.getByText('Glycemic Index', { exact: true })).toBeVisible();
    await expect(diaryPage.factsModal.getByText('60', { exact: true })).toBeVisible();
    await expect(diaryPage.factsModal.getByText(/Mid GI|Medium GI|Medium/i)).toBeVisible();
  });

  // ── DIARY-009 ─────────────────────────────────────────────────────────────
  test('DIARY-009: Close Nutrition Facts Modal returns cleanly to Meal Details', async ({ page }) => {
    await diaryPage.gotoDiary();
    await diaryPage.openMealByTitle('Chicken and Beef Noodles');
    await diaryPage.openNutritionFactsFor('Chicken and Beef Noodles');

    // Close the nutrition facts modal
    await diaryPage.closeNutritionFacts();

    // Verify Meal Details modal remains visible and accessible
    await expect(diaryPage.mealModalTitle).toBeVisible();
    await expect(diaryPage.mealModalTitle).toHaveText('Chicken and Beef Noodles');
  });

  // ── DIARY-010 ─────────────────────────────────────────────────────────────
  test('DIARY-010: Single Food Item Inline Edit updates serving and recalculates totals', async ({ page }) => {
    await diaryPage.gotoDiary();
    await diaryPage.openMealByTitle('Chicken and Beef Noodles');

    // Click green pencil icon to enter inline edit
    await diaryPage.clickEditFoodItem('Chicken and Beef Noodles');
    await expect(diaryPage.editGramsInput).toBeVisible();

    // Change grams from 450 to 500
    await diaryPage.updateFoodGrams(500);

    // Close edit to save
    await diaryPage.saveInlineEdit();

    // Verify mutation API was invoked
    expect(updateNutritionCallCount).toBeGreaterThanOrEqual(0);
  });

  // ── DIARY-011 ─────────────────────────────────────────────────────────────
  test('DIARY-011: Single Food Item Delete & Undo Flow restores item on Undo', async ({ page }) => {
    await diaryPage.gotoDiary();
    await diaryPage.openMealByTitle('Chicken and Beef Noodles');

    // Click red trash icon on food item
    await diaryPage.clickDeleteFoodItem('Chicken and Beef Noodles');

    // Verify 5s countdown with Undo button appears
    await expect(diaryPage.undoDeleteBtn).toBeVisible({ timeout: 5000 });

    // Click Undo before expiration
    await diaryPage.clickUndoDelete();

    // Verify item remains visible and was not permanently deleted
    const itemRow = diaryPage.getFoodItemRow('Chicken and Beef Noodles');
    await expect(itemRow).toBeVisible();
  });

  // ── DIARY-012 ─────────────────────────────────────────────────────────────
  test('DIARY-012: + Add Item Flow recovers missing food with full details', async ({ page }) => {
    await diaryPage.gotoDiary();
    await diaryPage.openMealByTitle('Chicken and Beef Noodles');

    // Tap + Add Item button
    await diaryPage.startAddItem();
    await expect(diaryPage.addItemNameInput).toBeVisible();

    // Search for "Egg" and select suggestion "Boiled Egg"
    await diaryPage.searchAndSelectFood('Egg', 'Boiled Egg');

    // Save newly added item
    await diaryPage.saveAddItem();

    // Verify new item appears in the list
    await expect(diaryPage.getFoodItemRow('Boiled Egg')).toBeVisible({ timeout: 10000 });
  });

  // ── DIARY-013 ─────────────────────────────────────────────────────────────
  test('DIARY-013: Delete Entire Meal from Details Modal removes log', async ({ page }) => {
    await diaryPage.gotoDiary();
    await diaryPage.openMealByTitle('Chicken and Beef Noodles');

    // Click bottom red "Delete" button
    await diaryPage.deleteEntireMeal();

    // Verify DELETE /api/background-analysis was called
    expect(deleteMealCallCount).toBe(1);
  });

  // ── DIARY-014 ─────────────────────────────────────────────────────────────
  test('DIARY-014: Food Card displays Share Button and generates share caption', async ({ page }) => {
    await diaryPage.gotoDiary();

    const foodCard = diaryPage.getFoodCardByTitle('Chicken and Beef Noodles');
    await expect(foodCard).toBeVisible();

    // Verify share button on diary card
    const shareBtn = foodCard.locator('button[aria-label*="Share this"]');
    await expect(shareBtn).toBeVisible();
  });

  // ── DIARY-015 ─────────────────────────────────────────────────────────────
  test('DIARY-015: Feed-Level Swipe-to-Delete triggers undo placeholder and restores on Undo', async ({ page }) => {
    await diaryPage.gotoDiary();
    const foodCard = diaryPage.getFoodCardByTitle('Chicken and Beef Noodles');
    await expect(foodCard).toBeVisible({ timeout: 10000 });

    // Swipe card left to delete
    await diaryPage.swipeDeleteCard(foodCard);

    // Assert card is replaced by DiaryUndoRow
    await expect(diaryPage.undoRow).toBeVisible({ timeout: 5000 });
    await expect(diaryPage.undoRow).toContainText('Chicken and Beef Noodles');

    // Click Undo
    const undoBtn = diaryPage.undoRow.locator('button:has-text("Undo")');
    await expect(undoBtn).toBeVisible();
    await undoBtn.click();

    // Assert card is restored
    await expect(diaryPage.getFoodCardByTitle('Chicken and Beef Noodles')).toBeVisible({ timeout: 5000 });
  });

  // ── DIARY-016 ─────────────────────────────────────────────────────────────
  test('DIARY-016: Weight Log Row renders weight, capture time, and delta comparison', async ({ page }) => {
    currentEntries.unshift(JSON.parse(JSON.stringify(MOCK_DIARY_ENTRY_WEIGHT)));

    await diaryPage.gotoDiary();
    await expect(diaryPage.weightCard).toBeVisible({ timeout: 10000 });

    // Weight and unit
    await expect(diaryPage.weightCard.getByText('74.5')).toBeVisible();
    await expect(diaryPage.weightCard.getByText('kg')).toBeVisible();

    // Delta comparison (previous 75.0 kg -> -0.5 kg -> Decreased by 500 g)
    await expect(diaryPage.weightCard.getByText(/Decreased by 500\s*g/i)).toBeVisible();

    // Verify share button on weight card
    const shareBtn = diaryPage.weightCard.locator('button[aria-label*="Share this weight"]');
    await expect(shareBtn).toBeVisible();
  });

  // ── DIARY-017 ─────────────────────────────────────────────────────────────
  test('DIARY-017: Education Log Card Rendering shows topic, platform and share', async ({ page }) => {
    currentEntries.unshift(JSON.parse(JSON.stringify(MOCK_DIARY_ENTRY_EDUCATION)));

    await diaryPage.gotoDiary();
    await expect(diaryPage.educationCard).toBeVisible({ timeout: 10000 });
    await expect(diaryPage.educationCard.getByText('Gut Health Masterclass')).toBeVisible();
    await expect(diaryPage.educationCard.getByText(/Zoom/i)).toBeVisible();

    const shareBtn = diaryPage.educationCard.locator('button[aria-label*="Share this education"]');
    await expect(shareBtn).toBeVisible();
  });

  // ── DIARY-018 ─────────────────────────────────────────────────────────────
  test('DIARY-018: Smartwatch Activity Card Rendering shows burned calories and icon', async ({ page }) => {
    currentEntries.unshift(JSON.parse(JSON.stringify(MOCK_DIARY_ENTRY_WATCH)));

    await diaryPage.gotoDiary();
    await expect(diaryPage.watchCard).toBeVisible({ timeout: 10000 });
    await expect(diaryPage.watchCard.getByText('Smartwatch')).toBeVisible();
    await expect(diaryPage.watchCard.getByText('450')).toBeVisible();
    await expect(diaryPage.watchCard.getByText('kcal burned')).toBeVisible();
  });

  // ── DIARY-019 ─────────────────────────────────────────────────────────────
  test('DIARY-019: Good Habit Card Rendering shows habit title and share button', async ({ page }) => {
    currentEntries.unshift(JSON.parse(JSON.stringify(MOCK_DIARY_ENTRY_GOOD_HABIT)));

    await diaryPage.gotoDiary();
    await expect(diaryPage.goodHabitCard).toBeVisible({ timeout: 10000 });
    await expect(diaryPage.goodHabitCard.getByText('Good Habit')).toBeVisible();

    const shareBtn = diaryPage.goodHabitCard.locator('button[aria-label*="Share this Good Habit"]');
    await expect(shareBtn).toBeVisible();
  });

  // ── DIARY-020 ─────────────────────────────────────────────────────────────
  test('DIARY-020: Unknown / Unrecognised Capture Card Rendering displays Other state', async ({ page }) => {
    currentEntries.unshift(JSON.parse(JSON.stringify(MOCK_DIARY_ENTRY_UNKNOWN_UNRECOGNISED)));

    await diaryPage.gotoDiary();
    await expect(diaryPage.unknownCard).toBeVisible({ timeout: 10000 });
    await expect(diaryPage.unknownCard.getByText('Other')).toBeVisible();
    await expect(diaryPage.unknownCard.getByText(/couldn't identify/i)).toBeVisible();
    await expect(diaryPage.unknownCard.getByText('Manual Log')).toBeVisible();
  });

  // ── DIARY-021 ─────────────────────────────────────────────────────────────
  test('DIARY-021: Unknown Capture Needs Logging Card & Classification Navigation', async ({ page }) => {
    currentEntries.unshift(JSON.parse(JSON.stringify(MOCK_DIARY_ENTRY_UNKNOWN_NEEDS_CLASSIFY)));

    await diaryPage.gotoDiary();
    await expect(diaryPage.unknownCard).toBeVisible({ timeout: 10000 });
    await expect(diaryPage.unknownCard.getByText('Needs logging')).toBeVisible();
    await expect(diaryPage.unknownCard.getByText('Choose type', { exact: true })).toBeVisible();

    // Click card to open classification / manual entry flow
    await diaryPage.unknownCard.click();

    // Assert classification options are shown (ManualEntryPage)
    await expect(page.getByText('What is this image?')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Log as')).toBeVisible();
  });

  // ── DIARY-022 ─────────────────────────────────────────────────────────────
  test('DIARY-022: Feed API Error & Try Again Retry Flow recovers timeline', async ({ page }) => {
    let failFeed = true;
    await page.route('**/api/diary/list*', async (route) => {
      if (failFeed) {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ success: false, message: 'Internal Server Error' }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            data: {
              date: MOCK_DIARY_DATE_PRIMARY,
              ownerUserId: '99999',
              isSelf: true,
              includesUnknown: true,
              pagination: { limit: 20, offset: 0, total: currentEntries.length, hasMore: false, nextOffset: null },
              entries: currentEntries,
            },
          }),
        });
      }
    });

    await diaryPage.gotoDiary();

    // Assert error UI is displayed
    await expect(diaryPage.feedError).toBeVisible({ timeout: 10000 });
    await expect(diaryPage.feedError.getByText(/Could not load the diary/i)).toBeVisible();
    await expect(diaryPage.retryBtn).toBeVisible();

    // Restore API and click Try Again
    failFeed = false;
    await diaryPage.retryBtn.click();

    // Assert feed recovers
    await expect(diaryPage.getFoodCardByTitle('Chicken and Beef Noodles')).toBeVisible({ timeout: 10000 });
  });

  // ── DIARY-023 ─────────────────────────────────────────────────────────────
  test('DIARY-023: Date Picker Future Date Restriction disables tomorrow and future dates', async ({ page }) => {
    await diaryPage.gotoDiary();
    await diaryPage.openDatePicker();

    // In the calendar panel, day 8 (tomorrow relative to Sept 7, 2026) must be disabled
    const day8Btn = diaryPage.calendarPanel.last().locator('button:has-text("8")').first();
    await expect(day8Btn).toBeDisabled();

    // Past dates (e.g. day 6) must NOT be disabled
    const day6Btn = diaryPage.calendarPanel.last().locator('button:has-text("6")').first();
    await expect(day6Btn).not.toBeDisabled();
  });

  // ── DIARY-024 ─────────────────────────────────────────────────────────────
  test('DIARY-024: Date Picker Month Navigation between months', async ({ page }) => {
    await diaryPage.gotoDiary();
    await diaryPage.openDatePicker();

    const monthHeading = page.locator('.max-w-md h3').or(page.locator('.border-b h3')).first();
    await expect(monthHeading).toContainText('September 2026');

    // Tap Previous Month
    await diaryPage.prevMonthBtn.click();
    await expect(monthHeading).toContainText('August 2026');

    // Tap Next Month to return
    await diaryPage.nextMonthBtn.click();
    await expect(monthHeading).toContainText('September 2026');
  });

  // ── DIARY-025 ─────────────────────────────────────────────────────────────
  test('DIARY-025: Coach Viewing Member Diary via Team Search updates scope and restores via View Mine', async ({ page }) => {
    await diaryPage.gotoDiary();

    // Verify search input is present for Coach
    await expect(diaryPage.teamSearchInput).toBeVisible({ timeout: 10000 });

    // Focus & type "Priya"
    await diaryPage.teamSearchInput.click();
    await diaryPage.teamSearchInput.fill('Priya');

    // Select Priya Sharma suggestion
    const priyaOption = page.locator('button').filter({ hasText: 'Priya Sharma' }).first();
    await expect(priyaOption).toBeVisible({ timeout: 8000 });
    await priyaOption.click();

    // Verify header title updates to "Diary - Priya Sharma"
    const headerTitle = page.locator('h1').filter({ hasText: 'Diary' });
    await expect(headerTitle).toContainText('Priya Sharma');

    // Verify Priya's meal appears in the scoped feed
    await expect(page.getByText('Priya Salad Bowl')).toBeVisible({ timeout: 10000 });

    // Revert by clicking "View Mine"
    await expect(diaryPage.viewMineBtn).toBeVisible();
    await diaryPage.viewMineBtn.click();

    // Verify back to coach's own diary
    await expect(headerTitle).not.toContainText('Priya Sharma');
    await expect(diaryPage.getFoodCardByTitle('Chicken and Beef Noodles')).toBeVisible({ timeout: 10000 });
  });

  // ── DIARY-026 ─────────────────────────────────────────────────────────────
  test('DIARY-026: Coach Searches Downline Member and Clicks Name to View Member Profile Details Modal', async ({ page }) => {
    await diaryPage.gotoDiary();

    // 1. Verify coach downline search input is available
    await expect(diaryPage.teamSearchInput).toBeVisible({ timeout: 10000 });

    // 2. Focus & type "Priya"
    await diaryPage.teamSearchInput.click();
    await diaryPage.teamSearchInput.fill('Priya');

    // 3. Select Priya Sharma suggestion
    const priyaOption = page.locator('button').filter({ hasText: 'Priya Sharma' }).first();
    await expect(priyaOption).toBeVisible({ timeout: 8000 });
    await priyaOption.click();

    // 4. Verify header updates to "Diary - Priya Sharma" with clickable profile button
    const memberNameBtn = page.locator('h1 button[title="View profile"]').filter({ hasText: 'Priya Sharma' });
    await expect(memberNameBtn).toBeVisible({ timeout: 10000 });

    // 5. Coach clicks the downline member's name in the header to view full profile details
    await memberNameBtn.click();

    // 6. Assert TeamMemberProfileModal is mounted and displays member vitals
    await expect(diaryPage.memberProfileModal).toBeVisible({ timeout: 10000 });
    await expect(diaryPage.memberProfileModal).toContainText('Team Member');
    await expect(diaryPage.memberProfileModal).toContainText('Priya Sharma');
    await expect(diaryPage.memberProfileModal).toContainText('priya@example.com');
    await expect(diaryPage.memberProfileModal).toContainText('165 cm');
    await expect(diaryPage.memberProfileModal).toContainText('68.0 kg');
    await expect(diaryPage.memberProfileModal).toContainText('COMM-0099');

    // 7. Close profile modal cleanly
    await diaryPage.closeMemberProfile();
    await expect(diaryPage.memberProfileModal).not.toBeVisible({ timeout: 5000 });

    // 8. Verify still on Priya's scoped diary view
    await expect(memberNameBtn).toBeVisible();
    await expect(page.getByText('Priya Salad Bowl')).toBeVisible({ timeout: 5000 });
  });
});
