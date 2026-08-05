/**
 * backend/features/nutrition-knowledge/domain/seeds.js
 * In-code approved seeds used when the DB table is empty / migration pending.
 */
import { normalizeFoodName } from './nutrition.rules.js';

const SEEDS = [
  {
    id: 'seed-banana',
    canonical_name: 'Banana',
    normalized_name: 'banana',
    aliases: ['banana fruit', 'medium banana'],
    reference_weight_g: 118,
    is_liquid: false,
    portion_label: '1 medium banana',
    source: 'seed',
    status: 'approved',
    sightings: 0,
    nutrition: {
      calories: 105, protein: 1.3, carbs: 27, fat: 0.3, fiber: 3.1,
      sugar: 14.4, sodium: 1, cholesterol: 0, glycemic_index: 51,
      vitamin_a: 3, vitamin_c: 10.3, vitamin_d: 0, vitamin_e: 0.1, vitamin_k: 0.6,
      vitamin_b1: 0.04, vitamin_b2: 0.08, vitamin_b3: 0.7, vitamin_b6: 0.4,
      vitamin_b9: 24, vitamin_b12: 0, calcium: 6, iron: 0.3, magnesium: 32,
      potassium: 422, zinc: 0.2, phosphorus: 26,
    },
  },
  {
    id: 'seed-apple',
    canonical_name: 'Apple',
    normalized_name: 'apple',
    aliases: ['apple fruit', 'medium apple'],
    reference_weight_g: 182,
    is_liquid: false,
    portion_label: '1 medium apple',
    source: 'seed',
    status: 'approved',
    sightings: 0,
    nutrition: {
      calories: 95, protein: 0.5, carbs: 25, fat: 0.3, fiber: 4.4,
      sugar: 19, sodium: 2, cholesterol: 0, glycemic_index: 36,
      vitamin_a: 5, vitamin_c: 8.4, vitamin_d: 0, vitamin_e: 0.3, vitamin_k: 4,
      vitamin_b1: 0.03, vitamin_b2: 0.05, vitamin_b3: 0.2, vitamin_b6: 0.08,
      vitamin_b9: 5, vitamin_b12: 0, calcium: 11, iron: 0.2, magnesium: 9,
      potassium: 195, zinc: 0.1, phosphorus: 20,
    },
  },
  {
    id: 'seed-idli',
    canonical_name: 'Idli',
    normalized_name: 'idli',
    aliases: ['idly', 'steamed idli'],
    reference_weight_g: 40,
    is_liquid: false,
    portion_label: '1 piece',
    source: 'seed',
    status: 'approved',
    sightings: 0,
    nutrition: {
      calories: 58, protein: 2, carbs: 12, fat: 0.1, fiber: 0.8,
      sugar: 0.2, sodium: 120, cholesterol: 0, glycemic_index: 66,
      vitamin_a: 0, vitamin_c: 0, vitamin_d: 0, vitamin_e: 0, vitamin_k: 0,
      vitamin_b1: 0.05, vitamin_b2: 0.03, vitamin_b3: 0.4, vitamin_b6: 0.04,
      vitamin_b9: 8, vitamin_b12: 0, calcium: 8, iron: 0.4, magnesium: 10,
      potassium: 45, zinc: 0.2, phosphorus: 25,
    },
  },
  {
    id: 'seed-herbalife-shake',
    canonical_name: 'Herbalife Shake',
    normalized_name: 'herbalife shake',
    aliases: ['wellness valley shake', 'herbalife meal replacement shake'],
    reference_weight_g: 58,
    is_liquid: true,
    portion_label: '1 serving (300ml)',
    source: 'brand_preset',
    status: 'approved',
    sightings: 0,
    nutrition: {
      calories: 223, protein: 24.73, carbs: 24.24, fat: 2.98, fiber: 3,
      sugar: 11.57, sodium: 355, cholesterol: 7, glycemic_index: 20,
      vitamin_a: 210, vitamin_c: 15, vitamin_d: 3.4, vitamin_e: 5, vitamin_k: 0,
      vitamin_b1: 0.45, vitamin_b2: 0.45, vitamin_b3: 5, vitamin_b6: 0.8,
      vitamin_b9: 85, vitamin_b12: 0.4, calcium: 129, iron: 3, magnesium: 50,
      potassium: 260, zinc: 2.5, phosphorus: 0,
    },
  },
  {
    id: 'seed-afresh',
    canonical_name: 'Herbalife Afresh Energy Drink',
    normalized_name: 'herbalife afresh energy drink',
    aliases: ['afresh', 'herbalife afresh'],
    reference_weight_g: 2,
    is_liquid: true,
    portion_label: '1 scoop',
    source: 'brand_preset',
    status: 'approved',
    sightings: 0,
    nutrition: {
      calories: 3.52, protein: 0.05, carbs: 0.83, fat: 0, fiber: 0,
      sugar: 0.51, sodium: 0.001, cholesterol: 0, glycemic_index: 0,
      vitamin_c: 0, potassium: 0,
    },
  },
];

/**
 * @param {string} term
 * @returns {object[]}
 */
export function searchSeedProfiles(term) {
  const q = normalizeFoodName(term);
  if (!q || q.length < 2) return [];
  return SEEDS.filter((row) => {
    if (row.normalized_name.includes(q) || q.includes(row.normalized_name)) return true;
    return (row.aliases || []).some((a) => normalizeFoodName(a).includes(q));
  });
}

/**
 * @param {string} name
 * @returns {object|null}
 */
export function findSeedProfile(name) {
  const key = normalizeFoodName(name);
  if (!key) return null;
  return SEEDS.find((row) => {
    if (row.normalized_name === key) return true;
    return (row.aliases || []).some((a) => normalizeFoodName(a) === key);
  }) || null;
}

export function listSeedProfiles() {
  return SEEDS.slice();
}
