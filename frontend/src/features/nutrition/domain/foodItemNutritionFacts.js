/**
 * Per-item nutrition facts for the meal-detail item tap (not meal totals).
 */
import { availableCarbohydrates } from './mealGlycemicIndex.js';

/** Core facts always listed when an item is opened. */
export const CORE_FACT_KEYS = Object.freeze([
  'calories',
  'protein',
  'carbs',
  'available_carbohydrate',
  'fiber',
  'sugar',
  'fat',
  'glycemic_index',
]);

export const FACT_FIELD_META = Object.freeze({
  calories: { label: 'Calories', unit: 'kcal' },
  protein: { label: 'Protein', unit: 'g' },
  carbs: { label: 'Carbohydrates', unit: 'g' },
  available_carbohydrate: { label: 'Available Carbohydrate', unit: 'g' },
  fiber: { label: 'Fibre', unit: 'g' },
  sugar: { label: 'Sugar', unit: 'g' },
  fat: { label: 'Fat', unit: 'g' },
  glycemic_index: { label: 'Glycemic Index', unit: '' },
  sodium: { label: 'Sodium', unit: 'mg' },
  cholesterol: { label: 'Cholesterol', unit: 'mg' },
  vitamin_a: { label: 'Vitamin A', unit: 'µg' },
  vitamin_c: { label: 'Vitamin C', unit: 'mg' },
  vitamin_d: { label: 'Vitamin D', unit: 'µg' },
  vitamin_e: { label: 'Vitamin E', unit: 'mg' },
  vitamin_k: { label: 'Vitamin K', unit: 'µg' },
  vitamin_b1: { label: 'Vitamin B1', unit: 'mg' },
  vitamin_b2: { label: 'Vitamin B2', unit: 'mg' },
  vitamin_b3: { label: 'Vitamin B3', unit: 'mg' },
  vitamin_b6: { label: 'Vitamin B6', unit: 'mg' },
  vitamin_b9: { label: 'Vitamin B9', unit: 'µg' },
  vitamin_b12: { label: 'Vitamin B12', unit: 'µg' },
  calcium: { label: 'Calcium', unit: 'mg' },
  iron: { label: 'Iron', unit: 'mg' },
  magnesium: { label: 'Magnesium', unit: 'mg' },
  potassium: { label: 'Potassium', unit: 'mg' },
  zinc: { label: 'Zinc', unit: 'mg' },
  phosphorus: { label: 'Phosphorus', unit: 'mg' },
});

const EXTRA_FACT_KEYS = Object.freeze(
  Object.keys(FACT_FIELD_META).filter((key) => !CORE_FACT_KEYS.includes(key)),
);

/**
 * @param {number|null|undefined} value
 * @param {string} key
 * @returns {string|null}
 */
export function formatFactValue(value, key) {
  if (value == null || !Number.isFinite(Number(value))) return null;
  const n = Number(value);
  if (key === 'calories' || key === 'glycemic_index') return String(Math.round(n));
  const rounded = Math.round(n * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

/**
 * @param {number|null|undefined} gi
 * @returns {{ label: string, tone: 'low'|'medium'|'high' }|null}
 */
export function giZone(gi) {
  if (gi == null || !Number.isFinite(Number(gi))) return null;
  const n = Number(gi);
  if (n <= 55) return { label: 'Low', tone: 'low' };
  if (n <= 69) return { label: 'Medium', tone: 'medium' };
  return { label: 'High', tone: 'high' };
}

function readPortion(item) {
  const portion =
    item?.serving?.description
    || item?.portionDescription
    || item?.portion
    || null;
  const grams = item?.serving?.grams || item?.grams || item?.weight_g || null;
  const isLiquid = item?.isLiquid || item?.serving?.isLiquid || false;
  const unit = isLiquid ? 'ml' : 'g';
  const trimmed = typeof portion === 'string' ? portion.trim() : '';
  if (trimmed && grams) {
    const compact = trimmed.replace(/\s+/g, '').toLowerCase();
    const amountToken = `${grams}${unit}`.toLowerCase();
    if (compact.includes(amountToken)) return trimmed;
    return `${trimmed} (${grams}${unit})`;
  }
  if (trimmed) return trimmed;
  if (grams) return `${grams} ${unit}`;
  return null;
}

function hasValue(nutrition, key) {
  const v = nutrition[key];
  return v != null && Number.isFinite(Number(v));
}

/** Nested `nutrition` wins; flat item fields are the fallback (same as pickNutrition). */
function readItemNutrition(item) {
  if (!item || typeof item !== 'object') return {};
  const nested = item.nutrition && typeof item.nutrition === 'object' ? item.nutrition : {};
  const out = {};
  for (const key of Object.keys(FACT_FIELD_META)) {
    if (key === 'available_carbohydrate') continue;
    const v = nested[key] ?? item[key];
    if (v == null || v === '') continue;
    const n = Number(v);
    if (Number.isFinite(n)) out[key] = n;
  }
  return out;
}

function toRow(key, value) {
  const meta = FACT_FIELD_META[key];
  if (!meta) return null;
  const display = formatFactValue(value, key);
  if (display == null) return null;
  return {
    key,
    label: meta.label,
    value: display,
    unit: meta.unit,
    numeric: Number(value),
  };
}

/**
 * Build display rows for one food item only (never meal totals).
 * Core macros are always included; GI / available carbs / extras only when present.
 *
 * @param {object|null|undefined} item
 * @returns {{
 *   name: string,
 *   portion: string|null,
 *   rows: Array<{ key: string, label: string, value: string, unit: string, numeric: number }>,
 *   giZone: { label: string, tone: 'low'|'medium'|'high' }|null,
 * }}
 */
export function buildFoodItemNutritionFacts(item) {
  const name = String(item?.name || item?.foodName || 'Item').trim() || 'Item';
  const portion = item ? readPortion(item) : null;
  const nutrition = readItemNutrition(item);

  const carbs = hasValue(nutrition, 'carbs') ? Number(nutrition.carbs) : null;
  const fiber = hasValue(nutrition, 'fiber') ? Number(nutrition.fiber) : 0;
  const available = carbs != null ? availableCarbohydrates(carbs, fiber) : null;

  const rows = [];
  for (const key of CORE_FACT_KEYS) {
    if (key === 'available_carbohydrate') {
      if (available == null) continue;
      const row = toRow(key, available);
      if (row) rows.push(row);
      continue;
    }
    if (key === 'glycemic_index') {
      if (!hasValue(nutrition, key)) continue;
      const row = toRow(key, nutrition[key]);
      if (row) rows.push(row);
      continue;
    }
    const row = toRow(key, hasValue(nutrition, key) ? nutrition[key] : 0);
    if (row) rows.push(row);
  }

  for (const key of EXTRA_FACT_KEYS) {
    if (!hasValue(nutrition, key) || Number(nutrition[key]) === 0) continue;
    const row = toRow(key, nutrition[key]);
    if (row) rows.push(row);
  }

  return {
    name,
    portion,
    rows,
    giZone: giZone(nutrition.glycemic_index),
  };
}
