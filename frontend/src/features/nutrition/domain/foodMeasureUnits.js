/**
 * Measure units for Add Food rows: g / ml for all items,
 * plus piece count for dosa, idli, chapathi, porata, idiyappam.
 *
 * Latest/history often stores multi-piece totals (e.g. 25 dosas → 13500 kcal).
 * Piece foods are normalized to 1-piece nutrition before display / pcs add.
 */
import {
  pickNutrition,
  referenceWeightG,
  scaleNutritionFields,
} from './nutritionFields';

/** Whole-word names counted as pieces (user + common spellings). */
export const PIECE_FOOD_NAME_RE =
  /\b(dosa|idli|idly|idaly|chapathi|chapati|chappathi|porata|paratha|parotta|porotta|idyapam|idiyappam|idiappam)\b/i;

/** One piece is almost never above this — higher usually means a multi-piece total. */
const IMPLAUSIBLE_SINGLE_PIECE_KCAL = 800;

/**
 * @param {string|object|null|undefined} itemOrName
 * @returns {boolean}
 */
export function isPieceCountableFood(itemOrName) {
  const name = typeof itemOrName === 'string'
    ? itemOrName
    : String(itemOrName?.name || '');
  return PIECE_FOOD_NAME_RE.test(name);
}

/**
 * Typical grams for one piece (used only when servings/portion are missing).
 * @param {string|object|null|undefined} itemOrName
 * @returns {number}
 */
export function typicalPieceWeightG(itemOrName) {
  const name = typeof itemOrName === 'string'
    ? itemOrName
    : String(itemOrName?.name || '');
  const n = name.toLowerCase();
  if (/\b(idli|idly|idaly)\b/.test(n)) return 40;
  if (/\b(chapathi|chapati|chappathi)\b/.test(n)) return 40;
  if (/\b(porata|paratha|parotta|porotta)\b/.test(n)) return 100;
  if (/\b(idyapam|idiyappam|idiappam)\b/.test(n)) return 100;
  if (/\bdosa\b/.test(n)) return 90;
  return 80;
}

/**
 * How many pieces the history row represents (1 if already a single piece).
 * Example: last meal logged 2 dosas → calories 270, servings 2 / portion "2 pieces"
 * → count 2 so UI can show 1 pcs = 135 again.
 * @param {object|null|undefined} item
 * @returns {number}
 */
export function impliedPieceCount(item) {
  if (!item || typeof item !== 'object') return 1;

  const servings = Number(item.servings ?? item.servingCount);
  if (Number.isFinite(servings) && servings > 1) {
    return Math.round(servings * 2) / 2;
  }

  const portion = String(item.portion || item.portion_label || '').trim();
  const fromPortion = portion.match(
    /^(\d+(?:\.\d+)?)\s*(?:pieces?|pcs)\b/i,
  ) || portion.match(/^(\d+(?:\.\d+)?)\s*[×x]\s+/i);
  if (fromPortion) {
    const n = Number(fromPortion[1]);
    if (Number.isFinite(n) && n > 1) return Math.round(n * 2) / 2;
  }

  const kcal = Number(item.calories ?? item.nutrition?.calories);
  const weight = Number(item.weight_g);
  const typical = typicalPieceWeightG(item);
  // History may drop `servings` but keep total weight (e.g. 2×90g = 180g → 270 kcal).
  if (Number.isFinite(weight) && weight >= typical * 2) {
    const fromWeight = Math.round(weight / typical);
    if (fromWeight > 1) return fromWeight;
  }
  if (Number.isFinite(kcal) && kcal > IMPLAUSIBLE_SINGLE_PIECE_KCAL) {
    const fromWeight = Number.isFinite(weight) && weight > typical
      ? Math.round(weight / typical)
      : 0;
    if (fromWeight > 1) return fromWeight;
  }

  return 1;
}

/**
 * Preview macros for the quantity currently on the row stepper.
 * Piece foods: always from 1-piece base × pcs (1→135, 2→270).
 * @param {object} item
 * @param {{ unit?: string, quantity?: number|string }} measure
 * @returns {{ calories: number|null, protein: number|null, portionLabel: string }}
 */
export function previewMeasureNutrition(item, measure = {}) {
  const unit = String(measure.unit || 'g').toLowerCase();
  const qty = Number(measure.quantity);
  const isPcs = unit === 'pcs' || unit === 'piece' || unit === 'pieces';

  if (isPieceCountableFood(item) || isPcs) {
    const one = normalizePieceFoodToSingleServing(item);
    const pieces = !Number.isFinite(qty) || qty < 0.5
      ? 1
      : Math.round(qty * 2) / 2;
    const calories = one.calories != null
      ? Math.round(Number(one.calories) * pieces)
      : null;
    const protein = one.protein != null
      ? Math.round(Number(one.protein) * pieces * 10) / 10
      : null;
    const portionLabel = pieces === 1 ? '1 piece' : `${formatAmount(pieces)} pieces`;
    return { calories, protein, portionLabel };
  }

  const refW = referenceWeightG(item);
  const amount = !Number.isFinite(qty) || qty < 1 ? refW : qty;
  const ratio = refW > 0 ? amount / refW : 1;
  const nutrition = scaleNutritionFields(item, ratio);
  const u = unit === 'ml' ? 'ml' : 'g';
  return {
    calories: nutrition.calories != null ? Math.round(nutrition.calories) : null,
    protein: nutrition.protein != null ? Math.round(nutrition.protein * 10) / 10 : null,
    portionLabel: `${formatAmount(amount)} ${u}`,
  };
}

