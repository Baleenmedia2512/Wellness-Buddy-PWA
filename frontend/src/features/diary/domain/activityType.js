/**
 * diary/domain/activityType.js
 *
 * Resolve food-subtyped diary activities from analysis payload signals.
 * Water and Afresh stay separate — never merge into one beverage kind.
 * Pure helpers — zero I/O.
 */

export const DIARY_FOOD_ACTIVITY = Object.freeze({
  FOOD: 'food',
  WATER: 'water',
  AFRESH: 'afresh',
  SHAKE: 'shake',
});

/** Meal badges apply only to real food (not water / afresh). */
export function shouldShowMealBadge(activityType) {
  return activityType === DIARY_FOOD_ACTIVITY.FOOD
    || activityType === DIARY_FOOD_ACTIVITY.SHAKE;
}

/**
 * Parse AnalysisData JSON when needed (string or object).
 * @param {unknown} analysisData
 * @returns {object|null}
 */
export function parseRawAnalysis(analysisData) {
  if (!analysisData) return null;
  if (typeof analysisData === 'object') return analysisData;
  if (typeof analysisData !== 'string') return null;
  try {
    return JSON.parse(analysisData);
  } catch {
    return null;
  }
}

/**
 * @param {{ processedBy?: string|null, analysisData?: unknown, foodData?: { name?: string, detailedItems?: object[] } }} input
 * @returns {'food'|'water'|'afresh'|'shake'}
 */
export function resolveFoodActivityType({
  processedBy = null,
  analysisData = null,
  foodData = null,
} = {}) {
  const raw = parseRawAnalysis(analysisData);
  const by = String(processedBy || raw?.processedBy || '').toLowerCase().trim();

  if (by === 'water_preset') return DIARY_FOOD_ACTIVITY.WATER;
  if (by === 'afresh_preset') return DIARY_FOOD_ACTIVITY.AFRESH;
  if (by === 'shake_calculator') return DIARY_FOOD_ACTIVITY.SHAKE;

  const items = Array.isArray(foodData?.detailedItems)
    ? foodData.detailedItems
    : (Array.isArray(raw?.foods) ? raw.foods : []);
  const names = items
    .map((item) => String(item?.name || '').toLowerCase().trim())
    .filter(Boolean);
  const title = String(foodData?.name || raw?.category?.name || '').toLowerCase().trim();
  const primary = names[0] || title;

  // Water tracker path often omits processedBy — detect by name + zero kcal liquid.
  if (isWaterName(primary) || (names.length === 1 && isWaterName(names[0]))) {
    return DIARY_FOOD_ACTIVITY.WATER;
  }
  if (items.length > 0 && items.every(isWaterLikeLiquidItem)) {
    return DIARY_FOOD_ACTIVITY.WATER;
  }
  if (names.some(isAfreshName) || isAfreshName(primary) || isAfreshName(title)) {
    return DIARY_FOOD_ACTIVITY.AFRESH;
  }
  if (names.some(isShakeName) || isShakeName(primary) || isShakeName(title)) {
    return DIARY_FOOD_ACTIVITY.SHAKE;
  }

  return DIARY_FOOD_ACTIVITY.FOOD;
}

function isWaterName(name) {
  if (!name) return false;
  return name === 'water'
    || name === 'plain water'
    || name.startsWith('plain water');
}

/** Legacy water rows: zero-kcal liquid with volume but wrong name (e.g. Unknown Food). */
function isWaterLikeLiquidItem(item) {
  if (!item || typeof item !== 'object') return false;
  const name = String(item?.name || '').toLowerCase().trim();
  if (isAfreshName(name) || isShakeName(name)) return false;
  if (isWaterName(name)) return true;
  const cal = Number(item?.nutrition?.calories ?? item?.calories ?? 0);
  const vol = Number(item?.volume_ml);
  const liquid = item?.isLiquid === true || item?.unit === 'ml';
  return liquid && Number.isFinite(vol) && vol > 0 && cal === 0;
}

function isAfreshName(name) {
  if (!name) return false;
  return name.includes('afresh');
}

function isShakeName(name) {
  if (!name) return false;
  return name.includes('herbalife shake')
    || name.includes('protein shake')
    || name === 'shake';
}

