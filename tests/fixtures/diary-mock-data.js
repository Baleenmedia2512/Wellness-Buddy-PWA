/**
 * tests/fixtures/diary-mock-data.js
 * Comprehensive mock fixtures for Diary / Food Log Module E2E tests.
 * Includes complete micronutrients (vitamins & minerals) matching production screens.
 */

const MOCK_DIARY_DATE_PRIMARY = '2026-09-07';
const MOCK_DIARY_DATE_EMPTY = '2026-09-06';

// ── Complete Micronutrients for Chicken and Beef Noodles ──────────────────────
const MOCK_NOODLES_NUTRITION = {
  calories: 700,
  protein: 45,
  carbs: 80,
  available_carbohydrate: 74,
  fiber: 6,
  sugar: 8,
  fat: 30,
  sodium: 650,
  cholesterol: 75,
  glycemic_index: 60,
  // Vitamins
  vitamin_a: 120,
  vitamin_c: 15,
  vitamin_d: 2.5,
  vitamin_e: 3.2,
  vitamin_k: 25,
  vitamin_b1: 0.4,
  vitamin_b2: 0.5,
  vitamin_b3: 7.5,
  vitamin_b6: 0.8,
  vitamin_b9: 65,
  vitamin_b12: 2.1,
  // Minerals
  calcium: 180,
  iron: 4.2,
  magnesium: 55,
  potassium: 520,
  zinc: 3.8,
  phosphorus: 290,
};

const MOCK_NOODLES_FOOD_ITEM = {
  name: 'Chicken and Beef Noodles',
  portion: '1 plate (450g)',
  portionDescription: '1 plate (450g)',
  weight_g: 450,
  grams: 450,
  unit: 'g',
  isLiquid: false,
  calories: 700,
  protein: 45,
  carbs: 80,
  fat: 30,
  fiber: 6,
  sugar: 8,
  sodium: 650,
  cholesterol: 75,
  glycemic_index: 60,
  nutrition: { ...MOCK_NOODLES_NUTRITION },
  serving: {
    description: '1 plate (450g)',
    grams: 450,
    unit: 'g',
  },
};

// ── Multi-Food Items (for multi-food meal testing) ────────────────────────────
const MOCK_MULTI_FOOD_ITEMS = [
  {
    name: 'Chicken and Beef Noodles',
    portion: '1 bowl (300g)',
    portionDescription: '1 bowl (300g)',
    weight_g: 300,
    grams: 300,
    unit: 'g',
    calories: 450,
    protein: 30,
    carbs: 55,
    fat: 20,
    fiber: 4,
    sugar: 5,
    sodium: 420,
    cholesterol: 55,
    glycemic_index: 58,
    nutrition: {
      calories: 450,
      protein: 30,
      carbs: 55,
      available_carbohydrate: 51,
      fiber: 4,
      sugar: 5,
      fat: 20,
      sodium: 420,
      cholesterol: 55,
      glycemic_index: 58,
      vitamin_a: 80,
      vitamin_c: 10,
      calcium: 120,
      iron: 3.1,
      potassium: 380,
    },
    serving: { description: '1 bowl (300g)', grams: 300, unit: 'g' },
  },
  {
    name: 'Boiled Egg',
    portion: '2 large eggs (100g)',
    portionDescription: '2 large eggs (100g)',
    weight_g: 100,
    grams: 100,
    unit: 'g',
    calories: 156,
    protein: 12.6,
    carbs: 1.2,
    fat: 10.6,
    fiber: 0,
    sugar: 1.1,
    sodium: 124,
    cholesterol: 372,
    glycemic_index: 0,
    nutrition: {
      calories: 156,
      protein: 12.6,
      carbs: 1.2,
      available_carbohydrate: 1.2,
      fiber: 0,
      sugar: 1.1,
      fat: 10.6,
      sodium: 124,
      cholesterol: 372,
      glycemic_index: 0,
      vitamin_a: 148,
      vitamin_d: 2.2,
      vitamin_b12: 1.1,
      calcium: 50,
      iron: 1.2,
      potassium: 126,
    },
    serving: { description: '2 large eggs (100g)', grams: 100, unit: 'g' },
  },
  {
    name: 'Steamed Broccoli',
    portion: '1 cup (90g)',
    portionDescription: '1 cup (90g)',
    weight_g: 90,
    grams: 90,
    unit: 'g',
    calories: 94,
    protein: 2.4,
    carbs: 23.8,
    fat: 0.4,
    fiber: 2,
    sugar: 1.9,
    sodium: 106,
    cholesterol: 0,
    glycemic_index: 15,
    nutrition: {
      calories: 94,
      protein: 2.4,
      carbs: 23.8,
      available_carbohydrate: 21.8,
      fiber: 2,
      sugar: 1.9,
      fat: 0.4,
      sodium: 106,
      cholesterol: 0,
      glycemic_index: 15,
      vitamin_c: 45,
      vitamin_k: 85,
      calcium: 35,
      iron: 0.6,
      potassium: 240,
    },
    serving: { description: '1 cup (90g)', grams: 90, unit: 'g' },
  },
];

