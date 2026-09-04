import * as repo from './food-corrections.repository.js';
import { identifyFoodType } from '../../utils/foodTypeDetection.js';
import { cache, cacheKeys } from '../../utils/cache.js';
import { buildGlobalCorrections } from './global-corrections.service.js';
import { getUserTimezoneIana } from '../user/domain/userTimezone.js';
import {
  resolveRequestedDateYmd,
  assertNotFutureDateYmd,
  nowUtc,
  resolveFoodTimestamp,
} from '../../shared/lib/datetime/index.js';
import { isEnabled } from '../../shared/lib/feature-flags.js';
import {
  listMasterSearchItems,
  NUTRITION_KEYS,
  pickNutrition,
  foodNameMatchesQuery,
  sortByFoodNameMatch,
} from '../nutrition-knowledge/index.js';
import logger from '../../shared/lib/logger.js';
import { ValidationError } from '../../shared/lib/ValidationError.js';
import { getSupabaseClient } from '../../utils/supabaseClient.js';
import { assertViewerCanAccessMember } from '../../utils/reportingHierarchyService.js';
import {
  injectGlycemicIndexIntoAnalysisData,
  resolveGlycemicIndexForUpdate,
} from './glycemicIndex.helpers.js';
import {
  emptyMealTotalsSeed,
  addMealRowToTotals,
  roundMealTotals,
} from './domain/meal-totals.js';
import { MAX_STATS_RANGE_DAYS } from './food-corrections.validators.js';
import { isHerbalifeProductSuggestionName } from '../food-suggestions/domain/foodPairs.rules.js';

function filterRegularFoodSearchItems(items) {
  return (items || []).filter((item) => !isHerbalifeProductSuggestionName(item?.name));
}