/**
 * Collapse a multi-piece history row to 1-piece nutrition for pcs UI.
 * @param {object|null|undefined} item
 * @returns {object}
 */
export function normalizePieceFoodToSingleServing(item) {
  if (!item || typeof item !== 'object') return item || {};
  if (!isPieceCountableFood(item)) return item;

  const pieces = impliedPieceCount(item);
  if (pieces <= 1) {
    return {
      ...item,
      servings: 1,
      portion: item.portion || item.portion_label || '1 piece',
      measureUnit: 'pcs',
    };
  }

  const nutrition = scaleNutritionFields(item, 1 / pieces);
  const weight = Number(item.weight_g);
  const perPieceWeight = Number.isFinite(weight) && weight > 0
    ? Math.round((weight / pieces) * 100) / 100
    : typicalPieceWeightG(item);

  return {
    ...item,
    ...nutrition,
    nutrition: {
      ...pickNutrition(item.nutrition || item),
      ...nutrition,
    },
    calories: nutrition.calories ?? 0,
    protein: nutrition.protein ?? item.protein,
    carbs: nutrition.carbs ?? item.carbs,
    fat: nutrition.fat ?? item.fat,
    fiber: nutrition.fiber ?? item.fiber,
    weight_g: perPieceWeight,
    servings: 1,
    portion: '1 piece',
    measureUnit: 'pcs',
  };
}

/**
 * Units offered on a search / Latest row.
 * Piece foods (dosa, idli, …) → pcs only (no g/ml).
 * Everything else → g + ml.
 * @param {object|null|undefined} item
 * @returns {Array<'g'|'ml'|'pcs'>}
 */
export function availableMeasureUnits(item) {
  if (isPieceCountableFood(item)) {
    return /** @type {Array<'g'|'ml'|'pcs'>} */ (['pcs']);
  }
  return /** @type {Array<'g'|'ml'|'pcs'>} */ (['g', 'ml']);
}

/**
 * Default unit + quantity when a row mounts.
 * @param {object|null|undefined} item
 * @returns {{ unit: 'g'|'ml'|'pcs', quantity: number }}
 */
export function defaultMeasureForItem(item) {
  const normalized = isPieceCountableFood(item)
    ? normalizePieceFoodToSingleServing(item)
    : item;
  const ref = referenceWeightG(normalized);
  if (isPieceCountableFood(normalized)) {
    return { unit: 'pcs', quantity: 1 };
  }
  const explicit = String(normalized?.unit || '').toLowerCase();
  if (normalized?.isLiquid || normalized?.is_liquid || explicit === 'ml') {
    return { unit: 'ml', quantity: ref };
  }
  return { unit: 'g', quantity: ref };
}

function formatAmount(n) {
  const v = Math.round(Number(n) * 100) / 100;
  return Number.isInteger(v) ? String(v) : String(v);
}

/**
 * Build a meal-tray item from a library/history food + chosen measure.
 * - pcs: keep per-piece nutrition; servings = piece count
 * - g/ml: scale nutrition to absolute amount; servings = 1 (sheet can multiply)
 *
 * @param {object} item
 * @param {{ unit: string, quantity: number|string }} measure
 * @returns {object}
 */
export function applyFoodMeasure(item, measure = {}) {
  const unitRaw = String(measure.unit || 'g').toLowerCase().trim();
  const qty = Number(measure.quantity);
  const raw = item && typeof item === 'object' ? item : {};
  // Always start from 1-piece nutrition for piece foods (fixes 13500 kcal Latest rows).
  const base = isPieceCountableFood(raw)
    ? normalizePieceFoodToSingleServing(raw)
    : raw;

  if (unitRaw === 'pcs' || unitRaw === 'piece' || unitRaw === 'pieces') {
    const pieces = !Number.isFinite(qty) || qty < 0.5
      ? 1
      : Math.round(qty * 2) / 2;
    const portion = pieces === 1
      ? '1 piece'
      : `${formatAmount(pieces)} pieces`;
    return {
      ...base,
      servings: pieces,
      portion,
      measureUnit: 'pcs',
    };
  }

  const unit = unitRaw === 'ml' ? 'ml' : 'g';
  const amount = !Number.isFinite(qty) || qty < 1 ? referenceWeightG(base) : qty;
  const refW = referenceWeightG(base);
  const ratio = refW > 0 ? amount / refW : 1;
  const nutrition = scaleNutritionFields(base, ratio);
  const portion = `${formatAmount(amount)} ${unit}`;
  const isLiquid = unit === 'ml';

  return {
    ...base,
    ...nutrition,
    nutrition: {
      ...pickNutrition(base.nutrition || base),
      ...nutrition,
    },
    calories: nutrition.calories ?? 0,
    protein: nutrition.protein ?? base.protein,
    carbs: nutrition.carbs ?? base.carbs,
    fat: nutrition.fat ?? base.fat,
    fiber: nutrition.fiber ?? base.fiber,
    servings: 1,
    unit,
    isLiquid,
    is_liquid: isLiquid,
    weight_g: amount,
    volume_ml: isLiquid ? amount : null,
    portion,
    measureUnit: unit,
    measureAmount: amount,
  };
}
