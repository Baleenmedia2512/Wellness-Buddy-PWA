/**
 * Manual Log category + Dry Salad navigation.
 * Run: node --test frontend/src/shell/__tests__/manualLogCategories.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  MANUAL_LOG_CATEGORY,
  DRY_SALAD_META,
  GOOD_HABIT_SUBTYPE,
  GOOD_HABIT_SUBOPTIONS,
  isManualLogCategory,
  resolveManualLogCategoryClick,
} from '../domain/manualLogCategories.js';

describe('manualLogCategories', () => {
  it('includes dry-salad among known category ids', () => {
    assert.equal(MANUAL_LOG_CATEGORY.DRY_SALAD, 'dry-salad');
    assert.equal(isManualLogCategory('dry-salad'), true);
    assert.equal(isManualLogCategory('good-habit'), true);
    assert.equal(isManualLogCategory('food'), true);
    assert.equal(isManualLogCategory('nope'), false);
  });

  it('does not include healthy-snacks (Snacks & Soups removed)', () => {
    assert.equal(isManualLogCategory('healthy-snacks'), false);
  });

  it('exposes DRY_SALAD_META with required fields', () => {
    assert.equal(DRY_SALAD_META.id, 'dry-salad');
    assert.equal(DRY_SALAD_META.headerTitle, 'Target Nutrition');
    assert.equal(DRY_SALAD_META.label, 'Target Nutrition');
    assert.ok(DRY_SALAD_META.headerSubtitle);
  });

  it('routes dry-salad tile to the dry-salad flow', () => {
    assert.deepEqual(resolveManualLogCategoryClick('dry-salad'), {
      kind: 'dry-salad',
    });
  });

  it('routes good-habit tile to the Good Habit flow', () => {
    assert.deepEqual(resolveManualLogCategoryClick('good-habit'), {
      kind: 'good-habit-picker',
    });
  });

  it('Good Habit Manual Log is a single photo', () => {
    assert.deepEqual(
      GOOD_HABIT_SUBOPTIONS.map((o) => o.id),
      [GOOD_HABIT_SUBTYPE.IMAGE_NOTES],
    );
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
});
