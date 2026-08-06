/**
 * Lean list-card projection extracted from food AnalysisData.
 * Keeps /api/diary/list free of full AI JSON + base64 while preserving
 * names, activity subtype, and share-card item lines.
 */

const ACTIVITY = Object.freeze({
  FOOD: 'food',
  WATER: 'water',
  AFRESH: 'afresh',
  SHAKE: 'shake',
});

/**
 * @param {unknown} analysisData
 * @param {string|null|undefined} processedBy
 * @returns {{
 *   name: string,
 *   activityType: 'food'|'water'|'afresh'|'shake',
 *   volumeMl: number|null,
 *   scoops: number|null,
 *   servings: number,
 *   shakeProducts: Array<{ name: string, scoops: number }>|null,
 *   items: Array<{ name: string, calories: number }>,
 * }}
 */
export function extractFoodListSummary(analysisData, processedBy = null) {
  const raw = parseRaw(analysisData);
  const foods = Array.isArray(raw?.foods) ? raw.foods : [];
  const name = formatFoodsTitle(foods) || 'Food';
  const activityType = resolveActivityType(processedBy, raw, foods, name);
  const volumeMl = sumVolumeMl(foods);
  const scoops = sumScoops(foods);
  const servings = extractServings(raw, foods);
  const shakeProducts = activityType === ACTIVITY.SHAKE
    ? extractShakeProducts(foods)
    : null;
  const items = foods.slice(0, 8).map((item) => ({
    name: String(item?.name || 'Item'),
    calories: Math.round(Number(item?.calories ?? item?.nutrition?.calories ?? 0) || 0),
  }));

  return {
    name,
    activityType,
    volumeMl,
    scoops,
    servings,
    shakeProducts,
    items,
  };
}

/**
 * True when a row likely has photo bytes (without selecting Base64).
 * Food: ImagePath or CaptureID. Other kinds: opt-in via explicit flag.
 */
export function inferHasImage({ imagePath, captureId, hasImageHint } = {}) {
  if (typeof hasImageHint === 'boolean') return hasImageHint;
  if (imagePath && String(imagePath).trim() !== '') return true;
  if (captureId != null && captureId !== '') return true;
  return false;
}

function parseRaw(analysisData) {
  if (!analysisData) return null;
  if (typeof analysisData === 'object') return analysisData;
  if (typeof analysisData !== 'string') return null;
  try {
    return JSON.parse(analysisData);
  } catch {
    return null;
  }
}

function formatFoodsTitle(foods) {
  const names = foods
    .map((f) => String(f?.name || '').trim())
    .filter(Boolean);
  if (names.length === 0) return null;
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} / ${names[1]}`;
  return `${names[0]} +${names.length - 1}`;
}

function resolveActivityType(processedBy, raw, foods, title) {
  const by = String(processedBy || raw?.processedBy || '').toLowerCase().trim();
  if (by === 'water_preset') return ACTIVITY.WATER;
  if (by === 'afresh_preset') return ACTIVITY.AFRESH;
  if (by === 'shake_calculator') return ACTIVITY.SHAKE;

  const names = foods
    .map((item) => String(item?.name || '').toLowerCase().trim())
    .filter(Boolean);
  const primary = names[0] || String(title || '').toLowerCase().trim();

  if (isWaterName(primary) || (names.length === 1 && isWaterName(names[0]))) {
    return ACTIVITY.WATER;
  }
  if (foods.length > 0 && foods.every(isWaterLikeLiquidItem)) {
    return ACTIVITY.WATER;
  }
  if (names.some(isAfreshName) || isAfreshName(primary)) return ACTIVITY.AFRESH;
  if (names.some(isShakeName) || isShakeName(primary)) return ACTIVITY.SHAKE;
  return ACTIVITY.FOOD;
}

function isWaterName(name) {
  if (!name) return false;
  return name === 'water'
    || name === 'plain water'
    || name.startsWith('plain water');
}

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
  return Boolean(name && name.includes('afresh'));
}

function isShakeName(name) {
  if (!name) return false;
  return name.includes('herbalife shake')
    || name.includes('protein shake')
    || name === 'shake';
}

function sumVolumeMl(foods) {
  let sum = 0;
  let found = false;
  for (const item of foods) {
    const vol = Number(item?.volume_ml);
    if (Number.isFinite(vol) && vol > 0) {
      sum += vol;
      found = true;
    }
  }
  return found ? Math.round(sum) : null;
}

function sumScoops(foods) {
  let sum = 0;
  let found = false;
  for (const item of foods) {
    const scoops = Number(item?.scoops ?? item?.serving_qty);
    if (Number.isFinite(scoops) && scoops > 0) {
      sum += scoops;
      found = true;
    }
  }
  return found ? Math.round(sum * 10) / 10 : null;
}

function extractServings(raw, foods) {
  const fromRaw = Number(raw?.servings ?? raw?.total?.servings);
  if (Number.isFinite(fromRaw) && fromRaw > 0) return fromRaw;
  if (foods.length === 0) return 1;
  return 1;
}

function extractShakeProducts(foods) {
  const products = [];
  for (const item of foods) {
    const name = String(item?.name || '').trim();
    if (!name) continue;
    const scoops = Number(item?.scoops ?? item?.serving_qty ?? 1);
    products.push({
      name,
      scoops: Number.isFinite(scoops) && scoops > 0 ? scoops : 1,
    });
  }
  return products.length ? products : null;
}
