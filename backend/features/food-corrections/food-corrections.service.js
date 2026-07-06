import * as repo from './food-corrections.repository.js';
import { identifyFoodType } from '../../utils/foodTypeDetection.js';
import { cache, cacheKeys } from '../../utils/cache.js';
import { buildGlobalCorrections } from './global-corrections.service.js';

const { getISTTimestamp } = repo;

// ─── list user corrections ──────────────────────────────────────────────────
export async function listCorrections({ userId }) {
  const corrections = await repo.listUserCorrections(userId);
  const transformed = corrections.map((c) => ({
    id: c.Id,
    ai_detected: c.AiDetected,
    user_corrected: c.UserCorrected,
    times_corrected: c.TimesCorrected,
    created_at: c.CreatedAt,
    last_corrected: c.LastCorrected,
  }));
  return {
    httpStatus: 200,
    body: { success: true, corrections: transformed, count: transformed.length },
  };
}

// ─── save correction ────────────────────────────────────────────────────────
export async function saveCorrection(input) {
  const {
    userId, aiDetected, userCorrected,
    correctedQuantity, correctedUnit,
    correctedCalories, correctedCarbs, correctedProtein, correctedFat, correctedFiber,
  } = input;

  const correctedFoodType = identifyFoodType({ name: userCorrected, unit: correctedUnit });
  const currentTime = getISTTimestamp();
  const existing = await repo.findCorrection(userId, aiDetected, userCorrected);

  const optionalFields = {};
  if (correctedQuantity !== undefined) optionalFields.CorrectedQuantity = correctedQuantity;
  if (correctedUnit !== undefined) optionalFields.CorrectedUnit = correctedUnit;
  if (correctedFoodType !== undefined) optionalFields.CorrectedFoodType = correctedFoodType;
  if (correctedCalories !== undefined) optionalFields.CorrectedCalories = correctedCalories;
  if (correctedCarbs !== undefined) optionalFields.CorrectedCarbs = correctedCarbs;
  if (correctedProtein !== undefined) optionalFields.CorrectedProtein = correctedProtein;
  if (correctedFat !== undefined) optionalFields.CorrectedFat = correctedFat;
  if (correctedFiber !== undefined) optionalFields.CorrectedFiber = correctedFiber;

  if (existing) {
    const newCount = existing.TimesCorrected + 1;
    const updated = await repo.updateCorrection(existing.Id, {
      TimesCorrected: newCount,
      LastCorrected: currentTime,
      ...optionalFields,
    });
    await repo.touchLastActive(userId);
    return {
      httpStatus: 200,
      body: {
        success: true, message: 'Correction count updated',
        data: { id: updated?.Id, times_corrected: newCount, action: 'updated' },
      },
    };
  }

  const inserted = await repo.insertCorrection({
    UserId: userId, AiDetected: aiDetected, UserCorrected: userCorrected,
    TimesCorrected: 1, CreatedAt: currentTime, LastCorrected: currentTime,
    ...optionalFields,
  });
  await repo.touchLastActive(userId);
  return {
    httpStatus: 201,
    body: {
      success: true, message: 'Correction saved',
      data: { id: inserted?.Id, times_corrected: 1, action: 'created' },
    },
  };
}

// ─── global corrections (delegated) ─────────────────────────────────────────
export async function getGlobalCorrections({ requestingUserId }) {
  const allCorrections = await repo.listAllCorrections();
  const result = buildGlobalCorrections(allCorrections, requestingUserId);
  return { httpStatus: 200, body: result };
}

// ─── search food history ────────────────────────────────────────────────────
function extractMatchingItems(row, lowerTerm) {
  try {
    const analysis = typeof row.AnalysisData === 'string' ? JSON.parse(row.AnalysisData) : row.AnalysisData;
    const foods = analysis?.foods || [];
    return foods
      .filter((f) => (f.name || '').toLowerCase().includes(lowerTerm))
      .map((f) => ({
        name: (f.name || '').trim(),
        weight_g: f.weight_g != null ? Math.round(f.weight_g) : 100,
        calories: f.nutrition?.calories != null ? Math.round(f.nutrition.calories) : null,
        protein: f.nutrition?.protein != null ? Math.round(f.nutrition.protein) : null,
        carbs: f.nutrition?.carbs != null ? Math.round(f.nutrition.carbs) : null,
        fat: f.nutrition?.fat != null ? Math.round(f.nutrition.fat) : null,
        fiber: f.nutrition?.fiber != null ? Math.round(f.nutrition.fiber) : null,
      }));
  } catch { return []; }
}

