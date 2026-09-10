/**
 * Run: node --test backend/shared/lib/ai-orchestration/__tests__/AIGateway.nutrition-sum.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  sumNutritionFields,
  sumEnrichmentFields,
} from '../nutrition-totals.js';

const gatewaySrc = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'AIGateway.js'),
  'utf8',
);

const ALL_KEYS = Object.freeze([
  'calories', 'protein', 'carbs', 'fat', 'fiber', 'sugar', 'sodium', 'cholesterol', 'glycemic_index',
  'vitamin_a', 'vitamin_c', 'vitamin_d', 'vitamin_e', 'vitamin_k',
  'vitamin_b1', 'vitamin_b2', 'vitamin_b3', 'vitamin_b6', 'vitamin_b9', 'vitamin_b12',
  'calcium', 'iron', 'magnesium', 'potassium', 'zinc', 'phosphorus',
]);

const SHAKE_NUTRITION = Object.freeze({
  calories: 223,
  protein: 24.73,
  carbs: 24.24,
  fat: 2.98,
  fiber: 3.00,
  sugar: 11.57,
  sodium: 355,
  cholesterol: 7,
  glycemic_index: 20,
  vitamin_a: 210,
  vitamin_c: 15,
  vitamin_d: 3.40,
  vitamin_e: 5,
  vitamin_k: 0,
  vitamin_b1: 0.45,
  vitamin_b2: 0.45,
  vitamin_b3: 5,
  vitamin_b6: 0.80,
  vitamin_b9: 85,
  vitamin_b12: 0.40,
  calcium: 129,
  iron: 3,
  magnesium: 50,
  potassium: 260,
  zinc: 2.5,
  phosphorus: 0,
});

function isShakeName(name) {
  const n = String(name ?? '').trim().toLowerCase();
  return n === 'herbalife shake' || (n.includes('herbalife') && n.includes('shake'));
}

function totalOf(foods) {
  return sumNutritionFields(foods, {
    isShakeName,
    cloneShakeNutrition: () => ({ ...SHAKE_NUTRITION }),
    allKeys: ALL_KEYS,
  });
}

describe('sumNutritionFields glycemic index', () => {
  it('does not sum item GI values for a mixed Tamil Nadu plate', () => {
    const total = totalOf([
      { name: 'Plain White Rice', nutrition: { calories: 260, protein: 5, carbs: 43, fat: 0.6, fiber: 0, glycemic_index: 73, calcium: 10 } },
      { name: 'Sambar', nutrition: { calories: 90, protein: 4, carbs: 24, fat: 2, fiber: 0, glycemic_index: 50, calcium: 20 } },
    ]);

    assert.equal(total.calories, 350);
    assert.equal(total.protein, 9);
    assert.equal(total.carbs, 67);
    assert.equal(total.calcium, 30);
    assert.notEqual(total.glycemic_index, 123);
    assert.equal(total.glycemic_index, 65);
    assert.ok(total.glycemic_index >= 0 && total.glycemic_index <= 100);
  });

  it('returns the fixed shake profile GI for shake-only meals', () => {
    const total = totalOf([
      { name: 'Herbalife Shake', nutrition: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, glycemic_index: 0 } },
    ]);

    assert.equal(total.calories, 223);
    assert.equal(total.protein, 24.73);
    assert.equal(total.glycemic_index, 20);
  });

  it('adds shake extras into macros but uses carb-weighted meal GI', () => {
    const banana = {
      name: 'Banana',
      nutrition: {
        calories: 105,
        protein: 1.3,
        carbs: 27,
        fat: 0.4,
        fiber: 3.1,
        sugar: 14,
        sodium: 1,
        cholesterol: 0,
        glycemic_index: 51,
        calcium: 6,
        potassium: 422,
      },
    };
    const total = totalOf([
      { name: 'Herbalife Shake', nutrition: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, glycemic_index: 0 } },
      banana,
    ]);

    assert.equal(total.calories, 223 + 105);
    assert.equal(total.protein, 24.73 + 1.3);
    assert.equal(total.carbs, 24.24 + 27);
    assert.notEqual(total.glycemic_index, 20 + 51);
    // Shake available carbs 21.24; banana 23.9 → round((20*21.24 + 51*23.9) / 45.14) = 36
    assert.equal(total.glycemic_index, 36);
  });

  it('keeps water-only GI at 0', () => {
    const total = totalOf([
      { name: 'Plain Water', nutrition: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, glycemic_index: 0 } },
    ]);
    assert.equal(total.calories, 0);
    assert.equal(total.glycemic_index, 0);
  });
});

describe('sumEnrichmentFields', () => {
  it('does not add glycemic_index when merging shake + extras', () => {
    const merged = sumEnrichmentFields(
      { vitamin_c: 15, glycemic_index: 20, calcium: 129 },
      { vitamin_c: 10, glycemic_index: 51, calcium: 6 },
      ['vitamin_c', 'glycemic_index', 'calcium'],
    );
    assert.equal(merged.vitamin_c, 25);
    assert.equal(merged.calcium, 135);
    assert.equal(merged.glycemic_index, undefined);
  });
});

describe('unified and enrichment prompt zero / GI rules', () => {
  it('UNIFIED_PROMPT estimates micros instead of zero-filling unknowns', () => {
    assert.equal(gatewaySrc.includes('Absent/unknown'), false);
    assert.match(gatewaySrc, /NEVER use 0 merely because a nutrient is unknown/);
    assert.match(gatewaySrc, /glycemic_index is NOT additive/);
    assert.match(gatewaySrc, /Estimate the actual visible portion/);
    assert.match(gatewaySrc, /Never merge distinct foods/);
  });

  it('UNIFIED_PROMPT keeps existing Herbalife, water-bottle, naming, and unit rules', () => {
    assert.match(gatewaySrc, /NOT a meal/);
    assert.match(gatewaySrc, /never 750 ml/);
    assert.match(gatewaySrc, /never generic "Food"\/"Drink"\/"Meal"/);
    assert.match(gatewaySrc, /vitamin_a: µg RAE/);
    assert.match(gatewaySrc, /identify only; do not estimate nutrition when shown separately/);
    assert.match(gatewaySrc, /Herbalife High Protein Iced Coffee[\s\S]*identify only; do not estimate nutrition/);
    assert.match(gatewaySrc, /set all nutrition fields to 0; the server applies the fixed standard recipe profile/);
    assert.match(gatewaySrc, /Plain water: all nutrients 0/);
  });

  it('buildEnrichmentPrompt does not tell the model to zero-fill unknowns', () => {
    assert.equal(gatewaySrc.includes('absent/unknown'), false);
    assert.match(gatewaySrc, /glycemic_index is a meal-level 0–100 estimate/);
    assert.match(gatewaySrc, /vitamin_a µg RAE/);
  });
});
