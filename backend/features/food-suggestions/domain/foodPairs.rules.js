/**
 * foodPairs.rules.js — undirected food-pair frequency helpers (frequency-v1).
 * Pure domain; no I/O.
 */

export const MIN_GLOBAL_PAIR_COUNT = 3;
export const PERSONAL_OFTEN_WITH_MIN = 1;
/** When personal oftenWith for an anchor reaches this many, skip global fill. */
export const PERSONAL_SUFFICIENT_COUNT = 3;
export const DEFAULT_SUGGESTION_LIMIT = 8;
export const DEFAULT_LATEST_LIMIT = 12;
/** Meals logged from Target Nutrition — never enter regular food suggestions. */
export const DRY_SALAD_MEAL_KIND = 'dry-salad';

/**
 * Normalize a food name to a stable pair key (lowercase, collapsed whitespace).
 * @param {string} name
 * @returns {string}
 */
export function normalizeFoodNameKey(name) {
  return String(name || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

/**
 * Display-friendly name: trim + collapse spaces; keep original casing.
 * @param {string} name
 * @returns {string}
 */
export function displayFoodName(name) {
  return String(name || '').trim().replace(/\s+/g, ' ');
}

/**
 * @param {object|string|null|undefined} analysisData
 * @returns {object|null}
 */
export function parseAnalysisData(analysisData) {
  let data = analysisData;
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch {
      return null;
    }
  }
  return data && typeof data === 'object' ? data : null;
}

/**
 * Target Nutrition saves are tagged and must stay out of food suggestions.
 * @param {object|string|null|undefined} analysisData
 * @returns {boolean}
 */
export function isDrySaladAnalysis(analysisData) {
  const data = parseAnalysisData(analysisData);
  return data?.mealKind === DRY_SALAD_MEAL_KIND;
}

/**
 * @param {unknown} name
 * @param {Set<string>|string[]|null|undefined} excludeKeys
 * @returns {boolean}
 */
export function isExcludedSuggestionName(name, excludeKeys) {
  if (!excludeKeys) return false;
  const key = normalizeFoodNameKey(name);
  if (!key) return true;
  if (excludeKeys instanceof Set) return excludeKeys.has(key);
  return [...excludeKeys].map(normalizeFoodNameKey).includes(key);
}

/**
 * Unique foods from recent meals, skipping Target Nutrition (tag + catalog names).
 * Newest-first rows. Returns raw meal foods for the caller to flatten.
 *
 * @param {Array<{ AnalysisData?: object|string }>} rows
 * @param {number} limit
 * @param {Set<string>|string[]|null|undefined} [excludeKeys] dry-salad catalog keys
 * @returns {{ name: string, food: object }[]}
 */
export function extractLatestFoodsFromMeals(rows, limit, excludeKeys) {
  const cap = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : DEFAULT_LATEST_LIMIT;
  const seen = new Set();
  const latest = [];
  for (const row of rows || []) {
    const data = parseAnalysisData(row?.AnalysisData);
    if (!data || isDrySaladAnalysis(data)) continue;
    const foods = Array.isArray(data.foods) ? data.foods : [];
    for (const f of foods) {
      const display = displayFoodName(f?.name || f?.foodName || '');
      const key = normalizeFoodNameKey(display);
      if (!key || seen.has(key)) continue;
      if (isExcludedSuggestionName(display, excludeKeys)) continue;
      seen.add(key);
      latest.push({ name: display, food: f && typeof f === 'object' ? f : {} });
      if (latest.length >= cap) return latest;
    }
  }
  return latest;
}

/**
 * Extract unique food names from AnalysisData-like payload (order preserved).
 * @param {object|string|null} analysisData
 * @returns {string[]}
 */
export function extractFoodNamesFromAnalysis(analysisData) {
  const data = parseAnalysisData(analysisData);
  if (!data) return [];
  const foods = Array.isArray(data.foods) ? data.foods : [];
  const seen = new Set();
  const names = [];
  for (const f of foods) {
    const display = displayFoodName(f?.name || f?.foodName || '');
    const key = normalizeFoodNameKey(display);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    names.push(display);
  }
  return names;
}

/**
 * Undirected pairs with foodA < foodB lexicographically by key.
 * @param {string[]} names display or raw names
 * @returns {{ foodA: string, foodB: string, keyA: string, keyB: string }[]}
 */
export function enumerateUndirectedPairs(names) {
  const unique = [];
  const seen = new Set();
  for (const n of names || []) {
    const display = displayFoodName(n);
    const key = normalizeFoodNameKey(display);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push({ display, key });
  }

  const pairs = [];
  for (let i = 0; i < unique.length; i += 1) {
    for (let j = i + 1; j < unique.length; j += 1) {
      const a = unique[i];
      const b = unique[j];
      if (a.key < b.key) {
        pairs.push({ foodA: a.display, foodB: b.display, keyA: a.key, keyB: b.key });
      } else {
        pairs.push({ foodA: b.display, foodB: a.display, keyA: b.key, keyB: a.key });
      }
    }
  }
  return pairs;
}

/**
 * Given undirected pair rows for an anchor, return the other food + score.
 * @param {string} anchorKey
 * @param {Array<{ food_a?: string, food_b?: string, FoodA?: string, FoodB?: string, pair_count?: number, PairCount?: number }>} rows
 * @param {number} minCount
 * @returns {{ key: string, display: string, score: number }[]}
 */
export function partnersFromPairRows(anchorKey, rows, minCount = 1) {
  const anchor = normalizeFoodNameKey(anchorKey);
  if (!anchor) return [];
  const out = [];
  for (const row of rows || []) {
    const a = normalizeFoodNameKey(row.food_a ?? row.FoodA ?? '');
    const b = normalizeFoodNameKey(row.food_b ?? row.FoodB ?? '');
    const score = Number(row.pair_count ?? row.PairCount ?? 0);
    if (!Number.isFinite(score) || score < minCount) continue;
    let partnerKey = null;
    let partnerDisplay = null;
    if (a === anchor) {
      partnerKey = b;
      partnerDisplay = displayFoodName(row.food_b ?? row.FoodB ?? b);
    } else if (b === anchor) {
      partnerKey = a;
      partnerDisplay = displayFoodName(row.food_a ?? row.FoodA ?? a);
    }
    if (!partnerKey) continue;
    out.push({ key: partnerKey, display: partnerDisplay, score });
  }
  out.sort((x, y) => y.score - x.score || x.key.localeCompare(y.key));
  return out;
}

/**
 * Personal-first merge: personal occupies list; global tops up only when
 * personal count is below PERSONAL_SUFFICIENT_COUNT.
 *
 * @param {{ key: string, display: string, score: number }[]} personal
 * @param {{ key: string, display: string, score: number }[]} global
 * @param {{ limit?: number, excludeKeys?: Set<string>|string[], sufficientCount?: number }} [opts]
 * @returns {{ key: string, display: string, score: number, source: 'personal'|'global' }[]}
 */
export function mergeOftenWithPersonalFirst(personal, global, opts = {}) {
  const limit = Number.isFinite(opts.limit) ? opts.limit : DEFAULT_SUGGESTION_LIMIT;
  const sufficient = Number.isFinite(opts.sufficientCount)
    ? opts.sufficientCount
    : PERSONAL_SUFFICIENT_COUNT;
  const exclude = new Set(
    [...(opts.excludeKeys || [])].map((k) => normalizeFoodNameKey(k)).filter(Boolean),
  );

  const result = [];
  const used = new Set(exclude);

  for (const p of personal || []) {
    if (result.length >= limit) break;
    if (!p?.key || used.has(p.key)) continue;
    used.add(p.key);
    result.push({ ...p, source: 'personal' });
  }

  const personalCount = result.length;
  if (personalCount >= sufficient) {
    return result;
  }

  for (const g of global || []) {
    if (result.length >= limit) break;
    if (!g?.key || used.has(g.key)) continue;
    used.add(g.key);
    result.push({ ...g, source: 'global' });
  }

  return result;
}
