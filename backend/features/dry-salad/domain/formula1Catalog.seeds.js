/**
 * Formula 1 Target Nutrition catalog — flavored powder, 1 scoop each.
 *
 * Label serving = 25 g (3 scoops). Catalog rows use per-scoop nutrition
 * (label ÷ 3). Same macros for every flavour.
 *
 * Pure constants — zero I/O.
 */
import {
  foodNameMatchesQuery,
  normalizeFoodName,
  pickNutrition,
  sortByFoodNameMatch,
} from '../../nutrition-knowledge/domain/nutrition.rules.js';

/** Official canister serving (3 scoops). */
export const FORMULA1_LABEL_SCOOPS = 3;
export const FORMULA1_LABEL_WEIGHT_G = 25;

/** Label column "Per 25 g" (3 scoops). */
export const FORMULA1_NUTRITION_PER_25G = Object.freeze({
  calories: 94.2,
  protein: 9,
  carbs: 10.5,
  fat: 1.8,
  fiber: 3,
  sugar: 4.8,
  sodium: 123,
  cholesterol: 1.5,
  vitamin_a: 210,
  vitamin_c: 15,
  vitamin_d: 1.75,
  vitamin_e: 5,
  vitamin_k: 0,
  vitamin_b1: 0.45,
  vitamin_b2: 0.45,
  vitamin_b3: 5,
  vitamin_b6: 0.8,
  vitamin_b9: 60,
  vitamin_b12: 0.4,
  calcium: 45,
  iron: 3,
  magnesium: 50,
  potassium: 260,
  zinc: 2.5,
  phosphorus: 0,
});

/**
 * One scoop ≈ 8.33 g — label Per 25 g ÷ 3.
 * @returns {Record<string, number>}
 */
export function formula1NutritionPerScoop() {
  const out = {};
  for (const [key, value] of Object.entries(FORMULA1_NUTRITION_PER_25G)) {
    const n = Number(value);
    if (!Number.isFinite(n)) continue;
    out[key] = Math.round((n / FORMULA1_LABEL_SCOOPS) * 100) / 100;
  }
  return out;
}

/** Flavour display names (Dutch Chocolate, not plain Chocolate). */
export const FORMULA1_FLAVORS = Object.freeze([
  'Vanilla',
  'Mango',
  'Banana Caramel',
  'Dates Caramel',
  'Paan',
  'Orange Cream',
  'Kulfi',
  'Strawberry',
  'Rose Kheer',
  'Dutch Chocolate',
]);

const PER_SCOOP = Object.freeze(formula1NutritionPerScoop());
const WEIGHT_PER_SCOOP_G = Math.round((FORMULA1_LABEL_WEIGHT_G / FORMULA1_LABEL_SCOOPS) * 100) / 100;

/**
 * @param {string} flavor
 * @returns {object}
 */
function buildFlavorRow(flavor) {
  const label = String(flavor || '').trim();
  const canonical = `Formula 1 - ${label}`;
  const slug = normalizeFoodName(label).replace(/\s+/g, '-');
  const aliases = [
    `F1 ${label}`,
    `Formula 1 ${label}`,
    `Herbalife Formula 1 ${label}`,
  ];
  // Keep chocolate discoverable when users omit "Dutch".
  if (normalizeFoodName(label) === 'dutch chocolate') {
    aliases.push('Formula 1 - Chocolate', 'Formula 1 Chocolate', 'F1 Chocolate');
  }
  return Object.freeze({
    id: `seed-f1-${slug}`,
    canonical_name: canonical,
    normalized_name: normalizeFoodName(canonical),
    aliases: Object.freeze(aliases),
    reference_weight_g: WEIGHT_PER_SCOOP_G,
    is_liquid: false,
    portion_label: '1 scoop',
    source: 'brand_preset',
    status: 'approved',
    sightings: 0,
    version: 1,
    nutrition: pickNutrition(PER_SCOOP),
  });
}

const SEEDS = Object.freeze(FORMULA1_FLAVORS.map(buildFlavorRow));

/** @returns {object[]} */
export function listFormula1CatalogSeeds() {
  return SEEDS.slice();
}

/**
 * @param {string} term
 * @returns {object[]}
 */
export function searchFormula1CatalogSeeds(term) {
  const q = normalizeFoodName(term);
  if (!q) return listFormula1CatalogSeeds();
  const hits = SEEDS.filter((row) =>
    foodNameMatchesQuery(row.canonical_name, q, row.aliases || []),
  );
  return sortByFoodNameMatch(hits, q);
}