function dedupItems(rows, lowerTerm) {
  // INVARIANT (PR-A / ADR-0003): "latest record wins" per food name.
  //
  // The repository contract MUST return `rows` ordered by `CreatedAt DESC`
  // (see `searchUserMeals` / `searchCommunityMeals`). Combined with the
  // first-seen-wins `if (!seen.has(key))` guard below, that means the FIRST
  // row processed for any given food name is the NEWEST one — exactly the
  // behaviour the Diary spec requires ("if same name exists, use the latest
  // record's nutrition").
  //
  // DO NOT change either side of this invariant without also flipping the
  // other: removing the `DESC` order in the repo OR switching this to
  // `seen.set(key, item)` unconditionally would silently start returning
  // older nutrition for repeated names. The `dedupItems_latestWins`
  // regression test in __tests__/food-corrections.service.test.js exists
  // exactly to catch that drift.
  const seen = new Map();
  for (const row of rows) {
    for (const item of extractMatchingItems(row, lowerTerm)) {
      const key = item.name.toLowerCase().trim();
      if (!seen.has(key)) seen.set(key, item);
    }
  }
  return Array.from(seen.values());
}

export async function searchFoodHistory({ userId, searchTerm }) {
  const lowerTerm = searchTerm.toLowerCase();
  const [myRows, communityRows] = await Promise.all([
    repo.searchUserMeals(userId, searchTerm),
    repo.searchCommunityMeals(userId, searchTerm),
  ]);
  return {
    httpStatus: 200,
    body: {
      success: true,
      myItems: dedupItems(myRows, lowerTerm),
      communityItems: dedupItems(communityRows, lowerTerm),
    },
  };
}

// ─── update meal analysis ───────────────────────────────────────────────────
export async function updateAnalysis(input) {
  const {
    id, userId, analysisData,
    totalCalories, totalProtein, totalCarbs, totalFat, totalFiber,
    totalSugar, totalSodium, totalCholesterol, glycemicIndex,
    totalVitaminA, totalVitaminC, totalVitaminD, totalVitaminE, totalVitaminK,
    totalVitaminB1, totalVitaminB2, totalVitaminB3, totalVitaminB6, totalVitaminB9, totalVitaminB12,
    totalCalcium, totalIron, totalMagnesium, totalPotassium, totalZinc, totalPhosphorus,
  } = input;
  const currentTime = getISTTimestamp();
  const updatePayload = {
    AnalysisData: JSON.stringify(analysisData),
    TotalCalories:    totalCalories    || 0,
    TotalProtein:     totalProtein     || 0,
    TotalCarbs:       totalCarbs       || 0,
    TotalFat:         totalFat         || 0,
    TotalFiber:       totalFiber       || 0,
    UpdatedAt:        currentTime,
  };
  // Only update extended fields when provided (undefined = not edited, keep existing DB value)
  if (totalSugar       != null) updatePayload.TotalSugar       = totalSugar;
  if (totalSodium      != null) updatePayload.TotalSodium      = totalSodium;
  if (totalCholesterol != null) updatePayload.TotalCholesterol  = totalCholesterol;
  if (glycemicIndex    != null) updatePayload.GlycemicIndex     = glycemicIndex;
  if (totalVitaminA    != null) updatePayload.TotalVitaminA     = totalVitaminA;
  if (totalVitaminC    != null) updatePayload.TotalVitaminC     = totalVitaminC;
  if (totalVitaminD    != null) updatePayload.TotalVitaminD     = totalVitaminD;
  if (totalVitaminE    != null) updatePayload.TotalVitaminE     = totalVitaminE;
  if (totalVitaminK    != null) updatePayload.TotalVitaminK     = totalVitaminK;
  if (totalVitaminB1   != null) updatePayload.TotalVitaminB1    = totalVitaminB1;
  if (totalVitaminB2   != null) updatePayload.TotalVitaminB2    = totalVitaminB2;
  if (totalVitaminB3   != null) updatePayload.TotalVitaminB3    = totalVitaminB3;
  if (totalVitaminB6   != null) updatePayload.TotalVitaminB6    = totalVitaminB6;
  if (totalVitaminB9   != null) updatePayload.TotalVitaminB9    = totalVitaminB9;
  if (totalVitaminB12  != null) updatePayload.TotalVitaminB12   = totalVitaminB12;
  if (totalCalcium     != null) updatePayload.TotalCalcium      = totalCalcium;
  if (totalIron        != null) updatePayload.TotalIron         = totalIron;
  if (totalMagnesium   != null) updatePayload.TotalMagnesium    = totalMagnesium;
  if (totalPotassium   != null) updatePayload.TotalPotassium    = totalPotassium;
  if (totalZinc        != null) updatePayload.TotalZinc         = totalZinc;
  if (totalPhosphorus  != null) updatePayload.TotalPhosphorus   = totalPhosphorus;

  const data = await repo.updateMealAnalysis(id, userId, updatePayload);
  if (data.length === 0) {
    return { httpStatus: 403, body: { success: false, message: 'Unauthorized or meal not found' } };
  }
  cache.delete(cacheKeys.nutritionMeals(userId));
  await repo.touchLastActive(userId);
  return {
    httpStatus: 200,
    body: {
      success: true, message: 'Meal updated successfully',
      data: {
        id, analysisData,
        nutrition: {
          calories: totalCalories || 0, protein: totalProtein || 0, carbs: totalCarbs || 0,
          fat: totalFat || 0, fiber: totalFiber || 0,
        },
      },
    },
  };
}