/**
 * Total volume_ml from food items (water / liquids).
 * @param {{ detailedItems?: object[] }|null} foodData
 * @param {unknown} [analysisData]
 * @returns {number|null}
 */
export function extractVolumeMl(foodData, analysisData = null) {
  const items = collectFoodItems(foodData, analysisData);
  let sum = 0;
  let found = false;
  for (const item of items) {
    const ml = Number(item?.volume_ml);
    if (Number.isFinite(ml) && ml > 0) {
      sum += ml;
      found = true;
      continue;
    }
    const fromPortion = parseMlFromPortion(item?.portion || item?.portionDescription);
    if (fromPortion != null) {
      sum += fromPortion;
      found = true;
    }
  }
  return found ? sum : null;
}

/**
 * Scoop count for Afresh entries.
 * @param {{ detailedItems?: object[] }|null} foodData
 * @param {unknown} [analysisData]
 * @returns {number|null}
 */
export function extractScoops(foodData, analysisData = null) {
  const items = collectFoodItems(foodData, analysisData);
  for (const item of items) {
    const scoops = Number(item?.scoops);
    if (Number.isFinite(scoops) && scoops > 0) return scoops;
    const fromPortion = parseScoopsFromPortion(item?.portion || item?.portionDescription || item?.name);
    if (fromPortion != null) return fromPortion;
  }
  return null;
}

/**
 * Sum Afresh scoops logged today from day-analysis rows (food-corrections stats).
 * Water / food / shake rows are ignored — scoop total stays independent of water ml.
 *
 * @param {Array<{ ProcessedBy?: string|null, AnalysisData?: unknown }>|null|undefined} dayAnalyses
 * @returns {number}
 */
export function sumAfreshScoopsFromDayAnalyses(dayAnalyses) {
  let total = 0;
  for (const row of dayAnalyses || []) {
    const analysisData = row?.AnalysisData ?? row?.analysisData ?? null;
    const processedBy = row?.ProcessedBy ?? row?.processedBy ?? null;
    if (resolveFoodActivityType({ processedBy, analysisData }) !== DIARY_FOOD_ACTIVITY.AFRESH) {
      continue;
    }
    const scoops = extractScoops(null, analysisData);
    total += scoops != null ? scoops : 1;
  }
  return Math.max(0, Math.round(total));
}

/**
 * Serving quantity for shake entries (defaults to 1 when shake detected).
 * @param {{ detailedItems?: object[] }|null} foodData
 * @param {unknown} [analysisData]
 * @returns {number}
 */
export function extractShakeServings(foodData, analysisData = null) {
  const items = collectFoodItems(foodData, analysisData);
  for (const item of items) {
    const servings = Number(item?.servings ?? item?.servingCount);
    if (Number.isFinite(servings) && servings > 0) return servings;
    const fromPortion = parseServingsFromPortion(item?.portion || item?.portionDescription);
    if (fromPortion != null) return fromPortion;
  }
  return 1;
}

function collectFoodItems(foodData, analysisData) {
  if (Array.isArray(foodData?.detailedItems) && foodData.detailedItems.length > 0) {
    return foodData.detailedItems;
  }
  const raw = parseRawAnalysis(analysisData);
  if (Array.isArray(raw?.foods)) return raw.foods;
  if (Array.isArray(raw?.detailedItems)) return raw.detailedItems;
  return [];
}

function parseMlFromPortion(portion) {
  if (!portion || typeof portion !== 'string') return null;
  const m = portion.match(/(\d+(?:\.\d+)?)\s*(ml|mL|l|L)\b/i);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n <= 0) return null;
  const unit = m[2].toLowerCase();
  return unit === 'l' ? Math.round(n * 1000) : Math.round(n);
}

function parseScoopsFromPortion(portion) {
  if (!portion || typeof portion !== 'string') return null;
  const m = portion.match(/(\d+(?:\.\d+)?)\s*scoops?\b/i);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseServingsFromPortion(portion) {
  if (!portion || typeof portion !== 'string') return null;
  const m = portion.match(/(\d+(?:\.\d+)?)\s*servings?\b/i);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}
