/**
 * personalizedProteinCatalog.seeds.test.js
 * Run: node --test backend/features/dry-salad/__tests__/personalizedProteinCatalog.seeds.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  PERSONALIZED_PROTEIN_PER_SCOOP,
  listPersonalizedProteinCatalogSeeds,
  searchPersonalizedProteinCatalogSeeds,
} from '../domain/personalizedProteinCatalog.seeds.js';
import { listBrandCatalogSeeds, searchBrandCatalogSeeds } from '../domain/brandCatalog.seeds.js';

describe('personalizedProteinCatalog.seeds', () => {
  it('seeds 1 scoop (6 g) from canister label', () => {
    const seeds = listPersonalizedProteinCatalogSeeds();
    assert.equal(seeds.length, 1);
    const row = seeds[0];
    assert.equal(row.canonical_name, 'Personalized Protein Powder');
    assert.equal(row.portion_label, '1 scoop');
    assert.equal(row.reference_weight_g, 6);
    assert.equal(row.is_liquid, false);
    assert.equal(row.status, 'approved');
    assert.equal(row.nutrition.calories, PERSONALIZED_PROTEIN_PER_SCOOP.calories);
    assert.equal(row.nutrition.protein, 4.96);
    assert.equal(row.nutrition.carbs, 0.24);
    assert.equal(row.nutrition.fat, 0.18);
    assert.equal(row.nutrition.sugar, 0);
    assert.equal(row.nutrition.sodium, 68);
    assert.equal(row.nutrition.cholesterol, 0);
  });

  it('search finds by PPP and protein aliases', () => {
    assert.equal(searchPersonalizedProteinCatalogSeeds('ppp')[0].canonical_name, 'Personalized Protein Powder');
    assert.ok(searchPersonalizedProteinCatalogSeeds('protein').length >= 1);
  });
});

describe('brandCatalog includes Personalized Protein', () => {
  it('lists protein with Formula 1 and Afresh', () => {
    const all = listBrandCatalogSeeds();
    assert.equal(all.length, 20);
    assert.ok(all.some((r) => r.canonical_name === 'Personalized Protein Powder'));
  });

  it('search finds protein powder', () => {
    assert.equal(searchBrandCatalogSeeds('personalized protein').length, 1);
  });
});
