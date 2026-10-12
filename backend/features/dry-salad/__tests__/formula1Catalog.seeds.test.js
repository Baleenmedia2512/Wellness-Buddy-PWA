/**
 * formula1Catalog.seeds.test.js
 * Run: node --test features/dry-salad/__tests__/formula1Catalog.seeds.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  FORMULA1_FLAVORS,
  FORMULA1_LABEL_SCOOPS,
  FORMULA1_NUTRITION_PER_25G,
  formula1NutritionPerScoop,
  listFormula1CatalogSeeds,
  searchFormula1CatalogSeeds,
} from '../domain/formula1Catalog.seeds.js';
import { mergeCatalogRows, takeCatalogPage } from '../domain/mergeCatalog.rules.js';

describe('formula1Catalog.seeds', () => {
  it('exposes exactly the ten agreed flavours including Dutch Chocolate', () => {
    assert.deepEqual(FORMULA1_FLAVORS, [
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
    assert.equal(listFormula1CatalogSeeds().length, 10);
  });

  it('derives 1-scoop nutrition as label Per 25 g ÷ 3', () => {
    const one = formula1NutritionPerScoop();
    assert.equal(one.calories, 31.4);
    assert.equal(one.protein, 3);
    assert.equal(one.carbs, 3.5);
    assert.equal(one.fat, 0.6);
    assert.equal(one.fiber, 1);
    assert.equal(one.sugar, 1.6);
    assert.equal(one.sodium, 41);
    assert.equal(one.cholesterol, 0.5);
    assert.equal(one.vitamin_a, 70);
    assert.ok(
      Math.abs((one.calories * FORMULA1_LABEL_SCOOPS) - FORMULA1_NUTRITION_PER_25G.calories) < 0.01,
    );
  });

  it('seeds are 1 scoop Formula 1 rows with shared macros', () => {
    const seeds = listFormula1CatalogSeeds();
    for (const row of seeds) {
      assert.match(row.canonical_name, /^Formula 1 - /);
      assert.equal(row.portion_label, '1 scoop');
      assert.equal(row.reference_weight_g, 8.33);
      assert.equal(row.status, 'approved');
      assert.equal(row.nutrition.calories, 31.4);
      assert.equal(row.nutrition.protein, 3);
      assert.ok(row.normalized_name.includes('formula 1'));
    }
    assert.ok(seeds.some((r) => r.canonical_name === 'Formula 1 - Dutch Chocolate'));
  });

  it('search finds flavours by name and chocolate alias', () => {
    const mango = searchFormula1CatalogSeeds('mango');
    assert.equal(mango.length, 1);
    assert.equal(mango[0].canonical_name, 'Formula 1 - Mango');

    const choc = searchFormula1CatalogSeeds('chocolate');
    assert.ok(choc.some((r) => r.canonical_name === 'Formula 1 - Dutch Chocolate'));

    const f1 = searchFormula1CatalogSeeds('formula 1');
    assert.equal(f1.length, 10);
  });
});

describe('mergeCatalogRows', () => {
  it('lets DB override the same normalized seed name', () => {
    const seeds = listFormula1CatalogSeeds();
    const vanilla = seeds.find((r) => r.canonical_name === 'Formula 1 - Vanilla');
    const db = [{
      ...vanilla,
      id: 'db-vanilla',
      nutrition: { ...vanilla.nutrition, calories: 99 },
    }];
    const merged = mergeCatalogRows(db, seeds);
    const hit = merged.find((r) => r.normalized_name === vanilla.normalized_name);
    assert.equal(hit.id, 'db-vanilla');
    assert.equal(hit.nutrition.calories, 99);
    assert.equal(merged.length, 10);
  });

  it('takeCatalogPage keeps brand seeds when the browse cap is tight', () => {
    const seeds = listFormula1CatalogSeeds();
    const fillers = Array.from({ length: 40 }, (_, i) => ({
      id: `filler-${i}`,
      canonical_name: `Aloe Item ${i}`,
      normalized_name: `aloe item ${i}`,
      nutrition: { calories: 1 },
    }));
    const merged = mergeCatalogRows(fillers, seeds);
    const page = takeCatalogPage(merged, seeds, 15);
    assert.equal(page.length, 15);
    assert.equal(
      page.filter((r) => String(r.canonical_name).startsWith('Formula 1 - ')).length,
      10,
    );
  });
});

