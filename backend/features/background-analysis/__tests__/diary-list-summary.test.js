/**
 * backend/features/background-analysis/__tests__/diary-list-summary.test.js
 * Run: node --test backend/features/background-analysis/__tests__/diary-list-summary.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  extractFoodListSummary,
  inferHasImage,
} from '../domain/diary-list-summary.js';
import {
  normalizeDiaryPagination,
  paginateDiaryEntries,
  DIARY_LIST_DEFAULT_LIMIT,
} from '../domain/diary-pagination.js';

describe('extractFoodListSummary', () => {
  it('projects lean name + activity without returning full AI payload shape to callers', () => {
    const summary = extractFoodListSummary({
      foods: [
        { name: 'dal/soup', calories: 63, nutrition: { protein: 4 } },
      ],
      total: { calories: 63 },
    }, null);
    assert.equal(summary.name, 'dal/soup');
    assert.equal(summary.activityType, 'food');
    assert.equal(summary.items.length, 1);
    assert.equal(summary.items[0].calories, 63);
    assert.equal(summary.items[0].glycemicIndex, null);
  });

  it('includes per-item GI from nutrition.glycemic_index', () => {
    const summary = extractFoodListSummary({
      foods: [
        { name: 'Masala Dosa', calories: 400, nutrition: { glycemic_index: 65.4 } },
        { name: 'Ragi Dosa', calories: 200, glycemic_index: 45 },
      ],
    }, null);
    assert.equal(summary.items[0].glycemicIndex, 65);
    assert.equal(summary.items[1].glycemicIndex, 45);
  });

  it('lists every food name instead of a +N compact title', () => {
    const summary = extractFoodListSummary({
      foods: [
        { name: 'Dosa', calories: 540 },
        { name: 'Idli with Sambar and vegetable curry', calories: 350 },
        { name: 'Idiyappam', calories: 345 },
        { name: 'Chutney', calories: 40 },
      ],
      total: { calories: 1275 },
    }, null);
    assert.equal(
      summary.name,
      'Dosa, Idli with Sambar and vegetable curry, Idiyappam, Chutney',
    );
    assert.equal(summary.items.length, 4);
  });

  it('uses detailedItems when it has more dishes than foods[]', () => {
    const summary = extractFoodListSummary({
      foods: [{ name: 'Masala Dosa', calories: 1450 }],
      detailedItems: [
        { name: 'Masala Dosa', calories: 400 },
        { name: 'Dosa with Onion', calories: 350 },
        { name: 'Dosa batter', calories: 200 },
        { name: 'Egg Dosa', calories: 300 },
        { name: 'Ragi Dosa', calories: 200 },
      ],
      total: { calories: 1450 },
    }, null);
    assert.equal(
      summary.name,
      'Masala Dosa, Dosa with Onion, Dosa batter, Egg Dosa, Ragi Dosa',
    );
    assert.equal(summary.items.length, 5);
  });

  it('detects water via processedBy', () => {
    const summary = extractFoodListSummary({
      foods: [{ name: 'Plain Water', volume_ml: 100, calories: 0 }],
    }, 'water_preset');
    assert.equal(summary.activityType, 'water');
    assert.equal(summary.volumeMl, 100);
  });

  it('detects afresh by name', () => {
    const summary = extractFoodListSummary({
      foods: [{ name: 'Herbalife Afresh Energy Drink', scoops: 1, calories: 4 }],
    }, null);
    assert.equal(summary.activityType, 'afresh');
    assert.equal(summary.scoops, 1);
  });
});

describe('inferHasImage', () => {
  it('is true when imagePath or captureId is present', () => {
    assert.equal(inferHasImage({ imagePath: '/x', captureId: null }), true);
    assert.equal(inferHasImage({ imagePath: null, captureId: 'c1' }), true);
    assert.equal(inferHasImage({ imagePath: null, captureId: null }), false);
    assert.equal(inferHasImage({ hasImageHint: true }), true);
  });
});

describe('normalizeDiaryPagination', () => {
  it('defaults to 20 / 0', () => {
    assert.deepEqual(normalizeDiaryPagination(undefined, undefined), {
      limit: DIARY_LIST_DEFAULT_LIMIT,
      offset: 0,
    });
  });

  it('caps limit at 50', () => {
    assert.equal(normalizeDiaryPagination(999, 0).limit, 50);
  });
});

describe('paginateDiaryEntries', () => {
  it('slices and reports hasMore', () => {
    const entries = Array.from({ length: 25 }, (_, i) => ({ id: i }));
    const page0 = paginateDiaryEntries(entries, { limit: 20, offset: 0 });
    assert.equal(page0.entries.length, 20);
    assert.equal(page0.pagination.hasMore, true);
    assert.equal(page0.pagination.total, 25);
    assert.equal(page0.pagination.nextOffset, 20);

    const page1 = paginateDiaryEntries(entries, { limit: 20, offset: 20 });
    assert.equal(page1.entries.length, 5);
    assert.equal(page1.pagination.hasMore, false);
    assert.equal(page1.pagination.nextOffset, null);
  });
});
