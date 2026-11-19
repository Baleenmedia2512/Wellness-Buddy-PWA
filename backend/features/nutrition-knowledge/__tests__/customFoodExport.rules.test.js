/**
 * customFoodExport.rules.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CUSTOM_FOOD_EXPORT_COLUMNS,
  CUSTOM_FOOD_META_COLUMNS,
  buildCustomFoodExportCsv,
} from '../domain/customFoodExport.rules.js';
import { NUTRITION_KEYS } from '../domain/nutrition.rules.js';

describe('buildCustomFoodExportCsv', () => {
  it('uses meta columns plus full macros/vitamins/minerals', () => {
    assert.deepEqual([...CUSTOM_FOOD_META_COLUMNS], [
      'user_id',
      'food_name',
      'unit',
      'quantity',
      'created_at',
      'profile_id',
    ]);
    assert.equal(CUSTOM_FOOD_EXPORT_COLUMNS.length, CUSTOM_FOOD_META_COLUMNS.length + NUTRITION_KEYS.length);
    assert.ok(CUSTOM_FOOD_EXPORT_COLUMNS.includes('calories'));
    assert.ok(CUSTOM_FOOD_EXPORT_COLUMNS.includes('vitamin_c'));
    assert.ok(CUSTOM_FOOD_EXPORT_COLUMNS.includes('iron'));
    assert.ok(CUSTOM_FOOD_EXPORT_COLUMNS.includes('glycemic_index'));
  });

  it('exports submission rows with empty nutrition cells for fill-in', () => {
    const csv = buildCustomFoodExportCsv([
      {
        user_id: 339,
        food_name: 'sambar',
        unit: 'ml',
        quantity: 100,
        created_at: '2026-10-11T10:00:00.000Z',
        profile_id: 12,
        master_nutrition: {},
      },
    ]);
    const header = csv.split('\n')[0];
    assert.ok(header.startsWith('user_id,food_name,unit,quantity,created_at,profile_id,calories,'));
    assert.ok(header.includes('vitamin_a'));
    assert.ok(header.includes('calcium'));
    assert.match(csv, /339,sambar,ml,100,/);
  });

  it('includes filled macros vitamins and minerals when present', () => {
    const csv = buildCustomFoodExportCsv([
      {
        user_id: 10,
        food_name: 'sambar',
        unit: 'ml',
        quantity: 250,
        created_at: '2026-10-11T11:00:00.000Z',
        profile_id: 12,
        master_nutrition: {
          calories: 80,
          protein: 3,
          carbs: 12,
          fat: 1,
          fiber: 2,
          vitamin_c: 5,
          iron: 0.4,
        },
      },
    ]);
    assert.match(csv, /10,sambar,ml,250,.+,12,80,3,12,1,2/);
    assert.match(csv, /,5,/); // vitamin_c among vitamin columns
  });
});
