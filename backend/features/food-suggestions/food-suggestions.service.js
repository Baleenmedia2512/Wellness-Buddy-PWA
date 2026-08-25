/**
 * food-suggestions.service.js — frequency-v1 provider.
 */
import logger from '../../shared/lib/logger.js';
import {
  listMasterSearchItems,
  pickNutrition,
  NUTRITION_KEYS,
  foodNameMatchesQuery,
} from '../nutrition-knowledge/index.js';
import * as repo from './data/food-suggestions.repo.js';
import {
  DEFAULT_LATEST_LIMIT,
  DEFAULT_SUGGESTION_LIMIT,
  MIN_GLOBAL_PAIR_COUNT,
  PERSONAL_OFTEN_WITH_MIN,
  PERSONAL_SUFFICIENT_COUNT,
  displayFoodName,
  enumerateUndirectedPairs,
  extractFoodNamesFromAnalysis,
  extractLatestFoodsFromMeals,
  isDrySaladAnalysis,
  isExcludedSuggestionName,
  mergeOftenWithPersonalFirst,
  normalizeFoodNameKey,
  partnersFromPairRows,
} from './domain/foodPairs.rules.js';
import { listApprovedCatalogNameKeys } from '../dry-salad/index.js';

export const PROVIDER_ID = 'frequency-v1';

function flattenFoodItem(name, nutritionSource, source = 'history') {
  const display = displayFoodName(name);
  const nutrition = pickNutrition(nutritionSource?.nutrition || nutritionSource || {});
  const flat = {};
  for (const key of NUTRITION_KEYS) {
    if (nutrition[key] == null) continue;
    flat[key] = ['calories', 'protein', 'carbs', 'fat', 'fiber'].includes(key)
      ? Math.round(Number(nutrition[key]))
      : Number(nutrition[key]);
  }
  const weight_g = nutritionSource?.weight_g != null
    ? Math.round(nutritionSource.weight_g)
    : 100;
  return {
    name: display,
    weight_g,
    source,
    ...flat,
    nutrition: Object.keys(nutrition).length ? nutrition : {
      calories: flat.calories ?? null,
      protein: flat.protein ?? null,
      carbs: flat.carbs ?? null,
      fat: flat.fat ?? null,
      fiber: flat.fiber ?? null,
    },
  };
}

/**
 * Record undirected pairs after a multi-food meal save. Never throws to caller.
 */
export async function recordMealFoodPairs({ userId, analysisData }) {
  try {
    if (isDrySaladAnalysis(analysisData)) return { recorded: 0 };
    const names = extractFoodNamesFromAnalysis(analysisData);
    if (names.length < 2) return { recorded: 0 };
    const pairs = enumerateUndirectedPairs(names);
    for (const p of pairs) {
      try {
        await repo.incrementGlobalPair(p.keyA, p.keyB);
      } catch (err) {
        logger.warn('food-suggestions: global pair upsert failed', { err: err?.message });
      }
      if (userId != null) {
        try {
          await repo.incrementUserPair(userId, p.keyA, p.keyB);
        } catch (err) {
          logger.warn('food-suggestions: user pair upsert failed', { err: err?.message });
        }
      }
    }
    return { recorded: pairs.length };
  } catch (err) {
    logger.warn('food-suggestions: recordMealFoodPairs skipped', { err: err?.message });
    return { recorded: 0 };
  }
}

function flattenLatestFromMeals(rows, limit, excludeKeys) {
  return extractLatestFoodsFromMeals(rows, limit, excludeKeys)
    .map((item) => flattenFoodItem(item.name, item.food, 'history'));
}

async function resolveNutritionForName(userId, name, userMealRows) {
  const key = normalizeFoodNameKey(name);
  // Prefer caller's own history (same meals used for Latest).
  for (const row of userMealRows || []) {
    let data = row.AnalysisData;
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data);
      } catch {
        continue;
      }
    }
    const foods = Array.isArray(data?.foods) ? data.foods : [];
    for (const f of foods) {
      if (normalizeFoodNameKey(f?.name || f?.foodName || '') === key) {
        return flattenFoodItem(f.name || name, f, 'history');
      }
    }
  }

  try {
    const master = await listMasterSearchItems(name);
    const hit = (master || []).find((m) => foodNameMatchesQuery(m.name || '', name))
      || (master || [])[0];
    if (hit) return flattenFoodItem(hit.name || name, hit, 'master');
  } catch {
    // master optional
  }

  return flattenFoodItem(name, { calories: null }, 'suggested');
}

/**
 * GET suggestions: latest (self) + oftenWith (personal-first, global fallback).
 */
export async function getFoodSuggestions({
  userId,
  anchor = '',
  limit = DEFAULT_SUGGESTION_LIMIT,
  exclude = [],
}) {
  const uid = String(userId);
  const [mealRows, drySaladKeys] = await Promise.all([
    repo.listRecentUserMeals(uid, 50),
    listApprovedCatalogNameKeys().catch(() => []),
  ]);
  const catalogExclude = new Set(drySaladKeys || []);
  const latest = flattenLatestFromMeals(mealRows, DEFAULT_LATEST_LIMIT, catalogExclude);

  const anchorKey = normalizeFoodNameKey(anchor);
  let oftenWith = [];

  if (anchorKey && !isExcludedSuggestionName(anchorKey, catalogExclude)) {
    const [userPairRows, globalPairRows] = await Promise.all([
      repo.listUserPairsForAnchor(uid, anchorKey).catch(() => []),
      repo.listGlobalPairsForAnchor(anchorKey, MIN_GLOBAL_PAIR_COUNT).catch(() => []),
    ]);

    const personal = partnersFromPairRows(anchorKey, userPairRows, PERSONAL_OFTEN_WITH_MIN);
    const global = partnersFromPairRows(anchorKey, globalPairRows, MIN_GLOBAL_PAIR_COUNT);
    const excludeKeys = [
      anchorKey,
      ...((exclude || []).map(normalizeFoodNameKey)),
      ...catalogExclude,
    ];

    const ranked = mergeOftenWithPersonalFirst(personal, global, {
      limit,
      excludeKeys,
      sufficientCount: PERSONAL_SUFFICIENT_COUNT,
    });

    oftenWith = await Promise.all(
      ranked.map(async (r) => {
        const item = await resolveNutritionForName(uid, r.display || r.key, mealRows);
        return {
          ...item,
          source: r.source,
          score: r.score,
        };
      }),
    );
  }

  return {
    httpStatus: 200,
    body: {
      success: true,
      latest,
      oftenWith,
      provider: PROVIDER_ID,
    },
  };
}
