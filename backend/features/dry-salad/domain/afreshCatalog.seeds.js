/**
 * Afresh Target Nutrition catalog — flavoured powder, 1 scoop (1 g) each.
 *
 * Flavour macros from canister labels (Per 1 g). Sugar differs by flavour.
 * Generic Afresh row keeps the existing Manual-Log preset macros.
 *
 * Pure constants — zero I/O.
 */
import {
  foodNameMatchesQuery,
  normalizeFoodName,
  pickNutrition,
  sortByFoodNameMatch,
} from '../../nutrition-knowledge/domain/nutrition.rules.js';

export const AFRESH_WEIGHT_PER_SCOOP_G = 1;

/** Legacy / Manual-Log Afresh preset (frontend afreshProductProfiles.js). */
export const AFRESH_NUTRITION_PER_SCOOP = Object.freeze({
  calories: 3.52,
  protein: 0.05,
  carbs: 0.83,
  fat: 0,
  fiber: 0,
  sugar: 0.51,
  sodium: 0.001, // g (1 mg) — same unit as Afresh preset
  cholesterol: 0,
  glycemic_index: 0,
  vitamin_c: 0,
  potassium: 0,
});

/** Shared base for labelled Afresh flavours (Per 1 g). Override sugar per flavour. */
function afreshLabelPerScoop({ sugar }) {
  return Object.freeze({
    calories: 3.52,
    protein: 0.05,
    carbs: 0.83,
    fat: 0,
    fiber: 0,
    sugar,
    sodium: 1, // mg (label)
    cholesterol: 0,
    glycemic_index: 0,
    vitamin_c: 0,
    potassium: 0,
  });
}

/** Kashmiri Kahwa canister label — Per 1 g (1 scoop). */
export const AFRESH_KASHMIRI_KAHWA_PER_SCOOP = afreshLabelPerScoop({ sugar: 0.01 });

/** Elaichi canister label — Per 1 g (1 scoop). */
export const AFRESH_ELAICHI_PER_SCOOP = afreshLabelPerScoop({ sugar: 0.11 });

/** Cinnamon canister label — Per 1 g (1 scoop). */
export const AFRESH_CINNAMON_PER_SCOOP = afreshLabelPerScoop({ sugar: 0.52 });

/** Lemon canister label — Per 1 g (1 scoop). */
export const AFRESH_LEMON_PER_SCOOP = afreshLabelPerScoop({ sugar: 0.01 });

/** Peach canister label — Per 1 g (1 scoop). */
export const AFRESH_PEACH_PER_SCOOP = afreshLabelPerScoop({ sugar: 0.61 });

/** Natural Tulsi canister label — Per 1 g (1 scoop). */
export const AFRESH_NATURAL_TULSI_PER_SCOOP = afreshLabelPerScoop({ sugar: 0.51 });

/** Ginger canister label — Per 1 g (1 scoop). */
export const AFRESH_GINGER_PER_SCOOP = afreshLabelPerScoop({ sugar: 0.11 });

/**
 * @typedef {{ flavor: string|null, nutrition: Record<string, number>, aliases?: string[] }} AfreshFlavorDef
 */

/** @type {readonly AfreshFlavorDef[]} */
const FLAVOR_DEFS = Object.freeze([
  {
    flavor: null,
    nutrition: AFRESH_NUTRITION_PER_SCOOP,
    aliases: Object.freeze([
      'Afresh',
      'Herbalife Afresh',
      'Afresh Energy Drink',
      'Afresh Energy Drink Mix',
    ]),
  },
  {
    flavor: 'Kashmiri Kahwa',
    nutrition: AFRESH_KASHMIRI_KAHWA_PER_SCOOP,
    aliases: Object.freeze([
      'Afresh Kashmiri Kahwa',
      'Kashmiri Kahwa',
      'Afresh Kahwa',
      'Herbalife Afresh Kashmiri Kahwa',
    ]),
  },
  {
    flavor: 'Elaichi',
    nutrition: AFRESH_ELAICHI_PER_SCOOP,
    aliases: Object.freeze([
      'Afresh Elaichi',
      'Elaichi',
      'Afresh Elachi',
      'Elachi',
      'Herbalife Afresh Elaichi',
    ]),
  },
  {
    flavor: 'Cinnamon',
    nutrition: AFRESH_CINNAMON_PER_SCOOP,
    aliases: Object.freeze([
      'Afresh Cinnamon',
      'Cinnamon',
      'Afresh Cinamon',
      'Herbalife Afresh Cinnamon',
    ]),
  },
  {
    flavor: 'Lemon',
    nutrition: AFRESH_LEMON_PER_SCOOP,
    aliases: Object.freeze([
      'Afresh Lemon',
      'Lemon',
      'Herbalife Afresh Lemon',
    ]),
  },
  {
    flavor: 'Peach',
    nutrition: AFRESH_PEACH_PER_SCOOP,
    aliases: Object.freeze([
      'Afresh Peach',
      'Peach',
      'Herbalife Afresh Peach',
    ]),
  },
  {
    flavor: 'Natural Tulsi',
    nutrition: AFRESH_NATURAL_TULSI_PER_SCOOP,
    aliases: Object.freeze([
      'Afresh Natural Tulsi',
      'Natural Tulsi',
      'Afresh Tulsi',
      'Tulsi',
      'Herbalife Afresh Natural Tulsi',
    ]),
  },
  {
    flavor: 'Ginger',
    nutrition: AFRESH_GINGER_PER_SCOOP,
    aliases: Object.freeze([
      'Afresh Ginger',
      'Ginger',
      'Herbalife Afresh Ginger',
    ]),
  },
]);

/**
 * @param {AfreshFlavorDef} def
 * @returns {object}
 */
function buildFlavorRow(def) {
  const flavor = def.flavor ? String(def.flavor).trim() : '';
  const canonical = flavor
    ? `Afresh - ${flavor}`
    : 'Herbalife Afresh Energy Drink';
  const slug = flavor
    ? normalizeFoodName(flavor).replace(/\s+/g, '-')
    : 'generic';
  return Object.freeze({
    id: `seed-afresh-${slug}`,
    canonical_name: canonical,
    normalized_name: normalizeFoodName(canonical),
    aliases: Object.freeze([...(def.aliases || [])]),
    reference_weight_g: AFRESH_WEIGHT_PER_SCOOP_G,
    is_liquid: true,
    portion_label: '1 scoop',
    source: 'brand_preset',
    status: 'approved',
    sightings: 0,
    version: 1,
    nutrition: pickNutrition(def.nutrition),
  });
}

const SEEDS = Object.freeze(FLAVOR_DEFS.map(buildFlavorRow));

/** @returns {object[]} */
export function listAfreshCatalogSeeds() {
  return SEEDS.slice();
}

/**
 * @param {string} term
 * @returns {object[]}
 */
export function searchAfreshCatalogSeeds(term) {
  const q = normalizeFoodName(term);
  if (!q) return listAfreshCatalogSeeds();
  const hits = SEEDS.filter((row) =>
    foodNameMatchesQuery(row.canonical_name, q, row.aliases || []),
  );
  return sortByFoodNameMatch(hits, q);
}
