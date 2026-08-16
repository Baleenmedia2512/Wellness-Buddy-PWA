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

export const HEART_FACT_KEYS = Object.freeze(['sodium', 'cholesterol']);

export const VITAMIN_FACT_KEYS = Object.freeze([
  'vitamin_a', 'vitamin_c', 'vitamin_d', 'vitamin_e', 'vitamin_k',
  'vitamin_b1', 'vitamin_b2', 'vitamin_b3', 'vitamin_b6', 'vitamin_b9', 'vitamin_b12',
]);

export const MINERAL_FACT_KEYS = Object.freeze([
  'calcium', 'iron', 'magnesium', 'potassium', 'zinc', 'phosphorus',
]);

export const FACT_SECTIONS = Object.freeze([
  { id: 'macros', label: null },
  { id: 'other', label: 'Sodium & cholesterol' },
  { id: 'vitamins', label: 'Vitamins' },
  { id: 'minerals', label: 'Minerals' },
]);

export const FACT_FIELD_META = Object.freeze({
  calories: { label: 'Calories', unit: 'kcal', section: 'macros' },
  protein: { label: 'Protein', unit: 'g', section: 'macros' },
  carbs: { label: 'Carbohydrates', unit: 'g', section: 'macros' },
  available_carbohydrate: { label: 'Available Carbohydrate', unit: 'g', section: 'macros' },
  fiber: { label: 'Fibre', unit: 'g', section: 'macros' },
  sugar: { label: 'Sugar', unit: 'g', section: 'macros' },
  fat: { label: 'Fat', unit: 'g', section: 'macros' },
  glycemic_index: { label: 'Glycemic Index', unit: '', section: 'macros' },
  sodium: { label: 'Sodium', unit: 'mg', section: 'other' },
  cholesterol: { label: 'Cholesterol', unit: 'mg', section: 'other' },
  vitamin_a: { label: 'Vitamin A', unit: 'µg', section: 'vitamins' },
  vitamin_c: { label: 'Vitamin C', unit: 'mg', section: 'vitamins' },
  vitamin_d: { label: 'Vitamin D', unit: 'µg', section: 'vitamins' },
  vitamin_e: { label: 'Vitamin E', unit: 'mg', section: 'vitamins' },
  vitamin_k: { label: 'Vitamin K', unit: 'µg', section: 'vitamins' },
  vitamin_b1: { label: 'Vitamin B1 (Thiamin)', unit: 'mg', section: 'vitamins' },
  vitamin_b2: { label: 'Vitamin B2 (Riboflavin)', unit: 'mg', section: 'vitamins' },
  vitamin_b3: { label: 'Vitamin B3 (Niacin)', unit: 'mg', section: 'vitamins' },
  vitamin_b6: { label: 'Vitamin B6', unit: 'mg', section: 'vitamins' },
  vitamin_b9: { label: 'Vitamin B9 (Folate)', unit: 'µg', section: 'vitamins' },
  vitamin_b12: { label: 'Vitamin B12', unit: 'µg', section: 'vitamins' },
  calcium: { label: 'Calcium', unit: 'mg', section: 'minerals' },
  iron: { label: 'Iron', unit: 'mg', section: 'minerals' },
  magnesium: { label: 'Magnesium', unit: 'mg', section: 'minerals' },
  potassium: { label: 'Potassium', unit: 'mg', section: 'minerals' },
  zinc: { label: 'Zinc', unit: 'mg', section: 'minerals' },
  phosphorus: { label: 'Phosphorus', unit: 'mg', section: 'minerals' },
});

const EXTRA_FACT_KEYS = Object.freeze([
  ...HEART_FACT_KEYS,
  ...VITAMIN_FACT_KEYS,
  ...MINERAL_FACT_KEYS,
]);

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

function snakeToCamel(key) {
  return key.replace(/_([a-z])/g, (_, ch) => ch.toUpperCase());
}

function snakeToPascal(key) {
  const camel = snakeToCamel(key);
  return camel.charAt(0).toUpperCase() + camel.slice(1);
}

function keyAliases(key) {
  const camel = snakeToCamel(key);
  const pascal = snakeToPascal(key);
  return [camel, pascal, `total${pascal}`, `Total${pascal}`];
}

function readNumber(source, key) {
  if (!source || typeof source !== 'object') return undefined;
  const candidates = [key, ...keyAliases(key)];
  for (const k of candidates) {
    const v = source[k];
    if (v == null || v === '') continue;
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

/** Nested `nutrition` wins; serving / flat item fields are fallbacks. */
function readItemNutrition(item) {
  if (!item || typeof item !== 'object') return {};
  const sources = [
    item.nutrition,
    item.serving?.nutrition,
    item.defaultServing?.nutrition,
    item,
  ];
  const out = {};
  for (const key of Object.keys(FACT_FIELD_META)) {
    if (key === 'available_carbohydrate') continue;
    for (const src of sources) {
      const n = readNumber(src, key);
      if (n != null) {
        out[key] = n;
        break;
      }
    }
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
    section: meta.section,
  };
}

/**
 * Build display rows for one food item only (never meal totals).
 * Core macros are always included; vitamins / minerals / sodium / cholesterol
 * only when a stored value is greater than 0.
 *
 * @param {object|null|undefined} item
 * @returns {{
 *   name: string,
 *   portion: string|null,
 *   rows: Array<{ key: string, label: string, value: string, unit: string, numeric: number, section: string }>,
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