// ── Search Item Result for "+ Add Item" ──────────────────────────────────────
const MOCK_SEARCH_FOOD_ITEMS = [
  {
    name: 'Boiled Egg',
    category: 'Food',
    isLiquid: false,
    unit: 'g',
    weight_g: 50,
    portion: '1 large egg (50g)',
    calories: 78,
    protein: 6.3,
    carbs: 0.6,
    fat: 5.3,
    fiber: 0,
    sugar: 0.6,
    sodium: 62,
    cholesterol: 186,
    glycemic_index: 0,
    nutrition: {
      calories: 78,
      protein: 6.3,
      carbs: 0.6,
      available_carbohydrate: 0.6,
      fiber: 0,
      sugar: 0.6,
      fat: 5.3,
      sodium: 62,
      cholesterol: 186,
      glycemic_index: 0,
      vitamin_a: 74,
      vitamin_c: 0,
      vitamin_d: 1.1,
      calcium: 25,
      iron: 0.6,
      potassium: 63,
    },
    defaultServing: {
      description: '1 large egg (50g)',
      grams: 50,
      nutrition: { calories: 78, protein: 6.3, carbs: 0.6, fat: 5.3, fiber: 0 },
    },
    per100g: {
      calories: 156,
      protein: 12.6,
      carbs: 1.2,
      fat: 10.6,
      fiber: 0,
    },
  },
  {
    name: 'Paneer Tikka',
    category: 'Food',
    isLiquid: false,
    unit: 'g',
    weight_g: 100,
    portion: '1 serving (100g)',
    calories: 260,
    protein: 18,
    carbs: 6,
    fat: 18,
    fiber: 1.5,
    sugar: 2,
    sodium: 380,
    cholesterol: 45,
    glycemic_index: 25,
    nutrition: {
      calories: 260,
      protein: 18,
      carbs: 6,
      available_carbohydrate: 4.5,
      fiber: 1.5,
      sugar: 2,
      fat: 18,
      sodium: 380,
      cholesterol: 45,
      glycemic_index: 25,
      calcium: 320,
      iron: 1.8,
    },
    defaultServing: {
      description: '1 serving (100g)',
      grams: 100,
      nutrition: { calories: 260, protein: 18, carbs: 6, fat: 18, fiber: 1.5 },
    },
    per100g: {
      calories: 260,
      protein: 18,
      carbs: 6,
      fat: 18,
      fiber: 1.5,
    },
  },
];

// ── Complete AnalysisData JSON for Meal 101 ──────────────────────────────────
const MOCK_MEAL_101_ANALYSIS_DATA = JSON.stringify({
  foods: [MOCK_NOODLES_FOOD_ITEM],
  detailedItems: [MOCK_NOODLES_FOOD_ITEM],
  total: {
    calories: 700,
    protein: 45,
    carbs: 80,
    fat: 30,
    fiber: 6,
    sugar: 8,
    sodium: 650,
    cholesterol: 75,
    glycemic_index: 60,
  },
  nutrition: { ...MOCK_NOODLES_NUTRITION },
  name: 'Chicken and Beef Noodles',
  confidence: 'high',
});

// ── Complete AnalysisData JSON for Multi-Food Meal 201 ───────────────────────
const MOCK_MULTI_MEAL_201_ANALYSIS_DATA = JSON.stringify({
  foods: MOCK_MULTI_FOOD_ITEMS,
  detailedItems: MOCK_MULTI_FOOD_ITEMS,
  total: {
    calories: 700,
    protein: 45,
    carbs: 80,
    fat: 31,
    fiber: 6,
    sugar: 8,
    sodium: 650,
    cholesterol: 427,
    glycemic_index: 48,
  },
  nutrition: {
    calories: 700,
    protein: 45,
    carbs: 80,
    available_carbohydrate: 74,
    fiber: 6,
    sugar: 8,
    fat: 31,
    sodium: 650,
    cholesterol: 427,
    glycemic_index: 48,
  },
  name: 'Noodles, Boiled Egg, Steamed Broccoli',
  confidence: 'high',
});

