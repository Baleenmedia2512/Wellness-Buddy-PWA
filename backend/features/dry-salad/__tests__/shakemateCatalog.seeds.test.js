/**
 * shakemateCatalog.seeds.test.js
 * Run: node --test backend/features/dry-salad/__tests__/shakemateCatalog.seeds.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  SHAKEMATE_LABEL_SCOOPS,
  SHAKEMATE_NUTRITION_PER_27G,
  listShakemateCatalogSeeds,
  searchShakemateCatalogSeeds,
  shakemateNutritionPerScoop,
} from '../domain/shakemateCatalog.seeds.js';
import { listBrandCatalogSeeds, searchBrandCatalogSeeds } from '../domain/brandCatalog.seeds.js';

describe('shakemateCatalog.seeds', () => {
  it('derives 1-scoop nutrition as label Per 27 g ÷ 2', () => {
    const one = shakemateNutritionPerScoop();
    assert.equal(one.calories, 53);
    assert.equal(one.protein, 5.38);
    assert.equal(one.carbs, 6.75);
    assert.equal(one.fat, 0.5);
    assert.equal(one.sugar, 2.25);
    assert.equal(one.sodium, 84.5);
    assert.equal(one.cholesterol, 2);
    assert.equal(one.vitamin_d, 0.83);
    assert.equal(one.calcium, 64.5);
    assert.equal(one.calories * SHAKEMATE_LABEL_SCOOPS, SHAKEMATE_NUTRITION_PER_27G.calories);
  });

  it('seeds 1 scoop (13.5 g) Shakemate row', () => {
    const seeds = listShakemateCatalogSeeds();
    assert.equal(seeds.length, 1);
    const row = seeds[0];
    assert.equal(row.canonical_name, 'Shakemate');
    assert.equal(row.portion_label, '1 scoop');
    assert.equal(row.reference_weight_g, 13.5);
    assert.equal(row.status, 'approved');
    assert.equal(row.nutrition.calories, 53);
    assert.equal(row.nutrition.protein, 5.38);
  });

  it('search finds Shakemate', () => {
    assert.equal(searchShakemateCatalogSeeds('shakemate')[0].canonical_name, 'Shakemate');
    assert.equal(searchShakemateCatalogSeeds('shake mate')[0].canonical_name, 'Shakemate');
  });
});

describe('brandCatalog includes Shakemate', () => {
  it('lists Shakemate with other brand seeds', () => {
    const all = listBrandCatalogSeeds();
    assert.equal(all.length, 20);
    assert.ok(all.some((r) => r.canonical_name === 'Shakemate'));
  });

  it('search finds Shakemate', () => {
    assert.equal(searchBrandCatalogSeeds('shakemate').length, 1);
  });
});
