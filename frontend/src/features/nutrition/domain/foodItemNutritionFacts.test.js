/**
 * Per-item nutrition facts — never meal totals.
 * Run: node --test frontend/src/features/nutrition/domain/foodItemNutritionFacts.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildFoodItemNutritionFacts,
  formatFactValue,
  giShareLetter,
  giZone,
} from './foodItemNutritionFacts.js';

describe('formatFactValue', () => {
  it('rounds calories and GI to integers', () => {
    assert.equal(formatFactValue(123.6, 'calories'), '124');
    assert.equal(formatFactValue(54.4, 'glycemic_index'), '54');
  });

  it('keeps one decimal for grams when needed', () => {
    assert.equal(formatFactValue(12, 'protein'), '12');
    assert.equal(formatFactValue(12.4, 'protein'), '12.4');
  });
});

describe('giZone', () => {
  it('classifies low / medium / high', () => {
    assert.equal(giZone(55).tone, 'low');
    assert.equal(giZone(56).tone, 'medium');
    assert.equal(giZone(70).tone, 'high');
    assert.equal(giZone(null), null);
  });
});

describe('giShareLetter', () => {
  it('maps GI bands to l / m / h for WhatsApp captions', () => {
    assert.equal(giShareLetter(55), 'l');
    assert.equal(giShareLetter(65), 'm');
    assert.equal(giShareLetter(70), 'h');
    assert.equal(giShareLetter(null), null);
  });
});

describe('buildFoodItemNutritionFacts', () => {
  it('uses the selected item only, not meal totals', () => {
    const facts = buildFoodItemNutritionFacts({
      name: 'Herbalife Niteworks (Cardiovascular Health)',
      nutrition: {
        calories: 10,
        protein: 0,
        carbs: 2,
        fat: 0,
        fiber: 0,
        sugar: 1,
        glycemic_index: 0,
      },
    });
    assert.equal(facts.name, 'Herbalife Niteworks (Cardiovascular Health)');
    const byKey = Object.fromEntries(facts.rows.map((r) => [r.key, r]));
    assert.equal(byKey.calories.value, '10');
    assert.equal(byKey.protein.value, '0');
    assert.equal(byKey.carbs.value, '2');
    assert.equal(byKey.available_carbohydrate.value, '2');
    assert.equal(byKey.sugar.value, '1');
    assert.equal(byKey.glycemic_index.value, '0');
  });

  it('computes available carbohydrate as carbs minus fibre', () => {
    const facts = buildFoodItemNutritionFacts({
      name: 'Oats',
      nutrition: { calories: 150, protein: 5, carbs: 27, fiber: 4, fat: 3, sugar: 1 },
    });
    const available = facts.rows.find((r) => r.key === 'available_carbohydrate');
    assert.equal(available.value, '23');
  });

  it('omits GI and available carbs when they cannot be derived', () => {
    const facts = buildFoodItemNutritionFacts({
      name: 'Olive oil',
      nutrition: { calories: 120, protein: 0, fat: 14 },
    });
    const keys = facts.rows.map((r) => r.key);
    assert.equal(keys.includes('glycemic_index'), false);
    assert.equal(keys.includes('available_carbohydrate'), false);
    assert.equal(keys.includes('carbs'), true);
  });

  it('reads nested or flat nutrition and extra micros when present', () => {
    const facts = buildFoodItemNutritionFacts({
      name: 'Skin Booster',
      calories: 80,
      protein: 2,
      carbs: 18,
      fat: 0,
      fiber: 1,
      sodium: 40,
      vitamin_c: 30,
    });
    const byKey = Object.fromEntries(facts.rows.map((r) => [r.key, r]));
    assert.equal(byKey.calories.value, '80');
    assert.equal(byKey.sodium.value, '40');
    assert.equal(byKey.vitamin_c.value, '30');
    assert.equal(byKey.vitamin_c.unit, 'mg');
  });

  it('shows only extras that have a stored non-zero value', () => {
    const facts = buildFoodItemNutritionFacts({
      name: 'Tea',
      nutrition: { calories: 2, protein: 0, carbs: 0, fat: 0, fiber: 0, sodium: 0, iron: 0, vitamin_c: 4 },
    });
    const keys = facts.rows.map((r) => r.key);
    assert.equal(keys.includes('sodium'), false);
    assert.equal(keys.includes('iron'), false);
    assert.equal(keys.includes('vitamin_a'), false);
    assert.equal(keys.includes('calcium'), false);
    assert.equal(keys.includes('vitamin_c'), true);
  });

  it('reads camelCase vitamin aliases from nested nutrition', () => {
    const facts = buildFoodItemNutritionFacts({
      name: 'Idli',
      nutrition: { calories: 350, protein: 10, carbs: 60, fat: 8, fiber: 5, vitaminC: 4, calcium: 40 },
    });
    const byKey = Object.fromEntries(facts.rows.map((r) => [r.key, r]));
    assert.equal(byKey.vitamin_c.value, '4');
    assert.equal(byKey.calcium.value, '40');
    assert.equal(byKey.calcium.section, 'minerals');
  });
});