// ── Primary Diary Feed (Single Meal + Afresh + Water) ────────────────────────
const MOCK_DIARY_ENTRIES_PRIMARY = [
  {
    kind: 'food',
    capturedAt: '2026-09-07T11:20:00.000Z',
    capture: { id: 'cap-101' },
    payload: {
      id: 101,
      userId: 99999,
      name: 'Chicken and Beef Noodles',
      analysisData: MOCK_MEAL_101_ANALYSIS_DATA,
      totals: {
        calories: 700,
        protein: 45,
        carbs: 80,
        fat: 30,
        fiber: 6,
        sugar: 8,
        sodium: 650,
        cholesterol: 75,
        glycemicIndex: 60,
      },
      listSummary: {
        name: 'Chicken and Beef Noodles',
        activityType: 'food',
        items: [
          {
            name: 'Chicken and Beef Noodles',
            calories: 700,
            glycemicIndex: 60,
          },
        ],
      },
    },
  },
  {
    kind: 'food',
    capturedAt: '2026-09-07T08:30:00.000Z',
    capture: { id: 'cap-102' },
    payload: {
      id: 102,
      userId: 99999,
      name: 'Afresh Energy Drink',
      processedBy: 'afresh_preset',
      totals: { calories: 5, protein: 0, carbs: 1, fat: 0, fiber: 0 },
      listSummary: {
        name: 'Afresh Energy Drink',
        activityType: 'afresh',
        scoops: 2,
        volumeMl: 250,
        items: [{ name: 'Afresh', calories: 5 }],
      },
    },
  },
  {
    kind: 'food',
    capturedAt: '2026-09-07T07:15:00.000Z',
    capture: { id: 'cap-103' },
    payload: {
      id: 103,
      userId: 99999,
      name: 'Water Intake',
      processedBy: 'water_preset',
      totals: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
      listSummary: {
        name: 'Water Intake',
        activityType: 'water',
        volumeMl: 500,
        items: [{ name: 'Water', calories: 0 }],
      },
    },
  },
];

// ── Multi-Food Meal Diary Feed ───────────────────────────────────────────────
const MOCK_DIARY_ENTRIES_MULTI = [
  {
    kind: 'food',
    capturedAt: '2026-09-07T11:20:00.000Z',
    capture: { id: 'cap-201' },
    payload: {
      id: 201,
      userId: 99999,
      name: 'Noodles, Boiled Egg, Steamed Broccoli',
      analysisData: MOCK_MULTI_MEAL_201_ANALYSIS_DATA,
      totals: {
        calories: 700,
        protein: 45,
        carbs: 80,
        fat: 31,
        fiber: 6,
        sugar: 8,
        sodium: 650,
        cholesterol: 427,
        glycemicIndex: 48,
      },
      listSummary: {
        name: 'Noodles, Boiled Egg, Steamed Broccoli',
        activityType: 'food',
        items: MOCK_MULTI_FOOD_ITEMS.map((item) => ({
          name: item.name,
          calories: item.calories,
          glycemicIndex: item.glycemic_index,
        })),
      },
    },
  },
];

// ── Multi-Vertical Mock Entries (DIARY-015 to DIARY-025) ────────────────────
const MOCK_DIARY_ENTRY_WEIGHT = {
  kind: 'weight',
  capturedAt: '2026-09-07T08:00:00.000Z',
  capture: { id: 'cap-301' },
  payload: {
    id: 301,
    userId: 99999,
    weight: 74.5,
    bmi: 24.3,
    bodyFat: 18.5,
    muscleMass: 58.2,
    bmr: 1650,
    unit: 'kg',
  },
};

const MOCK_DIARY_ENTRY_EDUCATION = {
  kind: 'education',
  capturedAt: '2026-09-07T09:30:00.000Z',
  capture: { id: 'cap-401' },
  payload: {
    id: 401,
    userId: 99999,
    topic: 'Gut Health Masterclass',
    platform: 'Zoom',
    durationMinutes: 45,
  },
};

const MOCK_DIARY_ENTRY_WATCH = {
  kind: 'watch',
  capturedAt: '2026-09-07T06:45:00.000Z',
  capture: { id: 'cap-501' },
  payload: {
    id: 501,
    userId: 99999,
    topic: 'Smartwatch Activity',
    kcal: 450,
  },
};

const MOCK_DIARY_ENTRY_GOOD_HABIT = {
  kind: 'good-habit',
  capturedAt: '2026-09-07T06:00:00.000Z',
  capture: { id: 'cap-601' },
  payload: {
    id: 601,
    userId: 99999,
    habitType: 'Morning Meditation',
    notes: '15 mins mindfulness',
  },
};

