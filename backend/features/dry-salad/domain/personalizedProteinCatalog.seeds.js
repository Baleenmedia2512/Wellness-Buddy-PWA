/**
 * Personalized Protein Powder — Target Nutrition catalog.
 * Label serving = 6 g (1 scoop). Pure constants — zero I/O.
 */
import {
  foodNameMatchesQuery,
  normalizeFoodName,
  pickNutrition,
  sortByFoodNameMatch,
} from '../../nutrition-knowledge/domain/nutrition.rules.js';

/** Label: Serving Size 6 g (1 scoop). */
export const PERSONALIZED_PROTEIN_WEIGHT_PER_SCOOP_G = 6;

/** Canister label — Per 6 g (1 scoop). */
export const PERSONALIZED_PROTEIN_PER_SCOOP = Object.freeze({
  calories: 22.96,
  protein: 4.96,
  carbs: 0.24,
  fat: 0.18,
  fiber: 0,
  sugar: 0,
  sodium: 68, // mg
  cholesterol: 0,
});

const SEED = Object.freeze({
  id: 'seed-personalized-protein',
  canonical_name: 'Personalized Protein Powder',
  normalized_name: 'personalized protein powder',
  aliases: Object.freeze([
    'Personalized Protein',
    'PPP',
    'Protein Powder',
    'Herbalife Personalized Protein',
    'Herbalife Personalized Protein Powder',
  ]),
  reference_weight_g: PERSONALIZED_PROTEIN_WEIGHT_PER_SCOOP_G,
  is_liquid: false,
  portion_label: '1 scoop',
  source: 'brand_preset',
  status: 'approved',
  sightings: 0,
  version: 1,
  nutrition: pickNutrition(PERSONALIZED_PROTEIN_PER_SCOOP),
});

const SEEDS = Object.freeze([SEED]);

/** @returns {object[]} */
export function listPersonalizedProteinCatalogSeeds() {
  return SEEDS.slice();
}

/**
 * @param {string} term
 * @returns {object[]}
 */
export function searchPersonalizedProteinCatalogSeeds(term) {
  const q = normalizeFoodName(term);
  if (!q) return listPersonalizedProteinCatalogSeeds();
  const hits = SEEDS.filter((row) =>
    foodNameMatchesQuery(row.canonical_name, q, row.aliases || []),
  );
  return sortByFoodNameMatch(hits, q);
}