// ─── nutrition stats ────────────────────────────────────────────────────────
function demoStatsResponse() {
  return {
    success: true, meals: [], totalCalories: 0, totalProtein: 0, totalCarbs: 0,
    totalFat: 0, totalFiber: 0, mealCount: 0, weightRecords: [],
  };
}

export async function getStats({ userId, date, detailed }) {
  if (userId === 'DEMO_USER') {
    return { httpStatus: 200, body: demoStatsResponse() };
  }

  if (detailed && date) {
    const meals = await repo.fetchMealsForDate(userId, date);
    const filtered = meals.filter((record) => {
      try {
        const data = JSON.parse(record.AnalysisData);
        return Array.isArray(data.foods) && data.foods.length > 0;
      } catch { return true; }
    });
    // Source-of-truth list mirrors features/nutrition/domain/micronutrientRules.js.
    // dailyTotals key (camelCase) ↔ DB column name (PascalCase).
    const MICRO_TOTAL_FIELDS = [
      ['totalVitaminA',   'TotalVitaminA'],
      ['totalVitaminC',   'TotalVitaminC'],
      ['totalVitaminD',   'TotalVitaminD'],
      ['totalVitaminE',   'TotalVitaminE'],
      ['totalVitaminK',   'TotalVitaminK'],
      ['totalVitaminB1',  'TotalVitaminB1'],
      ['totalVitaminB2',  'TotalVitaminB2'],
      ['totalVitaminB3',  'TotalVitaminB3'],
      ['totalVitaminB6',  'TotalVitaminB6'],
      ['totalVitaminB9',  'TotalVitaminB9'],
      ['totalVitaminB12', 'TotalVitaminB12'],
      ['totalCalcium',    'TotalCalcium'],
      ['totalIron',       'TotalIron'],
      ['totalMagnesium',  'TotalMagnesium'],
      ['totalPotassium',  'TotalPotassium'],
      ['totalZinc',       'TotalZinc'],
      ['totalPhosphorus', 'TotalPhosphorus'],
    ];
    const baseSeed = {
      totalCalories: 0, totalProtein: 0, totalCarbs: 0, totalFat: 0, totalFiber: 0,
      totalSugar: 0, totalSodium: 0, totalCholesterol: 0, mealCount: 0,
    };
    const microSeed = MICRO_TOTAL_FIELDS.reduce((s, [k]) => { s[k] = 0; return s; }, {});
    const seed = { ...baseSeed, ...microSeed };
    const dailyTotals = filtered.reduce((t, r) => {
      const next = {
        totalCalories:    t.totalCalories    + (r.TotalCalories    || 0),
        totalProtein:     t.totalProtein     + (r.TotalProtein     || 0),
        totalCarbs:       t.totalCarbs       + (r.TotalCarbs       || 0),
        totalFat:         t.totalFat         + (r.TotalFat         || 0),
        totalFiber:       t.totalFiber       + (r.TotalFiber       || 0),
        totalSugar:       t.totalSugar       + (r.TotalSugar       || 0),
        totalSodium:      t.totalSodium      + (r.TotalSodium      || 0),
        totalCholesterol: t.totalCholesterol + (r.TotalCholesterol || 0),
        mealCount:        t.mealCount + 1,
      };
      for (const [statKey, dbCol] of MICRO_TOTAL_FIELDS) {
        next[statKey] = (t[statKey] || 0) + (r[dbCol] || 0);
      }
      return next;
    }, seed);
    const round2 = (n) => Math.round(n * 100) / 100;
    const roundedMicros = MICRO_TOTAL_FIELDS.reduce((acc, [statKey]) => {
      acc[statKey] = round2(dailyTotals[statKey] || 0);
      return acc;
    }, {});
    return {
      httpStatus: 200,
      body: {
        success: true,
        data: filtered,
        dailyTotals: {
          ...dailyTotals,
          totalCalories: round2(dailyTotals.totalCalories),
          totalProtein: round2(dailyTotals.totalProtein),
          totalCarbs: round2(dailyTotals.totalCarbs),
          totalFat: round2(dailyTotals.totalFat),
          totalFiber: round2(dailyTotals.totalFiber),
          totalSugar: round2(dailyTotals.totalSugar),
          totalSodium: round2(dailyTotals.totalSodium),
          totalCholesterol: round2(dailyTotals.totalCholesterol),
          ...roundedMicros,
        },
        queryInfo: { userId, date, recordCount: filtered.length },
      },
    };
  }

  const counts = await repo.getStatsCounts(userId);
  const weeklyNutrition = counts.weeklyData.reduce((t, r) => ({
    totalCalories: t.totalCalories + (r.TotalCalories || 0),
    totalProtein: t.totalProtein + (r.TotalProtein || 0),
    totalCarbs: t.totalCarbs + (r.TotalCarbs || 0),
    totalFat: t.totalFat + (r.TotalFat || 0),
    totalFiber: t.totalFiber + (r.TotalFiber || 0),
  }), { totalCalories: 0, totalProtein: 0, totalCarbs: 0, totalFat: 0, totalFiber: 0 });

  const dailyMap = {};
  counts.weeklyData.forEach((record) => {
    const d = new Date(record.CreatedAt).toISOString().split('T')[0];
    if (!dailyMap[d]) dailyMap[d] = { date: d, calories: 0, protein: 0, carbs: 0, fat: 0, meals: 0 };
    dailyMap[d].calories += record.TotalCalories || 0;
    dailyMap[d].protein += record.TotalProtein || 0;
    dailyMap[d].carbs += record.TotalCarbs || 0;
    dailyMap[d].fat += record.TotalFat || 0;
    dailyMap[d].meals += 1;
  });
  const dailyNutrition = Object.values(dailyMap).sort((a, b) => b.date.localeCompare(a.date));

  return {
    httpStatus: 200,
    body: {
      success: true, userId,
      statistics: {
        total: counts.totalCount,
        today: counts.todayCount,
        thisWeek: counts.weekCount,
        backgroundProcessed: counts.backgroundCount,
        manualProcessed: counts.totalCount - counts.backgroundCount,
      },
      weeklyNutrition, dailyNutrition,
      recentAnalyses: counts.recentAnalyses,
    },
  };
}