function inclusiveDayCount(startDate, endDate) {
  const a = Date.parse(`${startDate}T00:00:00Z`);
  const b = Date.parse(`${endDate}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.floor((b - a) / 86_400_000) + 1;
}

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
  const currentTime = nowUtc();
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
      .filter((f) => foodNameMatchesQuery(f.name || '', lowerTerm))
      .map((f) => {
        const nutrition = pickNutrition(f.nutrition || f);
        const weight_g = f.weight_g != null ? Math.round(f.weight_g) : 100;
        // Flat macros for backward-compatible clients + full nutrition blob.
        const flat = {};
        for (const key of NUTRITION_KEYS) {
          if (nutrition[key] == null) continue;
          flat[key] = key === 'calories' || key === 'protein' || key === 'carbs'
            || key === 'fat' || key === 'fiber'
            ? Math.round(Number(nutrition[key]))
            : Number(nutrition[key]);
        }
        return {
          name: (f.name || '').trim(),
          weight_g,
          source: 'history',
          ...flat,
          nutrition: Object.keys(nutrition).length ? nutrition : {
            calories: flat.calories ?? null,
            protein: flat.protein ?? null,
            carbs: flat.carbs ?? null,
            fat: flat.fat ?? null,
            fiber: flat.fiber ?? null,
          },
        };
      });
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
  const trimmed = String(searchTerm || '').trim();
  const lowerTerm = trimmed.toLowerCase();

  // Single-letter typeahead: master/seeds only. History ILIKE on AnalysisData
  // JSON for "%y%" is slow and rarely useful for autocomplete.
  if (trimmed.length === 1) {
    const masterItems = isEnabled('ff.nutrition-knowledge')
      ? await listMasterSearchItems(trimmed).catch(() => [])
      : [];
    return {
      httpStatus: 200,
      body: {
        success: true,
        masterItems: filterRegularFoodSearchItems(
          sortByFoodNameMatch(masterItems || [], trimmed),
        ),
        myItems: [],
        communityItems: [],
      },
    };
  }

  let [myRows, communityRows, masterItems] = await Promise.all([
    repo.searchUserMeals(userId, trimmed),
    repo.searchCommunityMeals(userId, trimmed),
    isEnabled('ff.nutrition-knowledge')
      ? listMasterSearchItems(trimmed).catch(() => [])
      : Promise.resolve([]),
  ]);

  // Typo recall: if exact ILIKE miss, re-query with a 2-char prefix and
  // let foodNameMatchesQuery filter (e.g. "omlette" → "omelette").
  if (
    myRows.length === 0
    && communityRows.length === 0
    && trimmed.length >= 3
  ) {
    const prefix = trimmed.slice(0, 2);
    [myRows, communityRows] = await Promise.all([
      repo.searchUserMeals(userId, prefix),
      repo.searchCommunityMeals(userId, prefix),
    ]);
  }

  return {
    httpStatus: 200,
    body: {
      success: true,
      masterItems: filterRegularFoodSearchItems(
        sortByFoodNameMatch(masterItems || [], trimmed),
      ),
      myItems: filterRegularFoodSearchItems(
        sortByFoodNameMatch(dedupItems(myRows, lowerTerm), trimmed),
      ),
      communityItems: filterRegularFoodSearchItems(
        sortByFoodNameMatch(dedupItems(communityRows, lowerTerm), trimmed),
      ),
    },
  };
}

// ─── update meal analysis ───────────────────────────────────────────────────
export async function updateAnalysis(input) {
  const {
    id, userId, analysisData: rawAnalysisData,
    totalCalories, totalProtein, totalCarbs, totalFat, totalFiber,
    totalSugar, totalSodium, totalCholesterol, glycemicIndex,
    totalVitaminA, totalVitaminC, totalVitaminD, totalVitaminE, totalVitaminK,
    totalVitaminB1, totalVitaminB2, totalVitaminB3, totalVitaminB6, totalVitaminB9, totalVitaminB12,
    totalCalcium, totalIron, totalMagnesium, totalPotassium, totalZinc, totalPhosphorus,
  } = input;

  // Resolve GI: request body → AnalysisData JSON → existing DB column (never wipe on portion edit)
  let { resolvedGi, source } = resolveGlycemicIndexForUpdate({
    glycemicIndex,
    analysisData: rawAnalysisData,
    existingGlycemicIndex: null,
  });

  if (resolvedGi == null) {
    let existingGi = null;
    try {
      existingGi = await repo.fetchMealGlycemicIndex(id, userId);
    } catch (err) {
      logger.warn('updateAnalysis: failed to load existing GlycemicIndex', {
        mealId: id,
        error: err?.message,
      });
    }
    ({ resolvedGi, source } = resolveGlycemicIndexForUpdate({
      glycemicIndex,
      analysisData: rawAnalysisData,
      existingGlycemicIndex: existingGi,
    }));
    if (source === 'existing') {
      logger.info('updateAnalysis: preserving existing GlycemicIndex after edit', {
        mealId: id,
        glycemicIndex: resolvedGi,
      });
    }
  }

  if (resolvedGi == null) {
    logger.warn('updateAnalysis: glycemicIndex missing at all stages', {
      mealId: id,
      hadTopLevel: glycemicIndex != null,
      hadAnalysisTotal: rawAnalysisData?.total?.glycemic_index != null,
    });
  }

  const analysisData = resolvedGi != null
    ? injectGlycemicIndexIntoAnalysisData(rawAnalysisData, resolvedGi)
    : rawAnalysisData;

  const currentTime = nowUtc();
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
  if (resolvedGi       != null) updatePayload.GlycemicIndex     = resolvedGi;
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

  try {
    const { recordMealFoodPairs } = await import('../food-suggestions/index.js');
    await recordMealFoodPairs({ userId, analysisData });
  } catch (err) {
    logger.warn('updateAnalysis: food pair stats skipped', { err: err?.message, mealId: id });
  }

  return {
    httpStatus: 200,
    body: {
      success: true, message: 'Meal updated successfully',
      data: {
        id, analysisData,
        glycemicIndex: resolvedGi,
        nutrition: {
          calories: totalCalories || 0, protein: totalProtein || 0, carbs: totalCarbs || 0,
          fat: totalFat || 0, fiber: totalFiber || 0,
          glycemic_index: resolvedGi,
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

export async function getStats({
  userId,
  date,
  detailed,
  totalsOnly = false,
  startDate = null,
  endDate = null,
  maxRangeDays = MAX_STATS_RANGE_DAYS,
  viewerUserId = null,
}) {
  if (userId === 'DEMO_USER') {
    return { httpStatus: 200, body: demoStatsResponse() };
  }

  await assertViewerCanAccessMember(getSupabaseClient(), viewerUserId, userId);

  const timezoneIana = await getUserTimezoneIana(userId);

  // Inclusive range totals for home carousel / charts (1 HTTP instead of N days).
  if (startDate && endDate && totalsOnly) {
    const resolvedStart = resolveRequestedDateYmd(startDate, timezoneIana);
    const resolvedEnd = resolveRequestedDateYmd(endDate, timezoneIana);
    assertNotFutureDateYmd(resolvedEnd, timezoneIana);
    if (resolvedStart > resolvedEnd) {
      throw new ValidationError(400, 'startDate must be on or before endDate');
    }
    const dayCount = inclusiveDayCount(resolvedStart, resolvedEnd);
    if (dayCount > maxRangeDays) {
      throw new ValidationError(400, `Date range cannot exceed ${maxRangeDays} days`);
    }

    const totalRows = await repo.fetchMealTotalsForRange(
      userId,
      resolvedStart,
      resolvedEnd,
      timezoneIana,
    );
    const byDate = {};
    for (const row of totalRows) {
      let ymd;
      try {
        ymd = resolveFoodTimestamp(row.CreatedAt, timezoneIana).calendarYmd;
      } catch {
        continue;
      }
      if (!byDate[ymd]) byDate[ymd] = emptyMealTotalsSeed();
      byDate[ymd] = addMealRowToTotals(byDate[ymd], row);
    }
    for (const ymd of Object.keys(byDate)) {
      byDate[ymd] = roundMealTotals(byDate[ymd]);
    }

    return {
      httpStatus: 200,
      body: {
        success: true,
        data: [],
        byDate,
        queryInfo: {
          userId,
          startDate: resolvedStart,
          endDate: resolvedEnd,
          recordCount: totalRows.length,
          dayCount,
          totalsOnly: true,
        },
      },
    };
  }

  if (detailed && date) {
    const resolvedDate = resolveRequestedDateYmd(date, timezoneIana);
    assertNotFutureDateYmd(resolvedDate, timezoneIana);

    // Calorie-trend / charts: numeric columns only — no AnalysisData or images
    if (totalsOnly) {
      const totalRows = await repo.fetchMealTotalsForDate(userId, resolvedDate, timezoneIana);
      const dailyTotals = roundMealTotals(
        totalRows.reduce((t, r) => addMealRowToTotals(t, r), emptyMealTotalsSeed()),
      );
      return {
        httpStatus: 200,
        body: {
          success: true,
          data: [],
          dailyTotals,
          queryInfo: { userId, date: resolvedDate, recordCount: totalRows.length, totalsOnly: true },
        },
      };
    }

    const meals = await repo.fetchMealsForDate(userId, resolvedDate, timezoneIana);
    const filtered = meals.filter((record) => {
      try {
        const data = JSON.parse(record.AnalysisData);
        return Array.isArray(data.foods) && data.foods.length > 0;
      } catch { return true; }
    });
    const dailyTotals = roundMealTotals(
      filtered.reduce((t, r) => addMealRowToTotals(t, r), emptyMealTotalsSeed()),
    );

    return {
      httpStatus: 200,
      body: {
        success: true,
        data: filtered,
        dailyTotals,
        queryInfo: { userId, date: resolvedDate, recordCount: filtered.length },
      },
    };
  }

  const counts = await repo.getStatsCounts(userId, timezoneIana);
  const weeklyNutrition = counts.weeklyData.reduce((t, r) => ({
    totalCalories: t.totalCalories + (r.TotalCalories || 0),
    totalProtein: t.totalProtein + (r.TotalProtein || 0),
    totalCarbs: t.totalCarbs + (r.TotalCarbs || 0),
    totalFat: t.totalFat + (r.TotalFat || 0),
    totalFiber: t.totalFiber + (r.TotalFiber || 0),
  }), { totalCalories: 0, totalProtein: 0, totalCarbs: 0, totalFat: 0, totalFiber: 0 });

  const dailyMap = {};
  counts.weeklyData.forEach((record) => {
    let d;
    try {
      d = resolveFoodTimestamp(record.CreatedAt, timezoneIana).calendarYmd;
    } catch {
      return;
    }
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

/**
 * Single meal detail — full AnalysisData for one indexed row.
 */
export async function getMealDetail({ userId, id }) {
  if (userId === 'DEMO_USER') {
    return { httpStatus: 404, body: { success: false, message: 'Not found' } };
  }
  const row = await repo.fetchMealById(userId, id);
  if (!row) {
    return { httpStatus: 404, body: { success: false, message: 'Not found' } };
  }
  return {
    httpStatus: 200,
    body: { success: true, data: row },
  };
}

/**
 * Batch meal details — one indexed query for prefetch (ids capped in validator).
 */
export async function getMealsBatch({ userId, ids }) {
  if (userId === 'DEMO_USER') {
    return { httpStatus: 200, body: { success: true, data: [] } };
  }
  const rows = await repo.fetchMealsByIds(userId, ids);
  return {
    httpStatus: 200,
    body: { success: true, data: rows },
  };
}

/**
 * Lazy meal photo — returns JSON { image } like weight/image for modal/card hydration.
 */
export async function getMealImage({ userId, id }) {
  const row = await repo.getMealImageById(userId, id);
  if (!row) {
    return { httpStatus: 404, body: { success: false, message: 'Not found' } };
  }
  return {
    httpStatus: 200,
    body: {
      success: true,
      id: row.ID,
      image: row.ImageBase64 || null,
      imagePath: row.ImagePath || null,
    },
  };
}
