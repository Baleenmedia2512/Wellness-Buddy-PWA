/**
 * turboDrinkCatalog.seeds.test.js
 * Run: node --test backend/features/dry-salad/__tests__/turboDrinkCatalog.seeds.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formula1NutritionPerScoop } from '../domain/formula1Catalog.seeds.js';
import { AFRESH_NUTRITION_PER_SCOOP } from '../domain/afreshCatalog.seeds.js';
import { PERSONALIZED_PROTEIN_PER_SCOOP } from '../domain/personalizedProteinCatalog.seeds.js';
import {
  TURBO_DRINK_AFRESH_SCOOPS,
  TURBO_DRINK_FORMULA1_SCOOPS,
  TURBO_DRINK_NAME,
  TURBO_DRINK_PORTION,
  TURBO_DRINK_PROTEIN_SCOOPS,
  TURBO_DRINK_WATER_ML,
  listTurboDrinkCatalogSeeds,
  searchTurboDrinkCatalogSeeds,
  turboDrinkNutrition,
} from '../domain/turboDrinkCatalog.seeds.js';
import { listBrandCatalogSeeds, searchBrandCatalogSeeds } from '../domain/brandCatalog.seeds.js';

describe('turboDrinkCatalog.seeds', () => {
  it('sums 2 Formula 1 + 4 Afresh + 2 protein scoops and 1 L water', () => {
    const nutrition = turboDrinkNutrition();
    const f1 = formula1NutritionPerScoop();
    const expectedCalories = Math.round((
      f1.calories * TURBO_DRINK_FORMULA1_SCOOPS
      + AFRESH_NUTRITION_PER_SCOOP.calories * TURBO_DRINK_AFRESH_SCOOPS
      + PERSONALIZED_PROTEIN_PER_SCOOP.calories * TURBO_DRINK_PROTEIN_SCOOPS
    ) * 100) / 100;
    const expectedProtein = Math.round((
      f1.protein * TURBO_DRINK_FORMULA1_SCOOPS
      + AFRESH_NUTRITION_PER_SCOOP.protein * TURBO_DRINK_AFRESH_SCOOPS
      + PERSONALIZED_PROTEIN_PER_SCOOP.protein * TURBO_DRINK_PROTEIN_SCOOPS
    ) * 100) / 100;

    assert.equal(nutrition.calories, expectedCalories);
    assert.equal(nutrition.protein, expectedProtein);
    assert.equal(nutrition.sodium, (
      f1.sodium * TURBO_DRINK_FORMULA1_SCOOPS
      + TURBO_DRINK_AFRESH_SCOOPS
      + PERSONALIZED_PROTEIN_PER_SCOOP.sodium * TURBO_DRINK_PROTEIN_SCOOPS
    ));
    assert.equal(TURBO_DRINK_FORMULA1_SCOOPS, 2);
    assert.equal(TURBO_DRINK_AFRESH_SCOOPS, 4);
    assert.equal(TURBO_DRINK_PROTEIN_SCOOPS, 2);
    assert.equal(TURBO_DRINK_WATER_ML, 1000);
  });

  it('seeds one liquid row whose volume is 1 L', () => {
    const seeds = listTurboDrinkCatalogSeeds();
    assert.equal(seeds.length, 1);
    const row = seeds[0];
    assert.equal(row.canonical_name, TURBO_DRINK_NAME);
    assert.equal(row.portion_label, TURBO_DRINK_PORTION);
    assert.equal(row.reference_weight_g, 1000);
    assert.equal(row.is_liquid, true);
    assert.equal(row.status, 'approved');
    assert.equal(row.nutrition.calories, turboDrinkNutrition().calories);
    assert.ok(row.nutrition.calories > 0);
  });

  it('search finds Turbo Drink', () => {
    assert.equal(searchTurboDrinkCatalogSeeds('turbo')[0].canonical_name, TURBO_DRINK_NAME);
    assert.equal(searchTurboDrinkCatalogSeeds('turbo drink')[0].canonical_name, TURBO_DRINK_NAME);
  });
});

describe('brandCatalog includes Turbo Drink', () => {
  it('lists Turbo Drink with the other brand seeds', () => {
    const all = listBrandCatalogSeeds();
    assert.ok(all.some((r) => r.canonical_name === TURBO_DRINK_NAME));
    assert.equal(searchBrandCatalogSeeds('turbo drink').length, 1);
    assert.equal(searchBrandCatalogSeeds('formula 1').length, 0);
  });
});
