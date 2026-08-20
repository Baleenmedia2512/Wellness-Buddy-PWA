/**
 * In-code Dry Salad catalog used when the DB table is empty / not migrated.
 */
import {
  foodNameMatchesQuery,
  normalizeFoodName,
  sortByFoodNameMatch,
} from '../../nutrition-knowledge/domain/nutrition.rules.js';

const SEEDS = [
  {
    id: 'seed-herbalife-dry-salad',
    canonical_name: 'Herbalife Dry Salad',
    normalized_name: 'herbalife dry salad',
    aliases: ['dry salad', 'herbalife salad'],
    reference_weight_g: 100,
    is_liquid: false,
    portion_label: '1 serving (100g)',
    source: 'brand_preset',
    status: 'approved',
    sightings: 0,
    version: 1,
    reviewed_by_user_id: null,
    nutrition: {
      calories: 80, protein: 8, carbs: 10, fat: 1.5, fiber: 4,
      sugar: 3, sodium: 120, cholesterol: 0, glycemic_index: 15,
    },
  },
  {
    id: 'seed-herbalife-protein-salad',
    canonical_name: 'Herbalife Protein Salad',
    normalized_name: 'herbalife protein salad',
    aliases: ['protein salad', 'herbalife protein dry salad'],
    reference_weight_g: 100,
    is_liquid: false,
    portion_label: '1 serving (100g)',
    source: 'brand_preset',
    status: 'approved',
    sightings: 0,
    version: 1,
    reviewed_by_user_id: null,
    nutrition: {
      calories: 95, protein: 12, carbs: 8, fat: 2, fiber: 3.5,
      sugar: 2.5, sodium: 140, cholesterol: 0, glycemic_index: 15,
    },
  },
  {
    id: 'seed-herbalife-sprouts-dry-salad',
    canonical_name: 'Herbalife Sprouts Dry Salad',
    normalized_name: 'herbalife sprouts dry salad',
    aliases: ['sprouts salad', 'herbalife sprouts'],
    reference_weight_g: 100,
    is_liquid: false,
    portion_label: '1 serving (100g)',
    source: 'brand_preset',
    status: 'approved',
    sightings: 0,
    version: 1,
    reviewed_by_user_id: null,
    nutrition: {
      calories: 70, protein: 7, carbs: 11, fat: 1, fiber: 4.5,
      sugar: 2, sodium: 80, cholesterol: 0, glycemic_index: 20,
    },
  },
];

export function listSeedProfiles() {
  return SEEDS.slice();
}

/**
 * @param {string} term
 * @returns {object[]}
 */
export function searchSeedProfiles(term) {
  const q = normalizeFoodName(term);
  if (!q) return listSeedProfiles();
  const hits = SEEDS.filter((row) =>
    foodNameMatchesQuery(row.canonical_name, q, row.aliases || []),
  );
  return sortByFoodNameMatch(hits, q);
}
