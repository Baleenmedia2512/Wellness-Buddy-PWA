/**
 * backend/features/nutrition-knowledge/__tests__/nutrition.rules.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeFoodName,
  foodNameMatchesQuery,
  foodNameMatchIndex,
  sortByFoodNameMatch,
  editDistance,
  pickNutrition,
  scaleNutrition,
  profileToSearchItem,
  mergeSearchResults,
  shouldAutoPromote,
  AUTO_PROMOTE_SIGHTINGS,
  buildCustomFoodPortionLabel,
} from '../domain/nutrition.rules.js';
import { findSeedProfile, searchSeedProfiles } from '../domain/seeds.js';
import { validateCustomFood } from '../validation/resolve.schema.js';
import { ValidationError } from '../../../shared/lib/ValidationError.js';

describe('normalizeFoodName', () => {
  it('lowercases and collapses whitespace', () => {
    assert.equal(normalizeFoodName('  Banana  Fruit '), 'banana fruit');
  });
});

describe('editDistance', () => {
  it('counts single-character typos', () => {
    assert.equal(editDistance('omelette', 'omlette'), 1);
    assert.equal(editDistance('omelette', 'omelete'), 1);
  });
});

describe('foodNameMatchesQuery', () => {
  it('matches single-letter prefixes', () => {
    assert.equal(foodNameMatchesQuery('Onion', 'o'), true);
    assert.equal(foodNameMatchesQuery('Omelette', 'o'), true);
    assert.equal(foodNameMatchesQuery('Banana', 'o'), false);
  });

  it('matches multi-letter prefixes and typos via aliases', () => {
    assert.equal(foodNameMatchesQuery('Omelette', 'om'), true);
    assert.equal(foodNameMatchesQuery('Omelette', 'omlette', ['omlette', 'omelet']), true);
    assert.equal(foodNameMatchesQuery('Omelette', 'omlette'), true);
  });
});

describe('foodNameMatchIndex / sortByFoodNameMatch', () => {
  it('ranks earlier letter positions first', () => {
    assert.equal(foodNameMatchIndex('Onion', 'o'), 0);
    assert.equal(foodNameMatchIndex('Boiled Egg', 'o'), 1);
    assert.equal(foodNameMatchIndex('Beetroot', 'o'), 5);
  });

  it('sorts suggestions by match position then name', () => {
    const sorted = sortByFoodNameMatch(
      [
        { name: 'Beetroot Poriyal' },
        { name: 'Onion' },
        { name: 'Boiled Egg' },
        { name: 'Coconut Chutney' },
      ],
      'o',
    ).map((i) => i.name);
    assert.deepEqual(sorted, [
      'Onion',
      'Boiled Egg',
      'Coconut Chutney',
      'Beetroot Poriyal',
    ]);
  });
});

describe('scaleNutrition', () => {
  it('scales linearly by weight', () => {
    const scaled = scaleNutrition({ calories: 100, protein: 10 }, 100, 50);
    assert.equal(scaled.calories, 50);
    assert.equal(scaled.protein, 5);
  });
});

describe('pickNutrition', () => {
  it('keeps only known keys', () => {
    const n = pickNutrition({ calories: 10, foo: 1, vitamin_c: 5 });
    assert.deepEqual(n, { calories: 10, vitamin_c: 5 });
  });
});

describe('profileToSearchItem', () => {
  it('returns scaled master item', () => {
    const item = profileToSearchItem({
      id: 1,
      canonical_name: 'Banana',
      reference_weight_g: 100,
      nutrition: { calories: 100, potassium: 400 },
      portion_label: '100g',
      is_liquid: false,
    }, 50);
    assert.equal(item.name, 'Banana');
    assert.equal(item.calories, 50);
    assert.equal(item.potassium, 200);
    assert.equal(item.source, 'master');
    assert.equal(item.unit, 'g');
  });

  it('marks liquids with ml unit and empty nutrition as 0 macros', () => {
    const item = profileToSearchItem({
      id: 2,
      canonical_name: 'subja',
      reference_weight_g: 100,
      nutrition: {},
      portion_label: '100 ml',
      is_liquid: true,
    });
    assert.equal(item.unit, 'ml');
    assert.equal(item.volume_ml, 100);
    assert.equal(item.calories, undefined);
    assert.equal(item.portion, '100 ml');
  });
});

describe('buildCustomFoodPortionLabel', () => {
  it('formats g and ml labels', () => {
    assert.equal(buildCustomFoodPortionLabel(100, 'g'), '100 g');
    assert.equal(buildCustomFoodPortionLabel(250, 'ml'), '250 ml');
  });
});

describe('validateCustomFood', () => {
  it('accepts name + unit + positive serving', () => {
    assert.deepEqual(validateCustomFood({ name: 'subja', unit: 'ml', servingSize: 100 }), {
      name: 'subja',
      unit: 'ml',
      servingSize: 100,
      userId: null,
    });
  });

  it('rejects empty name and non-positive serving', () => {
    assert.throws(() => validateCustomFood({ name: '  ', unit: 'g', servingSize: 100 }), ValidationError);
    assert.throws(() => validateCustomFood({ name: 'subja', unit: 'oz', servingSize: 100 }), ValidationError);
    assert.throws(() => validateCustomFood({ name: 'subja', unit: 'g', servingSize: 0 }), ValidationError);
  });
});

describe('mergeSearchResults', () => {
  it('prefers master over history for same name', () => {
    const merged = mergeSearchResults({
      masterItems: [{ name: 'Banana', calories: 105, source: 'master' }],
      myItems: [{ name: 'Banana', calories: 90, source: 'history' }],
      communityItems: [],
    });
    assert.equal(merged.length, 1);
    assert.equal(merged[0].source, 'master');
    assert.equal(merged[0].calories, 105);
  });
});

describe('shouldAutoPromote', () => {
  it('promotes draft after threshold sightings', () => {
    assert.equal(shouldAutoPromote({ status: 'draft', sightings: AUTO_PROMOTE_SIGHTINGS }), true);
    assert.equal(shouldAutoPromote({ status: 'draft', sightings: 1 }), false);
    assert.equal(shouldAutoPromote({ status: 'approved', sightings: 99 }), false);
  });
});

describe('seeds', () => {
  it('finds banana seed', () => {
    const row = findSeedProfile('Banana');
    assert.ok(row);
    assert.equal(row.nutrition.calories, 105);
  });

  it('searches idli', () => {
    const hits = searchSeedProfiles('idl');
    assert.ok(hits.some((h) => h.normalized_name === 'idli'));
  });

  it('suggests omelette and onion from short prefixes', () => {
    const oHits = searchSeedProfiles('o');
    assert.ok(oHits.some((h) => h.normalized_name === 'omelette'));
    assert.ok(oHits.some((h) => h.normalized_name === 'onion'));

    const omHits = searchSeedProfiles('om');
    assert.ok(omHits.some((h) => h.normalized_name === 'omelette'));
    assert.ok(!omHits.some((h) => h.normalized_name === 'onion'));
  });

  it('matches omelette typos via aliases', () => {
    const hits = searchSeedProfiles('omlette');
    assert.ok(hits.some((h) => h.normalized_name === 'omelette'));
  });
});
