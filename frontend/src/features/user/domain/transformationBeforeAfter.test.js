/**
 * Run: node --test frontend/src/features/user/domain/transformationBeforeAfter.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_TRANSFORMATION_COMPARE_TYPE,
  filterTransformationHistoryByType,
  formatTransformationRecordWeight,
  historyFromLatestSlots,
  mapTestimonialToCompareHistory,
  selectTransformationBeforeAfter,
} from './transformationBeforeAfter.js';

const LEFT_EARLY = {
  id: 1,
  imageType: 'left',
  imageUrl: 'data:image/jpeg;base64,left48',
  weight: 48,
  createdAt: '2026-08-24T00:00:00.000Z',
};
const LEFT_LATE = {
  id: 3,
  imageType: 'left',
  imageUrl: 'data:image/jpeg;base64,left52',
  weight: 52,
  createdAt: '2026-09-24T00:00:00.000Z',
};
const FRONT = {
  id: 2,
  imageType: 'front',
  imageUrl: 'data:image/jpeg;base64,front',
  weight: 50,
  createdAt: '2026-08-25T00:00:00.000Z',
};

describe('transformation Before vs After pairing', () => {
  it('defaults the compare type to left', () => {
    assert.equal(DEFAULT_TRANSFORMATION_COMPARE_TYPE, 'left');
  });

  it('pairs earliest left with later left and keeps historical weights', () => {
    const pair = selectTransformationBeforeAfter(
      [LEFT_LATE, FRONT, LEFT_EARLY],
      'left',
    );
    assert.equal(pair.before.imageUrl, LEFT_EARLY.imageUrl);
    assert.equal(pair.before.weight, 48);
    assert.equal(pair.after.imageUrl, LEFT_LATE.imageUrl);
    assert.equal(pair.after.weight, 52);
  });

  it('never mixes types even when left is missing', () => {
    const pair = selectTransformationBeforeAfter([FRONT], 'left');
    assert.equal(pair.before, null);
    assert.equal(pair.after, null);
    assert.equal(filterTransformationHistoryByType([FRONT], 'front').length, 1);
  });

  it('maps testimonials_table before/after onto Left only', () => {
    const rows = mapTestimonialToCompareHistory({
      id: 9,
      status: 'pending',
      beforeImageUrl: 'https://cdn.example/before.jpg',
      afterImageUrl: 'https://cdn.example/after.jpg',
      beforeWeightKg: 48,
      afterWeightKg: 52,
    });
    const pair = selectTransformationBeforeAfter(rows, 'left');
    assert.equal(pair.before.weight, 48);
    assert.equal(pair.after.weight, 52);
    assert.equal(selectTransformationBeforeAfter(rows, 'front').before, null);
  });

  it('does not treat incomplete duplicate after path as After', () => {
    const rows = mapTestimonialToCompareHistory({
      status: 'incomplete',
      beforeImageUrl: 'https://cdn.example/before.jpg',
      afterImageUrl: 'https://cdn.example/before.jpg',
      beforeWeightKg: 48,
      afterWeightKg: 48,
    });
    const pair = selectTransformationBeforeAfter(rows, 'left');
    assert.equal(pair.before.weight, 48);
    assert.equal(pair.after, null);
  });

  it('does not invent weight from profile', () => {
    assert.equal(formatTransformationRecordWeight({ weight: 48 }), 48);
    assert.equal(formatTransformationRecordWeight({}), null);
  });

  it('reads Front Left Right from the existing JSON column', () => {
    const rows = historyFromLatestSlots({
      front: 'data:image/jpeg;base64,front',
      left: 'data:image/jpeg;base64,left',
      right: 'data:image/jpeg;base64,right',
    });
    assert.equal(selectTransformationBeforeAfter(rows, 'front').before.imageUrl, 'data:image/jpeg;base64,front');
    assert.equal(selectTransformationBeforeAfter(rows, 'left').before.imageUrl, 'data:image/jpeg;base64,left');
    assert.equal(selectTransformationBeforeAfter(rows, 'right').before.imageUrl, 'data:image/jpeg;base64,right');
  });
});