const MOCK_DIARY_ENTRY_UNKNOWN_UNRECOGNISED = {
  kind: 'unknown',
  capturedAt: '2026-09-07T12:00:00.000Z',
  capture: { id: 'cap-700' },
  payload: {
    id: 'cap-700',
    isPendingAnalysis: false,
  },
};

const MOCK_DIARY_ENTRY_UNKNOWN_NEEDS_CLASSIFY = {
  kind: 'unknown',
  capturedAt: '2026-09-07T12:05:00.000Z',
  capture: { id: 'cap-702' },
  payload: {
    id: 'cap-702',
    isPendingAnalysis: true,
  },
};

const MOCK_MEMBER_PRIYA = {
  UserId: 10002,
  UserName: 'Priya Sharma',
  Email: 'priya@example.com',
  Role: 'user',
  CoachId: 99999,
  Status: 'Active',
};

const MOCK_PRIYA_PROFILE = {
  userId: 10002,
  userName: 'Priya Sharma',
  email: 'priya@example.com',
  communityId: 'COMM-0099',
  height: '165',
  latestBmr: 1450,
  initialWeight: 75,
  initialWeightDate: '2026-01-10T00:00:00.000Z',
  latestWeight: 68,
  dietType: 'veg',
  phoneNumber: '+919876543210',
  profileComplete: true,
};

/**
 * Setup authenticated session intercepts and common profile routes.
 */
async function mockAuthenticatedDiarySession(page, options = {}) {
  const userId = options.userId || 99999;
  const userName = options.userName || 'Test Coach';
  const role = options.role || 'coach';
  const email = options.email || 'test@example.com';
  const phone = options.phone || '+917695834209';

  // Feature flags for diary
  await page.addInitScript(() => {
    localStorage.setItem('ff.diary-feed', 'true');
    localStorage.setItem('ff.diary-timeline', 'true');
  });

  // 1. Session verification & Auth State
  await page.route('**/api/user/verify-session*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        userId,
        sessionStale: false,
        user: {
          id: userId,
          UserId: userId,
          UserName: userName,
          phone,
          role,
          email,
        },
      }),
    });
  });

  await page.route('**/api/user/lookup*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        isActive: true,
        role,
        userId,
      }),
    });
  });

  await page.route('**/api/user/preferences*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true }),
    });
  });

  await page.route('**/api/user/consent*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, consentRequired: false, consentAccepted: true }),
    });
  });

  await page.route('**/api/user/status*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        setupComplete: true,
        setupSkipped: true,
        hasTeamId: true,
        hasUpline: true,
        pendingRequest: false,
        redirectTo: null,
      }),
    });
  });

  await page.route('**/api/coach/setup-status*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, isSetupComplete: true }),
    });
  });

  await page.route('**/api/user/profile*', async (route) => {
    const url = route.request().url();
    if (url.includes('priya')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: MOCK_PRIYA_PROFILE,
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
          userId,
          userName,
          email,
          phone,
          profileComplete: true,
          gender: 'Male',
          latestWeight: 72,
          currentWeight: 72,
          height: 175,
          physicalActivityLevel: 'Moderate',
          profileImage: 'https://example.com/pic.jpg',
          transformationPhotos: {
            left: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500',
            front: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500',
            right: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500',
          },
        },
      }),
    });
  });

  await page.route('**/api/user/context*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          userId,
          personalCorrections: [],
          globalPatterns: [],
          dietPreference: 'Non-Vegetarian',
          recentMeals: [],
        },
      }),
    });
  });

  // Food correction reverse lookup fallback
  await page.route('**/api/token/reverse-lookup*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, found: false }),
    });
  });

  // Weight history intercept for auto-delta comparison
  await page.route('**/api/weight/history*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: [
          { ID: 301, Weight: 74.5, CreatedAt: '2026-09-07T08:00:00.000Z' },
          { ID: 300, Weight: 75.0, CreatedAt: '2026-09-06T08:00:00.000Z' },
        ],
      }),
    });
  });

  // Team hierarchy and member search intercepts for Coach
  await page.route('**/api/team/has-members*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, hasTeamMembers: true }),
    });
  });

  await page.route('**/api/coach/team-hierarchy*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        allMembers: [MOCK_MEMBER_PRIYA],
      }),
    });
  });
}

module.exports = {
  MOCK_DIARY_DATE_PRIMARY,
  MOCK_DIARY_DATE_EMPTY,
  MOCK_NOODLES_NUTRITION,
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
};

