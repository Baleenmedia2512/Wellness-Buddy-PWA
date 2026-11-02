/**
 * Shakemate — Target Nutrition catalog.
 * Label serving = 27 g (2 scoops). Catalog row = 1 scoop (label ÷ 2).
 * Pure constants — zero I/O.
 */
import {
  foodNameMatchesQuery,
  normalizeFoodName,
  pickNutrition,
  sortByFoodNameMatch,
} from '../../nutrition-knowledge/domain/nutrition.rules.js';

export const SHAKEMATE_LABEL_SCOOPS = 2;
export const SHAKEMATE_LABEL_WEIGHT_G = 27;

/** Label column "Per 27 g" (2 scoops). */
export const SHAKEMATE_NUTRITION_PER_27G = Object.freeze({
  calories: 106,
  protein: 10.75,
  carbs: 13.5,
  fat: 1,
  fiber: 0,
  sugar: 4.5,
  sodium: 169, // mg
  cholesterol: 4, // mg
  vitamin_d: 1.65, // mcg
  calcium: 129, // mg
});

/**
 * One scoop = 13.5 g — label Per 27 g ÷ 2.
 * @returns {Record<string, number>}
 */
export function shakemateNutritionPerScoop() {
  const out = {};
  for (const [key, value] of Object.entries(SHAKEMATE_NUTRITION_PER_27G)) {
    const n = Number(value);
    if (!Number.isFinite(n)) continue;
    out[key] = Math.round((n / SHAKEMATE_LABEL_SCOOPS) * 100) / 100;
  }
  return out;
}

const PER_SCOOP = Object.freeze(shakemateNutritionPerScoop());
const WEIGHT_PER_SCOOP_G = Math.round((SHAKEMATE_LABEL_WEIGHT_G / SHAKEMATE_LABEL_SCOOPS) * 100) / 100;

const SEED = Object.freeze({
  id: 'seed-shakemate',
  canonical_name: 'Shakemate',
  normalized_name: 'shakemate',
  aliases: Object.freeze([
    'Shake Mate',
    'ShakeMate',
    'Herbalife Shakemate',
    'Herbalife Shake Mate',
  ]),
  reference_weight_g: WEIGHT_PER_SCOOP_G,
  is_liquid: false,
  portion_label: '1 scoop',
  source: 'brand_preset',
  status: 'approved',
  sightings: 0,
  version: 1,
  nutrition: pickNutrition(PER_SCOOP),
});

const SEEDS = Object.freeze([SEED]);

/** @returns {object[]} */
export function listShakemateCatalogSeeds() {
  return SEEDS.slice();
}

/**
 * @param {string} term
 * @returns {object[]}
 */
export function searchShakemateCatalogSeeds(term) {
  const q = normalizeFoodName(term);
  if (!q) return listShakemateCatalogSeeds();
  const hits = SEEDS.filter((row) =>
    foodNameMatchesQuery(row.canonical_name, q, row.aliases || []),
  );
  return sortByFoodNameMatch(hits, q);
}
