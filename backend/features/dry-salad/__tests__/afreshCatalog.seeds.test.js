/**
 * afreshCatalog.seeds.test.js
 * Run: node --test backend/features/dry-salad/__tests__/afreshCatalog.seeds.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  AFRESH_CINNAMON_PER_SCOOP,
  AFRESH_ELAICHI_PER_SCOOP,
  AFRESH_GINGER_PER_SCOOP,
  AFRESH_KASHMIRI_KAHWA_PER_SCOOP,
  AFRESH_LEMON_PER_SCOOP,
  AFRESH_NATURAL_TULSI_PER_SCOOP,
  AFRESH_NUTRITION_PER_SCOOP,
  AFRESH_PEACH_PER_SCOOP,
  listAfreshCatalogSeeds,
  searchAfreshCatalogSeeds,
} from '../domain/afreshCatalog.seeds.js';
import { listBrandCatalogSeeds, searchBrandCatalogSeeds } from '../domain/brandCatalog.seeds.js';

describe('afreshCatalog.seeds', () => {
  it('seeds generic Afresh plus labelled flavours', () => {
    const seeds = listAfreshCatalogSeeds();
    assert.equal(seeds.length, 8);
    assert.ok(seeds.some((r) => r.canonical_name === 'Herbalife Afresh Energy Drink'));
    assert.ok(seeds.some((r) => r.canonical_name === 'Afresh - Kashmiri Kahwa'));
    assert.ok(seeds.some((r) => r.canonical_name === 'Afresh - Elaichi'));
    assert.ok(seeds.some((r) => r.canonical_name === 'Afresh - Cinnamon'));
    assert.ok(seeds.some((r) => r.canonical_name === 'Afresh - Lemon'));
    assert.ok(seeds.some((r) => r.canonical_name === 'Afresh - Peach'));
    assert.ok(seeds.some((r) => r.canonical_name === 'Afresh - Natural Tulsi'));
    assert.ok(seeds.some((r) => r.canonical_name === 'Afresh - Ginger'));
  });

  it('generic Afresh keeps Manual-Log preset macros', () => {
    const row = listAfreshCatalogSeeds().find(
      (r) => r.canonical_name === 'Herbalife Afresh Energy Drink',
    );
    assert.equal(row.portion_label, '1 scoop');
    assert.equal(row.reference_weight_g, 1);
    assert.equal(row.nutrition.calories, AFRESH_NUTRITION_PER_SCOOP.calories);
    assert.equal(row.nutrition.sugar, 0.51);
  });

  it('Kashmiri Kahwa matches canister label Per 1 g', () => {
    const row = listAfreshCatalogSeeds().find(
      (r) => r.canonical_name === 'Afresh - Kashmiri Kahwa',
    );
    assert.equal(row.nutrition.calories, AFRESH_KASHMIRI_KAHWA_PER_SCOOP.calories);
    assert.equal(row.nutrition.sugar, 0.01);
    assert.equal(row.nutrition.sodium, 1);
  });

  it('Elaichi matches canister label Per 1 g', () => {
    const row = listAfreshCatalogSeeds().find(
      (r) => r.canonical_name === 'Afresh - Elaichi',
    );
    assert.equal(row.portion_label, '1 scoop');
    assert.equal(row.is_liquid, true);
    assert.equal(row.nutrition.calories, AFRESH_ELAICHI_PER_SCOOP.calories);
    assert.equal(row.nutrition.protein, 0.05);
    assert.equal(row.nutrition.carbs, 0.83);
    assert.equal(row.nutrition.sugar, 0.11);
    assert.equal(row.nutrition.fat, 0);
    assert.equal(row.nutrition.sodium, 1);
  });

  it('Cinnamon matches canister label Per 1 g', () => {
    const row = listAfreshCatalogSeeds().find(
      (r) => r.canonical_name === 'Afresh - Cinnamon',
    );
    assert.equal(row.nutrition.calories, AFRESH_CINNAMON_PER_SCOOP.calories);
    assert.equal(row.nutrition.sugar, 0.52);
    assert.equal(row.nutrition.sodium, 1);
  });

  it('Lemon matches canister label Per 1 g', () => {
    const row = listAfreshCatalogSeeds().find(
      (r) => r.canonical_name === 'Afresh - Lemon',
    );
    assert.equal(row.nutrition.calories, AFRESH_LEMON_PER_SCOOP.calories);
    assert.equal(row.nutrition.sugar, 0.01);
    assert.equal(row.nutrition.sodium, 1);
  });

  it('Peach matches canister label Per 1 g', () => {
    const row = listAfreshCatalogSeeds().find(
      (r) => r.canonical_name === 'Afresh - Peach',
    );
    assert.equal(row.nutrition.calories, AFRESH_PEACH_PER_SCOOP.calories);
    assert.equal(row.nutrition.sugar, 0.61);
    assert.equal(row.nutrition.sodium, 1);
  });

  it('Natural Tulsi matches canister label Per 1 g', () => {
    const row = listAfreshCatalogSeeds().find(
      (r) => r.canonical_name === 'Afresh - Natural Tulsi',
    );
    assert.equal(row.nutrition.calories, AFRESH_NATURAL_TULSI_PER_SCOOP.calories);
    assert.equal(row.nutrition.sugar, 0.51);
    assert.equal(row.nutrition.sodium, 1);
  });

  it('Ginger matches canister label Per 1 g', () => {
    const row = listAfreshCatalogSeeds().find(
      (r) => r.canonical_name === 'Afresh - Ginger',
    );
    assert.equal(row.nutrition.calories, AFRESH_GINGER_PER_SCOOP.calories);
    assert.equal(row.nutrition.sugar, 0.11);
    assert.equal(row.nutrition.sodium, 1);
  });

  it('search finds flavours by name', () => {
    assert.equal(searchAfreshCatalogSeeds('kashmiri')[0].canonical_name, 'Afresh - Kashmiri Kahwa');
    assert.equal(searchAfreshCatalogSeeds('elaichi')[0].canonical_name, 'Afresh - Elaichi');
    assert.equal(searchAfreshCatalogSeeds('cinnamon')[0].canonical_name, 'Afresh - Cinnamon');
    assert.equal(searchAfreshCatalogSeeds('lemon')[0].canonical_name, 'Afresh - Lemon');
    assert.equal(searchAfreshCatalogSeeds('peach')[0].canonical_name, 'Afresh - Peach');
    assert.equal(searchAfreshCatalogSeeds('tulsi')[0].canonical_name, 'Afresh - Natural Tulsi');
    assert.equal(searchAfreshCatalogSeeds('ginger')[0].canonical_name, 'Afresh - Ginger');
    assert.ok(searchAfreshCatalogSeeds('afresh').length >= 8);
  });
});

describe('brandCatalog.seeds', () => {
  it('includes Formula 1, Afresh, Protein, and Shakemate', () => {
    const all = listBrandCatalogSeeds();
    assert.equal(all.length, 20);
    assert.ok(all.some((r) => r.canonical_name === 'Formula 1 - Vanilla'));
    assert.ok(all.some((r) => r.canonical_name === 'Afresh - Ginger'));
    assert.ok(all.some((r) => r.canonical_name === 'Personalized Protein Powder'));
    assert.ok(all.some((r) => r.canonical_name === 'Shakemate'));
  });

  it('searchBrandCatalogSeeds finds both product lines', () => {
    assert.ok(searchBrandCatalogSeeds('formula 1').length >= 10);
    assert.ok(searchBrandCatalogSeeds('afresh').length >= 8);
    assert.equal(searchBrandCatalogSeeds('ginger').length, 1);
  });
});
