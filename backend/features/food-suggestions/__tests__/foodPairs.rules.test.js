/**
 * foodPairs.rules.test.js
 * Run: node --test features/food-suggestions/__tests__/foodPairs.rules.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeFoodNameKey,
  enumerateUndirectedPairs,
  extractFoodNamesFromAnalysis,
  extractLatestFoodsFromMeals,
  isDrySaladAnalysis,
  isHerbalifeProductSuggestionName,
  mergeOftenWithPersonalFirst,
  partnersFromPairRows,
  PERSONAL_SUFFICIENT_COUNT,
  MIN_GLOBAL_PAIR_COUNT,
} from '../domain/foodPairs.rules.js';

describe('foodPairs.rules', () => {
  it('normalizeFoodNameKey collapses case and spaces', () => {
    assert.equal(normalizeFoodNameKey('  Masala   Dosa '), 'masala dosa');
  });

  it('enumerateUndirectedPairs orders keys lexicographically', () => {
    const pairs = enumerateUndirectedPairs(['Omelette', 'Dosa', 'Chutney']);
    assert.equal(pairs.length, 3);
    for (const p of pairs) {
      assert.ok(p.keyA < p.keyB);
    }
    const keys = pairs.map((p) => `${p.keyA}|${p.keyB}`).sort();
    assert.deepEqual(keys, [
      'chutney|dosa',
      'chutney|omelette',
      'dosa|omelette',
    ]);
  });

  it('isDrySaladAnalysis detects Target Nutrition meals', () => {
    assert.equal(isDrySaladAnalysis({ mealKind: 'dry-salad', foods: [{ name: 'Formula 1' }] }), true);
    assert.equal(isDrySaladAnalysis({ foods: [{ name: 'Dosa' }] }), false);
  });

  it('isHerbalifeProductSuggestionName detects Herbalife-prefixed names', () => {
    assert.equal(isHerbalifeProductSuggestionName('Herbalife Afresh Energy Drink'), true);
    assert.equal(isHerbalifeProductSuggestionName('*Herbalife Multivitamin Mineral'), true);
    assert.equal(isHerbalifeProductSuggestionName('  *  Herbalife Shake'), true);
    assert.equal(isHerbalifeProductSuggestionName('Dosa'), false);
    assert.equal(isHerbalifeProductSuggestionName('Plain Water'), false);
  });

  it('extractLatestFoodsFromMeals skips Herbalife product names', () => {
    const latest = extractLatestFoodsFromMeals([
      {
        AnalysisData: {
          foods: [
            { name: 'Herbalife Afresh Energy Drink' },
            { name: 'Mutton Biryani (Hyderabadi)' },
            { name: '*Herbalife Multivitamin Mineral' },
            { name: 'Dosa' },
          ],
        },
      },
    ], 12, null);
    assert.deepEqual(latest.map((f) => f.name), [
      'Mutton Biryani (Hyderabadi)',
      'Dosa',
    ]);
  });

  it('mergeOftenWithPersonalFirst skips Herbalife partners', () => {
    const personal = [
      { key: 'herbalife afresh energy drink', display: 'Herbalife Afresh Energy Drink', score: 5 },
      { key: 'sambar', display: 'Sambar', score: 3 },
    ];
    const merged = mergeOftenWithPersonalFirst(personal, [], { limit: 8 });
    assert.deepEqual(merged.map((m) => m.key), ['sambar']);
  });

  it('extractLatestFoodsFromMeals skips dry-salad meals and catalog names', () => {
    const latest = extractLatestFoodsFromMeals([
      { AnalysisData: { mealKind: 'dry-salad', foods: [{ name: 'Formula 1' }] } },
      { AnalysisData: { foods: [{ name: 'Protein Powder' }, { name: 'Dosa' }] } },
      { AnalysisData: { foods: [{ name: 'Idli' }] } },
    ], 12, new Set(['protein powder']));
    assert.deepEqual(latest.map((f) => f.name), ['Dosa', 'Idli']);
  });

  it('extractFoodNamesFromAnalysis dedupes', () => {
    const names = extractFoodNamesFromAnalysis({
      foods: [
        { name: 'Dosa' },
        { name: 'dosa' },
        { name: 'Chutney' },
      ],
    });
    assert.deepEqual(names, ['Dosa', 'Chutney']);
  });

  it('partnersFromPairRows returns other side of undirected pair', () => {
    const partners = partnersFromPairRows('dosa', [
      { food_a: 'chutney', food_b: 'dosa', pair_count: 5 },
      { food_a: 'dosa', food_b: 'omelette', pair_count: 2 },
      { food_a: 'idli', food_b: 'sambar', pair_count: 9 },
    ], 1);
    assert.equal(partners[0].key, 'chutney');
    assert.equal(partners[0].score, 5);
    assert.equal(partners[1].key, 'omelette');
  });

  it('mergeOftenWithPersonalFirst skips global when personal is sufficient', () => {
    const personal = [
      { key: 'chutney', display: 'Chutney', score: 4 },
      { key: 'omelette', display: 'Omelette', score: 3 },
      { key: 'sambar', display: 'Sambar', score: 2 },
    ];
    const global = [
      { key: 'coffee', display: 'Coffee', score: 99 },
    ];
    const merged = mergeOftenWithPersonalFirst(personal, global, {
      limit: 8,
      sufficientCount: PERSONAL_SUFFICIENT_COUNT,
    });
    assert.equal(merged.length, 3);
    assert.ok(merged.every((m) => m.source === 'personal'));
    assert.ok(!merged.some((m) => m.key === 'coffee'));
  });

  it('mergeOftenWithPersonalFirst tops up from global when personal is thin', () => {
    const personal = [
      { key: 'chutney', display: 'Chutney', score: 2 },
    ];
    const global = [
      { key: 'omelette', display: 'Omelette', score: MIN_GLOBAL_PAIR_COUNT + 1 },
      { key: 'chutney', display: 'Chutney', score: 50 },
    ];
    const merged = mergeOftenWithPersonalFirst(personal, global, {
      limit: 5,
      sufficientCount: PERSONAL_SUFFICIENT_COUNT,
    });
    assert.equal(merged[0].source, 'personal');
    assert.equal(merged[0].key, 'chutney');
    assert.equal(merged[1].source, 'global');
    assert.equal(merged[1].key, 'omelette');
    assert.equal(merged.filter((m) => m.key === 'chutney').length, 1);
  });
});
