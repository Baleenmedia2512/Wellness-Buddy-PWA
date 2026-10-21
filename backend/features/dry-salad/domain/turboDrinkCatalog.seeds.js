/**
 * Turbo Drink — Target Nutrition catalog.
 *
 * One prepared drink:
 *   Formula 1                  2 scoops
 *   Afresh (generic label)     4 scoops
 *   Personalized Protein       2 scoops
 *   Water                      1 L
 *
 * Nutrition is the sum of those scoops. Water adds volume only.
 * Afresh sodium on the generic row is stored as grams (0.001 g = 1 mg);
 * this drink stores sodium in mg, same as Formula 1 and protein.
 *
 * Pure constants — zero I/O.
 */
import {
  foodNameMatchesQuery,
  normalizeFoodName,
  pickNutrition,
  sortByFoodNameMatch,
} from '../../nutrition-knowledge/domain/nutrition.rules.js';
import { AFRESH_NUTRITION_PER_SCOOP } from './afreshCatalog.seeds.js';
import { formula1NutritionPerScoop } from './formula1Catalog.seeds.js';
import { PERSONALIZED_PROTEIN_PER_SCOOP } from './personalizedProteinCatalog.seeds.js';

export const TURBO_DRINK_NAME = 'Turbo Drink';
export const TURBO_DRINK_FORMULA1_SCOOPS = 2;
export const TURBO_DRINK_AFRESH_SCOOPS = 4;
export const TURBO_DRINK_PROTEIN_SCOOPS = 2;
export const TURBO_DRINK_WATER_ML = 1000;

export const TURBO_DRINK_PORTION =
  '2 scoops Formula 1, 4 scoops Afresh, 2 scoops Personalized Protein, 1 L water';

/**
 * @param {Record<string, number>} nutrition
 * @param {number} scoops
 * @returns {Record<string, number>}
 */
function scaleByScoops(nutrition, scoops) {
  const out = {};
  for (const [key, value] of Object.entries(nutrition || {})) {
    const n = Number(value);
    if (!Number.isFinite(n)) continue;
    out[key] = Math.round(n * scoops * 100) / 100;
  }
  return out;
}

/**
 * @param {Record<string, number>[]} parts
 * @returns {Record<string, number>}
 */
function sumParts(parts) {
  const out = {};
  for (const part of parts) {
    for (const [key, value] of Object.entries(part)) {
      const n = Number(value);
      if (!Number.isFinite(n)) continue;
      out[key] = Math.round(((out[key] || 0) + n) * 100) / 100;
    }
  }
  return out;
}

/**
 * Macros for one Turbo Drink (the fixed scoop counts above).
 * @returns {Record<string, number>}
 */
export function turboDrinkNutrition() {
  const afresh = scaleByScoops(AFRESH_NUTRITION_PER_SCOOP, TURBO_DRINK_AFRESH_SCOOPS);
  // 1 mg per Afresh scoop, stored in mg to match Formula 1 and protein.
  afresh.sodium = TURBO_DRINK_AFRESH_SCOOPS;
  return sumParts([
    scaleByScoops(formula1NutritionPerScoop(), TURBO_DRINK_FORMULA1_SCOOPS),
    afresh,
    scaleByScoops(PERSONALIZED_PROTEIN_PER_SCOOP, TURBO_DRINK_PROTEIN_SCOOPS),
  ]);
}

const NUTRITION = Object.freeze(pickNutrition(turboDrinkNutrition()));

const SEED = Object.freeze({
  id: 'seed-turbo-drink',
  canonical_name: TURBO_DRINK_NAME,
  normalized_name: normalizeFoodName(TURBO_DRINK_NAME),
  aliases: Object.freeze([
    'Herbalife Turbo Drink',
    'Turbo',
    'TurboDrink',
  ]),
  reference_weight_g: TURBO_DRINK_WATER_ML,
  is_liquid: true,
  portion_label: TURBO_DRINK_PORTION,
  source: 'brand_preset',
  status: 'approved',
  sightings: 0,
  version: 1,
  nutrition: NUTRITION,
});

const SEEDS = Object.freeze([SEED]);

/** @returns {object[]} */
export function listTurboDrinkCatalogSeeds() {
  return SEEDS.slice();
}

/**
 * @param {string} term
 * @returns {object[]}
 */
export function searchTurboDrinkCatalogSeeds(term) {
  const q = normalizeFoodName(term);
  if (!q) return listTurboDrinkCatalogSeeds();
  const hits = SEEDS.filter((row) =>
    foodNameMatchesQuery(row.canonical_name, q, row.aliases || []),
  );
  return sortByFoodNameMatch(hits, q);
}
