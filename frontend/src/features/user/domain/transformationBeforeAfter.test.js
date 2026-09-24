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
  seedMineTestimonialFromLeftSlot,
  seedMineTestimonialFromProfileSlots,
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
    }, 72);
    assert.equal(selectTransformationBeforeAfter(rows, 'front').before.imageUrl, 'data:image/jpeg;base64,front');
    assert.equal(selectTransformationBeforeAfter(rows, 'left').before.imageUrl, 'data:image/jpeg;base64,left');
    assert.equal(selectTransformationBeforeAfter(rows, 'right').before.imageUrl, 'data:image/jpeg;base64,right');
    assert.equal(selectTransformationBeforeAfter(rows, 'front').before.weight, 72);
  });

  it('seeds the same weight on Before and After when photos are skipped', () => {
    const seeded = seedMineTestimonialFromLeftSlot(null, { leftUrl: null, weightKg: 55 });
    assert.equal(seeded.beforeImageUrl, null);
    assert.equal(seeded.afterImageUrl, null);
    assert.equal(seeded.beforeWeightKg, 55);
    assert.equal(seeded.afterWeightKg, 55);
  });

  it('does not seed Transformation Before from Profile Left', () => {
    const seeded = seedMineTestimonialFromLeftSlot(null, {
      leftUrl: 'data:image/jpeg;base64,left',
      weightKg: 55,
    });
    assert.equal(seeded.beforeImageUrl, null);
    assert.equal(seeded.afterImageUrl, null);
    assert.equal(seeded.beforeWeightKg, 55);
    assert.equal(seeded.afterWeightKg, 55);
  });

  it('keeps existing Before/After when Profile Left is provided', () => {
    const seeded = seedMineTestimonialFromLeftSlot({
      status: 'pending',
      beforeImageUrl: 'https://cdn.example/before.jpg',
      afterImageUrl: 'https://cdn.example/after.jpg',
      beforeWeightKg: 80,
      afterWeightKg: 72,
    }, {
      leftUrl: 'data:image/jpeg;base64,left',
      weightKg: 70,
    });
    assert.equal(seeded.beforeImageUrl, 'https://cdn.example/before.jpg');
    assert.equal(seeded.afterImageUrl, 'https://cdn.example/after.jpg');
    assert.equal(seeded.beforeWeightKg, 80);
    assert.equal(seeded.afterWeightKg, 72);
  });

  it('does not replace an existing Before photo with Profile Left', () => {
    const seeded = seedMineTestimonialFromLeftSlot({
      beforeImageUrl: 'https://cdn.example/before.jpg',
      beforeWeightKg: 48,
    }, {
      leftUrl: 'data:image/jpeg;base64,left',
      weightKg: 55,
    });
    assert.equal(seeded.beforeImageUrl, 'https://cdn.example/before.jpg');
    assert.equal(seeded.beforeWeightKg, 48);
  });

  it('does not seed Before/After from Left when Profile Right also exists', () => {
    const seeded = seedMineTestimonialFromProfileSlots({
      status: 'incomplete',
      beforeImageUrl: null,
      afterImageUrl: null,
    }, {
      leftUrl: 'data:image/jpeg;base64,left',
      rightUrl: 'data:image/jpeg;base64,right',
    });
    assert.equal(seeded.beforeImageUrl, null);
    assert.equal(seeded.afterImageUrl, null);
  });

  it('does not change stored After when Profile Left changes', () => {
    const seeded = seedMineTestimonialFromProfileSlots({
      status: 'incomplete',
      beforeImageUrl: 'https://cdn.example/old-left.jpg',
      afterImageUrl: 'https://cdn.example/old-left.jpg',
    }, {
      leftUrl: 'data:image/jpeg;base64,new-left',
      rightUrl: 'data:image/jpeg;base64,right',
    });
    assert.equal(seeded.beforeImageUrl, 'https://cdn.example/old-left.jpg');
    assert.equal(seeded.afterImageUrl, 'https://cdn.example/old-left.jpg');
  });

  it('does not overwrite a pending After with Profile Right', () => {
    const seeded = seedMineTestimonialFromProfileSlots({
      status: 'pending',
      beforeImageUrl: 'https://cdn.example/before.jpg',
      afterImageUrl: 'https://cdn.example/after.jpg',
    }, {
      rightUrl: 'data:image/jpeg;base64,right',
    });
    assert.equal(seeded.afterImageUrl, 'https://cdn.example/after.jpg');
  });

  it('returns null when there is no testimonial and no weight', () => {
    const seeded = seedMineTestimonialFromProfileSlots(null, {
      rightUrl: 'data:image/jpeg;base64,right',
    });
    assert.equal(seeded, null);
  });
});
