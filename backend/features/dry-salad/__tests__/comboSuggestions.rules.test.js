/**
 * comboSuggestions.rules.test.js
 * Run: node --test features/dry-salad/__tests__/comboSuggestions.rules.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCatalogIndex,
  comboKeyFromFoods,
  collectOftenItems,
  extractDrySaladFoods,
  intakeSlotFromAnalysis,
  normalizeItemKey,
  pickUsualCombo,
} from '../domain/comboSuggestions.rules.js';

const CATALOG = buildCatalogIndex([
  { canonical_name: 'Formula 1', normalized_name: 'formula 1', aliases: ['f1'] },
  { canonical_name: 'Protein Powder', normalized_name: 'protein powder', aliases: [] },
  { canonical_name: 'Aloe', normalized_name: 'aloe', aliases: [] },
]);

function food(name) {
  return { name, key: normalizeItemKey(name), food: { name } };
}

describe('comboSuggestions.rules', () => {
  it('normalizeItemKey collapses case and spaces', () => {
    assert.equal(normalizeItemKey('  Formula   1 '), 'formula 1');
  });

  it('buildCatalogIndex indexes aliases', () => {
    assert.equal(CATALOG.byKey.get('f1')?.canonical_name, 'Formula 1');
    assert.ok(CATALOG.keys.has('protein powder'));
  });

  it('extractDrySaladFoods keeps only catalog matches', () => {
    const foods = extractDrySaladFoods({
      foods: [
        { name: 'Formula 1' },
        { name: 'Idli' },
        { name: 'Protein Powder' },
      ],
    }, CATALOG.keys);
    assert.deepEqual(foods.map((f) => f.name), ['Formula 1', 'Protein Powder']);
  });

  it('intakeSlotFromAnalysis reads the stamped slot', () => {
    assert.equal(intakeSlotFromAnalysis({ intakeSlot: 'Evening', foods: [] }), 'evening');
    assert.equal(intakeSlotFromAnalysis({ foods: [] }), null);
  });

  it('extractDrySaladFoods keeps every food when mealKind is dry-salad', () => {
    const foods = extractDrySaladFoods({
      mealKind: 'dry-salad',
      foods: [{ name: 'Custom Herb Mix' }, { name: 'Formula 1' }],
    }, CATALOG.keys);
    assert.deepEqual(foods.map((f) => f.name), ['Custom Herb Mix', 'Formula 1']);
  });

  it('comboKeyFromFoods is order-independent', () => {
    assert.equal(
      comboKeyFromFoods([food('Protein Powder'), food('Formula 1')]),
      comboKeyFromFoods([food('Formula 1'), food('Protein Powder')]),
    );
  });

  it('pickUsualCombo returns the most frequent set in the slot', () => {
    const morningPair = [food('Formula 1'), food('Protein Powder')];
    const morningSingle = [food('Aloe')];
    const picked = pickUsualCombo([
      { foods: morningPair },
      { foods: morningSingle },
      { foods: morningPair },
    ]);
    assert.equal(picked.count, 2);
    assert.deepEqual(picked.items.map((f) => f.name), ['Formula 1', 'Protein Powder']);
  });

  it('pickUsualCombo ties keep the newest (first) combo', () => {
    const a = [food('Formula 1')];
    const b = [food('Aloe')];
    const picked = pickUsualCombo([
      { foods: a },
      { foods: b },
    ]);
    assert.equal(picked.count, 1);
    assert.deepEqual(picked.items.map((f) => f.name), ['Formula 1']);
  });

  it('evening does not pick an afternoon combo', () => {
    const afternoon = [food('Formula 1'), food('Protein Powder')];
    const evening = [food('Aloe')];
    const inEvening = [
      { slot: 'afternoon', foods: afternoon },
      { slot: 'evening', foods: evening },
    ].filter((row) => row.slot === 'evening');
    const picked = pickUsualCombo(inEvening);
    assert.deepEqual(picked.items.map((f) => f.name), ['Aloe']);
  });

  it('pickUsualCombo returns empty when there is no slot history', () => {
    const picked = pickUsualCombo([]);
    assert.deepEqual(picked.items, []);
    assert.equal(picked.count, 0);
  });

  it('collectOftenItems excludes the usual combo and ranks by frequency', () => {
    const often = collectOftenItems([
      { foods: [food('Formula 1'), food('Aloe')] },
      { foods: [food('Formula 1'), food('Aloe')] },
      { foods: [food('Formula 1'), food('Protein Powder')] },
    ], new Set(['formula 1']), 8);
    assert.deepEqual(often.map((f) => f.name), ['Aloe', 'Protein Powder']);
    assert.equal(often[0].score, 2);
  });
});
