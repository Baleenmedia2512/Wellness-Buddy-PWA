/**
 * backend/features/nutrition-knowledge/domain/nutrition.rules.js
 * Pure helpers for master nutrition lookup / scaling / candidate promotion.
 */
export const NUTRITION_KEYS = Object.freeze([
  'calories', 'protein', 'carbs', 'fat', 'fiber',
  'sugar', 'sodium', 'cholesterol', 'glycemic_index',
  'vitamin_a', 'vitamin_c', 'vitamin_d', 'vitamin_e', 'vitamin_k',
  'vitamin_b1', 'vitamin_b2', 'vitamin_b3', 'vitamin_b6', 'vitamin_b9', 'vitamin_b12',
  'calcium', 'iron', 'magnesium', 'potassium', 'zinc', 'phosphorus',
]);

/** Minimum sightings before a draft candidate may auto-promote to approved. */
export const AUTO_PROMOTE_SIGHTINGS = 5;

/**
 * Normalize a food name for exact master / alias matching.
 * @param {unknown} name
 * @returns {string}
 */
export function normalizeFoodName(name) {
  return String(name ?? '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^\p{L}\p{N}\s.-]/gu, '');
}

/**
 * Pick numeric nutrition fields from an arbitrary object.
 * @param {object|null|undefined} raw
 * @returns {Record<string, number>}
 */
export function pickNutrition(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const key of NUTRITION_KEYS) {
    const v = raw[key];
    if (v == null || v === '') continue;
    const n = Number(v);
    if (Number.isFinite(n)) out[key] = n;
  }
  return out;
}

/**
 * Scale nutrition linearly by weight ratio.
 * @param {Record<string, number>} nutrition
 * @param {number} referenceWeightG
 * @param {number} targetWeightG
 * @returns {Record<string, number>}
 */
export function scaleNutrition(nutrition, referenceWeightG, targetWeightG) {
  const ref = Number(referenceWeightG);
  const target = Number(targetWeightG);
  if (!(ref > 0) || !(target >= 0) || !nutrition || typeof nutrition !== 'object') {
    return pickNutrition(nutrition);
  }
  const ratio = target / ref;
  const out = {};
  for (const key of NUTRITION_KEYS) {
    if (nutrition[key] == null) continue;
    const n = Number(nutrition[key]);
    if (!Number.isFinite(n)) continue;
    out[key] = Math.round(n * ratio * 100) / 100;
  }
  return out;
}

/**
 * Build a search/resolve item from a master profile row (optionally scaled).
 * @param {object} row
 * @param {number} [targetWeightG]
 */
export function profileToSearchItem(row, targetWeightG = null) {
  const refW = Number(row.reference_weight_g) > 0 ? Number(row.reference_weight_g) : 100;
  const weight = targetWeightG != null && Number(targetWeightG) > 0
    ? Number(targetWeightG)
    : refW;
  const nutrition = scaleNutrition(pickNutrition(row.nutrition), refW, weight);
  return {
    name: row.canonical_name,
    weight_g: Math.round(weight),
    source: 'master',
    profileId: row.id ?? null,
    is_liquid: Boolean(row.is_liquid),
    portion: row.portion_label || `${Math.round(weight)}g`,
    ...nutrition,
    nutrition,
  };
}

/**
 * Whether a draft candidate should become approved.
 * @param {{ status: string, sightings: number }} row
 * @param {number} [threshold]
 */
export function shouldAutoPromote(row, threshold = AUTO_PROMOTE_SIGHTINGS) {
  if (!row || row.status !== 'draft') return false;
  return Number(row.sightings) >= threshold;
}

/**
 * Merge search lists with priority: master > my history > community.
 * First occurrence of a normalized name wins.
 * @param {{ masterItems?: object[], myItems?: object[], communityItems?: object[] }} parts
 */
export function mergeSearchResults({ masterItems = [], myItems = [], communityItems = [] }) {
  const seen = new Set();
  const out = [];
  for (const list of [masterItems, myItems, communityItems]) {
    for (const item of list) {
      const key = normalizeFoodName(item?.name);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(item);
    }
  }
  return out;
}
