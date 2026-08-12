/**
 * In-memory meal detail cache with request deduplication and prefetch.
 *
 * Flow per mealId:
 *   resolved cache → in-flight promise → fetch → store
 *
 * Module-level singleton shared by Diary timeline + NutritionDashboard.
 */

import { fetchMealDetailRow, fetchMealDetailRowsBatch } from './mealDetailApi.js';

/** @type {Map<string, object>} */
const resolvedCache = new Map();

/** @type {Map<string, Promise<object>>} */
const inFlight = new Map();

const DEFAULT_PREFETCH_CONCURRENCY = 3;
const BATCH_SIZE = 10;

function cacheKey(userId, mealId) {
  return `${String(userId)}:${String(mealId)}`;
}

/** True when AnalysisData contains usable food items. */
export function mealHasFullAnalysis(meal) {
  if (!meal?.AnalysisData) return false;
  try {
    const parsed = typeof meal.AnalysisData === 'string'
      ? JSON.parse(meal.AnalysisData)
      : meal.AnalysisData;
    const foods = parsed?.foods;
    if (Array.isArray(foods) && foods.length > 0) return true;
    const items = parsed?.detailedItems;
    return Array.isArray(items) && items.length > 0;
  } catch {
    return false;
  }
}

/** Merge diary stub metadata into a fuller cached/fetched row. */
export function mergeMealRows(primary, stub) {
  if (!primary && !stub) return null;
  if (!stub) return primary;
  if (!primary) return stub;
  return {
    ...stub,
    ...primary,
    CreatedAt: primary.CreatedAt ?? stub.CreatedAt,
    ProcessedBy: primary.ProcessedBy ?? stub.ProcessedBy,
    listSummary: stub.listSummary ?? primary.listSummary ?? null,
  };
}

export function getCachedMealDetail(userId, mealId) {
  return resolvedCache.get(cacheKey(userId, mealId)) ?? null;
}

export function seedMealDetail(userId, meal) {
  if (!userId || meal?.ID == null) return;
  if (!mealHasFullAnalysis(meal)) return;
  resolvedCache.set(cacheKey(userId, meal.ID), { ...meal });
}

export function updateMealDetailCache(userId, mealId, patch) {
  const key = cacheKey(userId, mealId);
  const prev = resolvedCache.get(key);
  if (prev) {
    resolvedCache.set(key, { ...prev, ...patch });
  } else if (patch && mealHasFullAnalysis(patch)) {
    resolvedCache.set(key, { ...patch, ID: mealId });
  }
}

export function invalidateMealDetail(userId, mealId) {
  const key = cacheKey(userId, mealId);
  resolvedCache.delete(key);
  inFlight.delete(key);
}

export function invalidateUserMealDetails(userId) {
  const prefix = `${String(userId)}:`;
  for (const key of [...resolvedCache.keys()]) {
    if (key.startsWith(prefix)) resolvedCache.delete(key);
  }
  for (const key of [...inFlight.keys()]) {
    if (key.startsWith(prefix)) inFlight.delete(key);
  }
}

function storeMeal(userId, meal) {
  if (!meal?.ID) return meal;
  resolvedCache.set(cacheKey(userId, meal.ID), { ...meal });
  return meal;
}

/**
 * Fetch one meal with deduplication. Reuses in-flight promise for same user+meal.
 */
export async function fetchMealDetailCached({
  userId,
  mealId,
  apiBaseUrl,
  signal,
}) {
  const key = cacheKey(userId, mealId);
  const cached = resolvedCache.get(key);
  if (cached && mealHasFullAnalysis(cached)) {
    return cached;
  }

  const pending = inFlight.get(key);
  if (pending) return pending;

  const promise = fetchMealDetailRow({ apiBaseUrl, userId, mealId, signal })
    .then((row) => storeMeal(userId, row))
    .finally(() => {
      inFlight.delete(key);
    });

  inFlight.set(key, promise);
  return promise;
}

async function fetchBatchAndStore({ userId, mealIds, apiBaseUrl, signal }) {
  const rows = await fetchMealDetailRowsBatch({
    apiBaseUrl,
    userId,
    mealIds,
    signal,
  });
  for (const row of rows) {
    storeMeal(userId, row);
  }
  return rows;
}

/**
 * Background prefetch with concurrency limit. Skips cached/in-flight meals.
 * Uses batch API when a worker chunk has 2+ ids.
 */
export function prefetchMealDetails({
  userId,
  mealIds,
  apiBaseUrl,
  concurrency = DEFAULT_PREFETCH_CONCURRENCY,
  priorityIds = [],
  signal,
}) {
  if (!userId || !mealIds?.length || !apiBaseUrl) {
    return Promise.resolve([]);
  }

  const unique = [...new Set(mealIds.map(String))];
  const prioritySet = new Set((priorityIds || []).map(String));
  const ordered = [
    ...unique.filter((id) => prioritySet.has(id)),
    ...unique.filter((id) => !prioritySet.has(id)),
  ];
  const toFetch = ordered.filter((id) => {
    const key = cacheKey(userId, id);
    const cached = resolvedCache.get(key);
    if (cached && mealHasFullAnalysis(cached)) return false;
    return !inFlight.has(key);
  });

  if (toFetch.length === 0) return Promise.resolve([]);

  const chunks = [];
  for (let i = 0; i < toFetch.length; i += BATCH_SIZE) {
    chunks.push(toFetch.slice(i, i + BATCH_SIZE));
  }

  let chunkIdx = 0;
  const worker = async () => {
    const stored = [];
    while (true) {
      const i = chunkIdx;
      chunkIdx += 1;
      if (i >= chunks.length) break;
      const batch = chunks[i];
      try {
        if (batch.length === 1) {
          const row = await fetchMealDetailCached({
            userId,
            mealId: batch[0],
            apiBaseUrl,
            signal,
          });
          if (row) stored.push(row);
        } else {
          const rows = await fetchBatchAndStore({
            userId,
            mealIds: batch,
            apiBaseUrl,
            signal,
          });
          stored.push(...rows);
        }
      } catch {
        // Prefetch failures are silent — tap-to-open will retry with error UI.
      }
    }
    return stored;
  };

  const workerCount = Math.min(concurrency, chunks.length);
  return Promise.all(Array.from({ length: workerCount }, () => worker()))
    .then((results) => results.flat());
}

/** Test-only reset */
export function _resetMealDetailCacheForTests() {
  resolvedCache.clear();
  inFlight.clear();
}

export function _getInFlightCountForTests() {
  return inFlight.size;
}
