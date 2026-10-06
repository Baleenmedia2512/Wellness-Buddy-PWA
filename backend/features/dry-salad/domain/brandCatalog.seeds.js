/**
 * Combined Target Nutrition brand seeds (F1 + Afresh + Protein + Shakemate).
 * Pure — zero I/O.
 */
import { listAfreshCatalogSeeds } from './afreshCatalog.seeds.js';
import { listFormula1CatalogSeeds } from './formula1Catalog.seeds.js';
import { listPersonalizedProteinCatalogSeeds } from './personalizedProteinCatalog.seeds.js';
import { listShakemateCatalogSeeds } from './shakemateCatalog.seeds.js';
import {
  foodNameMatchesQuery,
  normalizeFoodName,
  sortByFoodNameMatch,
} from '../../nutrition-knowledge/domain/nutrition.rules.js';

/** @returns {object[]} */
export function listBrandCatalogSeeds() {
  return [
    ...listFormula1CatalogSeeds(),
    ...listAfreshCatalogSeeds(),
    ...listPersonalizedProteinCatalogSeeds(),
    ...listShakemateCatalogSeeds(),
  ];
}

/**
 * @param {string} term
 * @returns {object[]}
 */
export function searchBrandCatalogSeeds(term) {
  const q = normalizeFoodName(term);
  if (!q) return listBrandCatalogSeeds();
  const hits = listBrandCatalogSeeds().filter((row) =>
    foodNameMatchesQuery(row.canonical_name, q, row.aliases || []),
  );
  return sortByFoodNameMatch(hits, q);
}
