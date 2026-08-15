/**
 * Manual Log category + Healthy Snacks subtype navigation.
 * Run: node --test frontend/src/shell/__tests__/manualLogCategories.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  MANUAL_LOG_CATEGORY,
  HEALTHY_SNACKS_SUBTYPE,
  HEALTHY_SNACKS_SUBOPTIONS,
  isManualLogCategory,
  isHealthySnacksSubtype,
  getHealthySnacksSuboption,
  resolveManualLogCategoryClick,
  resolveHealthySnacksSubtypeClick,
} from '../domain/manualLogCategories.js';

describe('manualLogCategories', () => {
  it('includes healthy-snacks among known category ids', () => {
    assert.equal(MANUAL_LOG_CATEGORY.HEALTHY_SNACKS, 'healthy-snacks');
    assert.equal(isManualLogCategory('healthy-snacks'), true);
    assert.equal(isManualLogCategory('good-habit'), true);
    assert.equal(isManualLogCategory('food'), true);
    assert.equal(isManualLogCategory('nope'), false);
  });

  it('exposes Soups, Salads, Sprouts subtypes', () => {
    assert.deepEqual(
      HEALTHY_SNACKS_SUBOPTIONS.map((o) => o.id),
      [
        HEALTHY_SNACKS_SUBTYPE.SOUPS,
        HEALTHY_SNACKS_SUBTYPE.SALADS,
        HEALTHY_SNACKS_SUBTYPE.SPROUTS,
      ],
    );
    assert.equal(HEALTHY_SNACKS_SUBOPTIONS.length, 3);
    assert.equal(isHealthySnacksSubtype('soups'), true);
    assert.equal(isHealthySnacksSubtype('salads'), true);
    assert.equal(isHealthySnacksSubtype('sprouts'), true);
    assert.equal(isHealthySnacksSubtype('food'), false);
  });

  it('routes healthy-snacks tile to the subtype picker', () => {
    assert.deepEqual(resolveManualLogCategoryClick('healthy-snacks'), {
      kind: 'healthy-snacks-picker',
    });
  });

  it('routes good-habit tile to the subtype picker', () => {
    assert.deepEqual(resolveManualLogCategoryClick('good-habit'), {
      kind: 'good-habit-picker',
    });
  });

  it('routes other tiles straight to their form id', () => {
    assert.deepEqual(resolveManualLogCategoryClick('food'), {
      kind: 'form',
      formId: 'food',
    });
    assert.deepEqual(resolveManualLogCategoryClick('weight'), {
      kind: 'form',
      formId: 'weight',
    });
    assert.equal(resolveManualLogCategoryClick('unknown'), null);
  });

  it('routes each subtype into the shared food search flow', () => {
    for (const id of ['soups', 'salads', 'sprouts']) {
      const next = resolveHealthySnacksSubtypeClick(id);
      assert.equal(next.formId, 'food');
      assert.equal(next.subtype.id, id);
      assert.ok(next.subtype.headerTitle);
      assert.ok(next.subtype.searchHint);
    }
    assert.equal(resolveHealthySnacksSubtypeClick('nope'), null);
  });

  it('looks up subtype metadata', () => {
    const soups = getHealthySnacksSuboption('soups');
    assert.equal(soups.label, 'Soups');
    assert.equal(soups.emoji, '🥣');
    assert.equal(getHealthySnacksSuboption('x'), null);
  });
});
