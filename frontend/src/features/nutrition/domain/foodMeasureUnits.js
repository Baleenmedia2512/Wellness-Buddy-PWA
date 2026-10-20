/**
 * Measure units for Add Food rows: g / ml for all items,
 * plus piece count for dosa, idli, chapathi, porata, idiyappam.
 */
import {
  pickNutrition,
  referenceWeightG,
  scaleNutritionFields,
} from './nutritionFields';

/** Whole-word names counted as pieces (user + common spellings). */
export const PIECE_FOOD_NAME_RE =
  /\b(dosa|idli|idly|idaly|chapathi|chapati|chappathi|porata|paratha|parotta|porotta|idyapam|idiyappam|idiappam)\b/i;

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
  const ref = referenceWeightG(item);
  if (isPieceCountableFood(item)) {
    return { unit: 'pcs', quantity: 1 };
  }
  const explicit = String(item?.unit || '').toLowerCase();
  if (item?.isLiquid || item?.is_liquid || explicit === 'ml') {
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
  const base = item && typeof item === 'object' ? item : {};

  if (unitRaw === 'pcs' || unitRaw === 'piece' || unitRaw === 'pieces') {
    const pieces = !Number.isFinite(qty) || qty < 0.5
      ? 1
      : Math.round(qty * 2) / 2;
    const portion = pieces === 1
      ? (base.portion || base.portion_label || '1 piece')
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
